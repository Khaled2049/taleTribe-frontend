variable "project_id" {
  type    = string
  default = "story-6f89f"
}

variable "billing_account_id" {
  type    = string
  default = "01F66B-B18158-2731DE"
}

variable "region" {
  type    = string
  default = "us-central1"
}

variable "monthly_budget_usd" {
  description = "Monthly usage budget before credits; disables project billing at this amount."
  type        = number
  default     = 50
  validation {
    condition     = var.monthly_budget_usd > 0 && floor(var.monthly_budget_usd) == var.monthly_budget_usd
    error_message = "The budget must be a positive whole number of USD."
  }
}
