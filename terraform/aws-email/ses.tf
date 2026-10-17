# The domain was verified by hand; its DKIM CNAMEs live at the registrar, not here.
import {
  to = aws_sesv2_email_identity.sending_domain
  id = "thetaletribe.com"
}

resource "aws_sesv2_email_identity" "sending_domain" {
  email_identity = var.sending_domain

  # Re-creating it issues new DKIM tokens, which breaks sending until DNS is redone.
  lifecycle {
    prevent_destroy = true
  }
}
