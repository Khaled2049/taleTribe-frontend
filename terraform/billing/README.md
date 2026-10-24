# Project budget

This standalone Terraform stack manages spending controls for `story-6f89f`:

- Adopts the existing budget and sets it to **USD 50/month before credits**.
- Emails billing recipients and project owners at **USD 25, 45 and 50**.
- Uses authenticated Pub/Sub notifications to disable project billing when
  reported actual spend reaches USD 50.
- Provides a guarded script to retire the old shutdown function and messaging.

Disabling billing interrupts paid services and requires manual recovery.
Notifications can lag, so spending may exceed USD 50 before shutdown.

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
path. Apply while spend is below USD 50; it switches notification topics during
the rollout. Application resources and the old shutdown path are left alone.

Once `story-budget-shutdown` is active and logs a real `below_budget`
notification, preview and remove the old setup:

```sh
python3 terraform/billing/retire_legacy.py
python3 terraform/billing/retire_legacy.py --execute
```

The script verifies the replacement before deleting the old subscription,
topic and function. It retains the adopted budget and shared resources.
Never send a synthetic notification of USD 50 or more to the live function;
the local tests cover shutdown with mocks.
