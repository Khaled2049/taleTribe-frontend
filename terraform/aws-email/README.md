# aws-email

SES sending for invite emails (`functions/src/endpoints/onInviteApproved.ts`).
The Function logs in to SES SMTP in `us-east-1` with `SMTP_USER`/`SMTP_PASS`
from Secret Manager. This root owns those two values end to end:

- the `thetaletribe.com` SES identity (imported; `prevent_destroy`)
- `ses-smtp-invites`, a send-only IAM user allowed `ses:SendRawEmail` from that domain
- its access key, whose ID and derived SMTP password become new versions of
  `SMTP_USER` and `SMTP_PASS`

It is applied by hand, not by CI, so GitHub Actions needs no AWS credentials.
`deploy.yml` no longer syncs those two secrets from GitHub; don't add them back,
or a deploy will overwrite the working credential with the stale one.

Not managed here: the DKIM CNAMEs (DNS is at the registrar, not Cloud DNS or
Route 53), `EMAIL_FROM`, and the secret shells themselves (`../secrets.tf`).

## Apply

```bash
aws login                                   # AWS account 308830239283
gcloud auth application-default login       # writes to story-6f89f Secret Manager
cd terraform/aws-email
terraform init
terraform plan                              # first run: 1 import, 5 to add, 1 change (tags)
terraform apply
```

Firebase pins a secret version when a Function is deployed, so redeploy the
Function to pick up the new values:

```bash
cd functions && npx firebase deploy --only functions:onInviteApproved
```

## Rotate the key

```bash
terraform apply -replace=aws_iam_access_key.smtp
```

Then redeploy the Function as above. The old key and secret versions are
destroyed in the same apply, so invites fail until the redeploy finishes.

The access key secret and SMTP password are in this root's state
(`gs://story-6f89f-terraform-state/frontend/aws-email`).
