# The secret shells belong to ../ (secrets.tf); this root only adds their versions.
# CI no longer syncs SMTP_USER/SMTP_PASS, so these are the only writers.
resource "google_secret_manager_secret_version" "smtp_user" {
  secret      = "projects/${var.project_id}/secrets/SMTP_USER"
  secret_data = aws_iam_access_key.smtp.id
}

resource "google_secret_manager_secret_version" "smtp_pass" {
  secret      = "projects/${var.project_id}/secrets/SMTP_PASS"
  secret_data = aws_iam_access_key.smtp.ses_smtp_password_v4
}
