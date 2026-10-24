# Project budget

This standalone Terraform stack manages spending controls for `story-6f89f`:

- Adopts the existing budget and sets it to **USD 100/month before credits**.
- Emails billing recipients and project owners at **USD 50, 90 and 100**.
- Uses authenticated Pub/Sub notifications to disable project billing when
  reported actual spend reaches USD 100.
- Provides a guarded script to retire the old shutdown function and messaging.

Disabling billing interrupts paid services and requires manual recovery.
Notifications can lag, so spending may exceed USD 100 before shutdown.

## Restore billing after a shutdown

This month's spend is still at or over the budget, so re-linking billing on its
own is undone by the next budget notification, usually within hours. First
raise `monthly_budget_usd` above current spend and apply; the function ignores
notifications for any other budget amount. Then re-link billing in the console.
Lower the budget again after the month ends.

## Check locally

From the repository root:

```sh
python3 -m unittest discover -s terraform/billing/tests -v
terraform -chdir=terraform/billing fmt -check
terraform -chdir=terraform/billing init -backend=false -lockfile=readonly
terraform -chdir=terraform/billing validate
```

When upgrading providers, update and commit checksums for both CI and macOS:

```sh
terraform -chdir=terraform/billing providers lock -platform=linux_amd64 -platform=darwin_arm64
```

## Roll out manually

CI only validates this stack; merging does not deploy it. With Google credentials
and budget/project IAM permissions, review and apply the plan:

```sh
terraform -chdir=terraform/billing init
terraform -chdir=terraform/billing plan -out=budget.tfplan
terraform -chdir=terraform/billing apply budget.tfplan
```

The plan should adopt the existing budget and create the replacement shutdown
path. It enables the APIs the path needs, including Cloud Billing. The budget
moves to the new topic only after the function and its push subscription
exist, so a failed build leaves the budget on the old topic. Apply while spend
is below USD 100. Application resources and the old shutdown path are left alone.

Once `story-budget-shutdown` is active and logs a real `below_budget`
notification, preview and remove the old setup:

```sh
python3 terraform/billing/retire_legacy.py
python3 terraform/billing/retire_legacy.py --execute
```

The script reads its expected values from `terraform output`, so run it with
the same state access as the apply. It verifies the replacement before deleting
the old subscription, topic and function. It also impersonates
`story-budget-runtime` to confirm, read-only, that the runtime holds the
shutdown permissions and can reach the Cloud Billing API, so you need
`roles/iam.serviceAccountTokenCreator` on that account. It retains the adopted
budget and shared resources.
Never send a synthetic notification of USD 100 or more to the live function;
the local tests cover shutdown with mocks.
