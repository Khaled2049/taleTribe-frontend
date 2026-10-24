data "google_project" "current" {
  project_id = var.project_id
}

locals {
  service_name = "story-budget-shutdown"
}

resource "google_project_service" "budgets" {
  project            = var.project_id
  service            = "billingbudgets.googleapis.com"
  disable_on_destroy = false
}

# The shutdown path builds and runs a gen2 function behind Pub/Sub push, and
# the runtime calls the Cloud Billing API when spend reaches the budget.
resource "google_project_service" "shutdown" {
  for_each = toset([
    "artifactregistry.googleapis.com",
    "cloudbilling.googleapis.com",
    "cloudbuild.googleapis.com",
    "cloudfunctions.googleapis.com",
    "iam.googleapis.com",
    "pubsub.googleapis.com",
    "run.googleapis.com",
  ])
  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_pubsub_topic" "budget" {
  name       = "story-monthly-budget"
  depends_on = [google_project_service.shutdown]
}

resource "google_pubsub_topic_iam_member" "billing_publisher" {
  topic  = google_pubsub_topic.budget.name
  role   = "roles/pubsub.publisher"
  member = "serviceAccount:billing-budget-alert@system.gserviceaccount.com"
}

resource "google_billing_budget" "monthly" {
  billing_account = var.billing_account_id
  display_name    = "TheTaleTribe monthly project budget"

  budget_filter {
    projects               = ["projects/${data.google_project.current.number}"]
    calendar_period        = "MONTH"
    credit_types_treatment = "EXCLUDE_ALL_CREDITS"
  }

  amount {
    specified_amount {
      currency_code = "USD"
      units         = tostring(var.monthly_budget_usd)
    }
  }

  dynamic "threshold_rules" {
    for_each = [0.5, 0.9, 1.0]
    content {
      threshold_percent = threshold_rules.value
      spend_basis       = "CURRENT_SPEND"
    }
  }

  all_updates_rule {
    pubsub_topic                    = google_pubsub_topic.budget.id
    schema_version                  = "1.0"
    disable_default_iam_recipients  = false
    enable_project_level_recipients = true
  }

  lifecycle {
    prevent_destroy = true
    postcondition {
      condition     = endswith(self.id, "/budgets/${var.budget_id}")
      error_message = "var.budget_id must name the adopted budget; the shutdown function only acts on that id."
    }
  }

  # Switch the budget to the new topic only once something consumes it.
  depends_on = [
    google_project_service.budgets,
    google_pubsub_topic_iam_member.billing_publisher,
    google_pubsub_subscription.shutdown,
  ]
}

resource "google_service_account" "runtime" {
  account_id   = "story-budget-runtime"
  display_name = "Project budget shutdown runtime"
  depends_on   = [google_project_service.shutdown]
}

# This identity can unlink this project's billing, but cannot attach billing,
# manage budgets, or change resources in other projects.
resource "google_project_iam_custom_role" "shutdown" {
  role_id     = "storyBudgetShutdown"
  title       = "Read and disable this project's billing"
  permissions = ["resourcemanager.projects.get", "resourcemanager.projects.deleteBillingAssignment"]
}

resource "google_project_iam_member" "shutdown" {
  project = var.project_id
  role    = google_project_iam_custom_role.shutdown.name
  member  = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_service_account" "push" {
  account_id   = "story-budget-push"
  display_name = "Authenticated budget notification delivery"
}

resource "google_service_account_iam_member" "push_tokens" {
  service_account_id = google_service_account.push.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

resource "google_service_account" "build" {
  account_id   = "story-budget-build"
  display_name = "Budget function image build"
}

resource "google_project_iam_member" "build_logs" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.build.email}"
}

resource "google_storage_bucket" "source" {
  name                        = "${var.project_id}-budget-function-source"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  # Cloud Functions copies source at deploy, so old uploads are unused.
  lifecycle_rule {
    condition {
      age = 30
    }
    action {
      type = "Delete"
    }
  }
}

