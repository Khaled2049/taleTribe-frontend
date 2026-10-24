terraform {
  required_version = ">= 1.7.0"

  backend "gcs" {
    bucket = "story-6f89f-terraform-state"
    prefix = "billing/state"
  }

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 8.6"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.7"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
