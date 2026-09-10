output "backend_service_url" {
  description = "URL of the Cloud Run backend service"
  value       = data.google_cloud_run_v2_service.backend.uri
}

output "recommendation_service_url" {
  description = "URL and OIDC audience injected into Firebase Functions for server-to-server recommendation calls"
  value       = local.recommendation_service_url
}

output "firebase_hosting_site" {
  description = "Firebase Hosting site ID"
  value       = var.firebase_hosting_site_id
}

output "app_engine_service_account" {
  description = "Email of the App Engine default service account (Cloud Functions runtime)"
  value       = local.appengine_service_account
}

output "github_actions_service_account" {
  description = "Email of the GitHub Actions service account"
  value       = data.google_service_account.github_actions.email
}

output "secrets_created" {
  description = "List of Secret Manager secrets created"
  value       = [for s in google_secret_manager_secret.secrets : s.secret_id]
}

output "project_id" {
  description = "GCP Project ID"
  value       = var.project_id
}

output "region" {
  description = "GCP region"
  value       = var.region
}
