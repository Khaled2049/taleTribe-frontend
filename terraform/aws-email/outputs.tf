output "smtp_iam_user" {
  description = "IAM user behind the SES SMTP credential"
  value       = aws_iam_user.smtp.arn
}

output "sending_identity" {
  description = "SES identity invite emails are sent from"
  value       = aws_sesv2_email_identity.sending_domain.arn
}

output "secret_versions" {
  description = "Secret Manager versions the Function must be redeployed to pick up"
  value = {
    SMTP_USER = google_secret_manager_secret_version.smtp_user.name
    SMTP_PASS = google_secret_manager_secret_version.smtp_pass.name
  }
}
