variable "project_id" {
  description = "GCP Project ID"
  type        = string
  default     = "story-6f89f"
}

variable "region" {
  description = "GCP region for Firebase and Cloud Functions"
  type        = string
  default     = "us-central1"
}

variable "firebase_hosting_site_id" {
  description = "Firebase Hosting site ID"
  type        = string
  default     = "story-6f89f"
}

variable "backend_service_name" {
  description = "Cloud Run backend service name (novelsync-agents)"
  type        = string
  default     = "novelsync-agents"
}

variable "recommendation_service_name" {
  description = "Cloud Run recommendation service name, owned by taleTribe-recs"
  type        = string
  default     = "novelsync-recs"
}

variable "terraform_state_bucket" {
  description = "GCS bucket for Terraform state"
  type        = string
  default     = "story-6f89f-terraform-state"
}

variable "frontend_url" {
  description = "Frontend application URL"
  type        = string
  default     = "https://story-6f89f.web.app"
}

variable "secret_names" {
  description = "Secret Manager secret names for Firebase Functions"
  type        = list(string)
  default = [
    "SMTP_USER",
    "SMTP_PASS",
    "EMAIL_FROM",
    "MAGIC_LINK_REDIRECT_URL",
    "REPLICATE_API_TOKEN",
    "ENCRYPTION_KEY",
    "BOOKS_API_KEY",
  ]
}
