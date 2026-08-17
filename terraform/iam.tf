# IAM: Allow App Engine default service account (Cloud Functions runtime) to read secrets
resource "google_secret_manager_secret_iam_member" "secret_access" {
  for_each  = google_secret_manager_secret.secrets
  secret_id = each.value.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${local.appengine_service_account}"
}

# IAM: Allow App Engine default service account to invoke Cloud Run backend
resource "google_cloud_run_v2_service_iam_member" "backend_invoker" {
  name     = data.google_cloud_run_v2_service.backend.name
  location = data.google_cloud_run_v2_service.backend.location
  role     = "roles/run.invoker"
  member   = "serviceAccount:${local.appengine_service_account}"
}

# Data source for GitHub Actions service account
data "google_service_account" "github_actions" {
  account_id = "github-actions"
  project    = var.project_id
}

# IAM: Allow GitHub Actions to deploy Firebase (Hosting, Functions, Rules)
resource "google_project_iam_member" "github_firebase_admin" {
  project = var.project_id
  role    = "roles/firebase.admin"
  member  = "serviceAccount:${data.google_service_account.github_actions.email}"
}

# IAM: Allow GitHub Actions to deploy Cloud Functions
resource "google_project_iam_member" "github_cloudfunctions_developer" {
  project = var.project_id
  role    = "roles/cloudfunctions.developer"
  member  = "serviceAccount:${data.google_service_account.github_actions.email}"
}

# Cloud Tasks grants (github_cloudtasks_admin, runtime_cloudtasks_enqueuer) were
# removed with the Firestore indexing stack: no onTaskDispatched function remains,
# so nothing syncs a queue at deploy time or enqueues at runtime. Indexing is now
# the story-data `indexing_outbox` table, polled by taleTribe-agents.

# IAM: Allow GitHub Actions to add secret versions (principle of least privilege)
# Note: Secrets must be pre-created; this SA can only add/update versions, not delete secrets
resource "google_project_iam_member" "github_secretversion_adder" {
  project = var.project_id
  role    = "roles/secretmanager.secretVersionAdder"
  member  = "serviceAccount:${data.google_service_account.github_actions.email}"
}

# IAM: Allow GitHub Actions to read secrets (needed for health checks/verification)
resource "google_project_iam_member" "github_secretmanager_secretaccessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${data.google_service_account.github_actions.email}"
}

# IAM: Allow GitHub Actions service account to manage Terraform state in GCS
resource "google_storage_bucket_iam_member" "github_terraform_state" {
  bucket = var.terraform_state_bucket
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${data.google_service_account.github_actions.email}"
}
