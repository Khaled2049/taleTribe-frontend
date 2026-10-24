# Project budget and automatic shutdown

This independent Terraform stack owns the `story-6f89f` project budget and its
shutdown path. Its GCS state is separate from the frontend application stack;
the existing frontend deploy workflow does not initialize or apply it.

The console-created budget is adopted with an import block, preserving its ID.
The requested amount is **USD 50 per calendar month** (the old budget was USD
100). All services in project `793308156964` count toward it. Credits are
excluded from the calculation so promotional credits cannot conceal usage.
This is a budget on gross usage, not necessarily the final amount charged to
the card. Email alerts go to the default billing recipients and project owners
at USD 25, USD 45 and USD 50.

Cloud Billing publishes to `story-monthly-budget`, which delivers authenticated
Pub/Sub pushes to the private `story-budget-shutdown` function. When **actual**
spend reaches or exceeds USD 50, the runtime unlinks billing for `story-6f89f`.
This interrupts paid services across the project. It does not automatically
reenable billing next month. The runtime can only read and unlink this
project's billing; it cannot link accounts or change another project.

The handler checks the budget/account IDs, currency, configured amount and
current monthly period, ignores forecasts and stale notifications, and returns
5xx on Billing API failures so Pub/Sub retries. Billing updates can lag usage:
this is a delayed shutdown mechanism, **not a guaranteed USD 50 hard cap**.
See Google's [notification format](https://cloud.google.com/billing/docs/how-to/budgets-programmatic-notifications#notification_format).

## Local checks

```sh
python3 -m unittest discover -s terraform/billing/tests -v
terraform -chdir=terraform/billing fmt -check
terraform -chdir=terraform/billing init -backend=false
terraform -chdir=terraform/billing validate
```

Commit this stack's `.terraform.lock.hcl` when updating providers. Python
decision tests mock the Billing API and never change a real project's billing.

After changing provider versions, record package checksums for both Linux CI
and Apple Silicon development before committing the lock file:

```sh
terraform -chdir=terraform/billing providers lock -platform=linux_amd64 -platform=darwin_arm64
```

CI initializes with `-lockfile=readonly`, so it cannot add a missing platform's
package checksum before validation.

## Explicit production rollout

Creating or merging this PR deploys no billing resources. This stack has
validation CI only; production application is an operator action.

Run from this repository's root with authenticated Google credentials (ADC or
`GOOGLE_OAUTH_ACCESS_TOKEN`). The caller needs budget management on billing
account `01F66B-B18158-2731DE`, project infrastructure/IAM management, and access
to `story-6f89f-terraform-state`. The project already has Cloud Run, Functions,
Build, Artifact Registry, Pub/Sub, IAM, Logging, Storage and Cloud Billing APIs
enabled. The stack manages Budget API enablement as well.

```sh
terraform -chdir=terraform/billing init
terraform -chdir=terraform/billing plan -out=budget.tfplan
terraform -chdir=terraform/billing apply budget.tfplan
```

Review the plan: it must import/update the existing budget, provision the new
notification path, and leave application resources and the old shutdown path
untouched. The budget may switch topics before the new function finishes
building, so do this cutover while reported spend is safely below USD 50.

Verify the function is ACTIVE, an unauthenticated POST is refused by IAM, and
a zero-cost Pub/Sub test reaches it. This command is deliberately below the
shutdown threshold and uses the real budget's identifiers:

```sh
python3 - <<'PY'
from datetime import datetime
import json
import subprocess
from zoneinfo import ZoneInfo

start = datetime.now(ZoneInfo("America/Los_Angeles")).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
message = {"costAmount": 0, "budgetAmount": 50, "currencyCode": "USD",
           "budgetAmountType": "SPECIFIED_AMOUNT", "costIntervalStart": start.isoformat()}
subprocess.run(["gcloud", "pubsub", "topics", "publish", "story-monthly-budget",
                "--project=story-6f89f", "--message=" + json.dumps(message),
                "--attribute=billingAccountId=01F66B-B18158-2731DE,budgetId=b9ee89dc-1af4-4bb7-845f-9b5ac92fb73e,schemaVersion=1.0"], check=True)
PY
```

Confirm the new service logs `status=below_budget` for `project=story-6f89f`.
Never test the deployed function with a synthetic amount at or above USD 50.
The local tests cover the actual shutdown branch using mocks.

Then retire the unmanaged legacy subscription, topic and Cloud Run service:

```sh
python3 terraform/billing/retire_legacy.py            # verify and preview
python3 terraform/billing/retire_legacy.py --execute  # verify again, then delete
```

The retirement helper refuses to delete anything until the budget, runtime,
subscription and successful delivery are verified and the old topic has no
other budget/consumer. It retains the adopted budget; there is no duplicate
budget to delete. It leaves legacy service accounts, shared APIs, state buckets
and image/source repositories untouched because they may be shared. The old
function used `PROJECT_ID=story` instead of the real ID and acknowledged failed
Billing API operations, so it must not remain the active shutdown path.

If billing is disabled by a real notification, investigate the spending before
manually reattaching the billing account. Increasing the budget alone does not
restore services. Keep the operator's recovery instructions outside this
project as well, since disabling billing can affect access to its resources.
