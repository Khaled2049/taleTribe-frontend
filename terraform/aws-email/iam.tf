# A dedicated send-only user, so cleaning up human IAM users can't break invites again.
resource "aws_iam_user" "smtp" {
  name = var.smtp_user_name
  path = "/system/"
}

data "aws_iam_policy_document" "send_from_domain" {
  statement {
    sid       = "SendFromSendingDomain"
    actions   = ["ses:SendRawEmail"]
    resources = [aws_sesv2_email_identity.sending_domain.arn]
  }
}

resource "aws_iam_user_policy" "smtp_send" {
  name   = "ses-send-from-${var.sending_domain}"
  user   = aws_iam_user.smtp.name
  policy = data.aws_iam_policy_document.send_from_domain.json
}

# Rotate with: terraform apply -replace=aws_iam_access_key.smtp
resource "aws_iam_access_key" "smtp" {
  user = aws_iam_user.smtp.name
}
