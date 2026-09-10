# Enable required Google Cloud APIs
resource "google_project_service" "firebase" {
  service            = "firebase.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "firebasehosting" {
  service            = "firebasehosting.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "cloudfunctions" {
  service            = "cloudfunctions.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "cloudbuild" {
  service            = "cloudbuild.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "cloudtasks" {
  service            = "cloudtasks.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "secretmanager" {
  service            = "secretmanager.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "firestore" {
  service            = "firestore.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "cloudrun" {
  service            = "run.googleapis.com"
  disable_on_destroy = false
}

# App Engine default service account (computed, used by Cloud Functions)
# Format: <project-id>@appspot.gserviceaccount.com
locals {
  appengine_service_account = "${var.project_id}@appspot.gserviceaccount.com"
}

# Get the Cloud Run backend service
data "google_cloud_run_v2_service" "backend" {
  name     = var.backend_service_name
  location = var.region
  project  = var.project_id
}

# The recommendation stack owns this service and its IAM. Frontend Terraform
# reads only its URL so the Functions deployment can set the server-side
# RECOMMENDATION_SERVICE_URL parameter without duplicating infrastructure
# ownership across state files.
data "google_cloud_run_v2_service" "recommendations" {
  name     = var.recommendation_service_name
  location = var.region
  project  = var.project_id
}

data "google_project" "current" {
  project_id = var.project_id
}

locals {
  # RECOMMENDATION_SERVICE_URL is also the OIDC audience Functions mint tokens
  # for, and recs rejects any token whose audience is not exactly its own
  # RECS_SERVICE_URL — which taleTribe-recs pins to the deterministic
  # project-number URL. The data source's `uri` is the legacy hashed URL
  # (`<name>-<hash>-uc.a.run.app`); the service answers on both, but a token
  # minted for that one fails recs's audience check. Build the same URL recs
  # builds. The name comes from the data source so this still fails fast when
  # the service does not exist yet.
  recommendation_service_url = "https://${data.google_cloud_run_v2_service.recommendations.name}-${data.google_project.current.number}.${var.region}.run.app"
}