resource "google_storage_bucket_iam_member" "build_source" {
  bucket = google_storage_bucket.source.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.build.email}"
}

# Cloud Functions copies uploaded source into its regional build-source bucket.
resource "google_project_iam_member" "build_staged_source" {
  project = var.project_id
  role    = "roles/storage.objectViewer"
  member  = "serviceAccount:${google_service_account.build.email}"
  condition {
    title      = "Read regional Cloud Functions build source"
    expression = "resource.name.startsWith('projects/_/buckets/gcf-v2-sources-${data.google_project.current.number}-${var.region}/')"
  }
}

resource "google_artifact_registry_repository" "images" {
  location      = var.region
  repository_id = "story-budget-control"
  format        = "DOCKER"
  cleanup_policies {
    id     = "delete-old-images"
    action = "DELETE"
    condition {
      tag_state  = "ANY"
      older_than = "604800s"
    }
  }
  cleanup_policies {
    id     = "keep-latest-images"
    action = "KEEP"
    most_recent_versions {
      keep_count = 2
    }
  }
  cleanup_policy_dry_run = false
  depends_on             = [google_project_service.shutdown]
}

resource "google_artifact_registry_repository_iam_member" "build_images" {
  location   = var.region
  repository = google_artifact_registry_repository.images.name
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${google_service_account.build.email}"
}

data "archive_file" "source" {
  type        = "zip"
  source_dir  = "${path.module}/function"
  excludes    = ["__pycache__"]
  output_path = "${path.module}/.function-source.zip"
}

resource "google_storage_bucket_object" "source" {
  name   = "shutdown-${data.archive_file.source.output_sha256}.zip"
  bucket = google_storage_bucket.source.name
  source = data.archive_file.source.output_path
}

resource "google_cloudfunctions2_function" "shutdown" {
  name        = local.service_name
  location    = var.region
  description = "Disable story project billing when its monthly USD budget is reached."

  build_config {
    runtime           = "python312"
    entry_point       = "stop_billing"
    service_account   = google_service_account.build.name
    docker_repository = google_artifact_registry_repository.images.id
    source {
      storage_source {
        bucket = google_storage_bucket.source.name
        object = google_storage_bucket_object.source.name
      }
    }
  }

  service_config {
    service_account_email          = google_service_account.runtime.email
    available_memory               = "256Mi"
    available_cpu                  = "1"
    min_instance_count             = 0
    max_instance_count             = 1
    timeout_seconds                = 60
    ingress_settings               = "ALLOW_ALL"
    all_traffic_on_latest_revision = true
    environment_variables = {
      PROJECT_ID         = var.project_id
      BILLING_ACCOUNT_ID = var.billing_account_id
      EXPECTED_BUDGET_ID = var.budget_id
      MONTHLY_BUDGET_USD = tostring(var.monthly_budget_usd)
    }
  }

  depends_on = [
    google_project_service.shutdown,
    google_project_iam_member.shutdown,
    google_project_iam_member.build_logs,
    google_storage_bucket_iam_member.build_source,
    google_project_iam_member.build_staged_source,
    google_artifact_registry_repository_iam_member.build_images,
  ]
}

# Public network reachability is necessary for push delivery. IAM still refuses
# unauthenticated requests; only the push identity receives a service-level grant.
resource "google_cloud_run_service_iam_member" "push_invoker" {
  location = var.region
  service  = google_cloudfunctions2_function.shutdown.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.push.email}"
}

resource "google_pubsub_subscription" "shutdown" {
  name                 = "story-monthly-budget-shutdown"
  topic                = google_pubsub_topic.budget.id
  ack_deadline_seconds = 120
  expiration_policy {
    ttl = ""
  }
  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }
  push_config {
    push_endpoint = google_cloudfunctions2_function.shutdown.service_config[0].uri
    oidc_token {
      service_account_email = google_service_account.push.email
      audience              = google_cloudfunctions2_function.shutdown.service_config[0].uri
    }
  }
  depends_on = [google_cloud_run_service_iam_member.push_invoker, google_service_account_iam_member.push_tokens]
}
