variable "aws_region" {
  description = "SES region. Must match smtpHost in functions/src/endpoints/onInviteApproved.ts"
  type        = string
  default     = "us-east-1"
}

variable "project_id" {
  description = "GCP project holding the Function's Secret Manager secrets"
  type        = string
  default     = "story-6f89f"
}

variable "sending_domain" {
  description = "Verified SES domain that invite emails are sent from (EMAIL_FROM's domain)"
  type        = string
  default     = "thetaletribe.com"
}

variable "smtp_user_name" {
  description = "IAM user whose access key is the SES SMTP credential"
  type        = string
  default     = "ses-smtp-invites"
}
