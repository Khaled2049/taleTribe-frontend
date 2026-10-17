terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    google = {
      source  = "hashicorp/google"
      version = "~> 8.6"
    }
  }

  # Holds the SMTP password (via the access key), like the main root's state.
  backend "gcs" {
    bucket = "story-6f89f-terraform-state"
    prefix = "frontend/aws-email"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      project    = "thetaletribe"
      managed-by = "terraform"
      stack      = "taleTribe-frontend/terraform/aws-email"
    }
  }
}

provider "google" {
  project = var.project_id
}
