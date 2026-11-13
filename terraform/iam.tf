# Functions run as their own account with only what they use, not the
# default compute account (which holds project Editor).
resource "google_service_account" "functions" {
  account_id   = "novelsync-functions"
  display_name = "Firebase Functions runtime"
  project      = var.project_id
}

locals {
  functions_service_account = google_service_account.functions.email
  # Firestore, Auth admin (claims, magic links, revocation checks), logs, and
  # receiving the onInviteApproved Firestore event.
  functions_project_roles = toset([
    "roles/datastore.user",
    "roles/firebaseauth.admin",
    "roles/logging.logWriter",
    "roles/eventarc.eventReceiver",
  ])
}

resource "google_project_iam_member" "functions" {
  for_each = local.functions_project_roles
  project  = var.project_id
  role     = each.value
  member   = "serviceAccount:${local.functions_service_account}"
}

resource "google_secret_manager_secret_iam_member" "secret_access" {
  for_each  = google_secret_manager_secret.secrets
  secret_id = each.value.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${local.functions_service_account}"
}

# Eventarc delivers Firestore events as this account: Pub/Sub mints its push
# token, and the account must be allowed to invoke the trigger function.
resource "google_service_account_iam_member" "functions_pubsub_tokens" {
  service_account_id = google_service_account.functions.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

data "google_cloud_run_v2_service" "on_invite_approved" {
  name     = "oninviteapproved"
  location = var.region
  project  = var.project_id
}

resource "google_cloud_run_v2_service_iam_member" "functions_event_invoker" {
  name     = data.google_cloud_run_v2_service.on_invite_approved.name
  location = data.google_cloud_run_v2_service.on_invite_approved.location
  role     = "roles/run.invoker"
  member   = "serviceAccount:${local.functions_service_account}"
}

# CI deploys Functions that run as this account.
resource "google_service_account_iam_member" "github_deploys_functions" {
  service_account_id = google_service_account.functions.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${data.google_service_account.github_actions.email}"
}

# Gen 2 Functions build with the default compute account. This is what it
# keeps once Editor is removed from it.
resource "google_project_iam_member" "functions_builder" {
  project = var.project_id
  role    = "roles/cloudbuild.builds.builder"
  member  = "serviceAccount:${data.google_project.current.number}-compute@developer.gserviceaccount.com"
}

# agents, recs and creditProxy each grant run.invoker to the Functions account
# in their own Terraform (variable firebase_functions_service_account).

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
