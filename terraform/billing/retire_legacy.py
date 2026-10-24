"""Run manually after deploying and verifying the replacement; never run by CI."""

import argparse
import json
import subprocess


def read(*args):
    return json.loads(subprocess.check_output(["gcloud", *args, "--format=json"], text=True))


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def retirement_commands():
    project = "story-6f89f"
    budgets = read("billing", "budgets", "list", "--billing-account=01F66B-B18158-2731DE")
    budget = next(b for b in budgets if b["name"].endswith("/b9ee89dc-1af4-4bb7-845f-9b5ac92fb73e"))
    require(budget["amount"]["specifiedAmount"] == {"currencyCode": "USD", "units": "50"}, "Budget must be USD 50")
    require(budget["budgetFilter"]["projects"] == ["projects/793308156964"], "Unexpected budget scope")
    require(budget["budgetFilter"]["creditTypesTreatment"] == "EXCLUDE_ALL_CREDITS", "Unexpected credit treatment")
    topic = f"projects/{project}/topics/story-monthly-budget"
    require(budget["notificationsRule"]["pubsubTopic"] == topic, "Budget has not switched topics")
    function = read("functions", "describe", "story-budget-shutdown", "--gen2", "--region=us-central1", f"--project={project}")
    require(function["state"] == "ACTIVE", "Replacement is not active")
    env = function["serviceConfig"]["environmentVariables"]
    require(env["PROJECT_ID"] == project and env["MONTHLY_BUDGET_USD"] == "50", "Incorrect shutdown configuration")
    subscription = read("pubsub", "subscriptions", "describe", "story-monthly-budget-shutdown", f"--project={project}")
    require(subscription["topic"] == topic, "Incorrect subscription topic")
    require(subscription["pushConfig"]["pushEndpoint"] == function["serviceConfig"]["uri"], "Incorrect subscription endpoint")
    require(subscription["pushConfig"]["oidcToken"]["serviceAccountEmail"] == f"story-budget-push@{project}.iam.gserviceaccount.com", "Incorrect push identity")
    logs = read("logging", "read",
                'resource.type="cloud_run_revision" AND resource.labels.service_name="story-budget-shutdown" '
                'AND jsonPayload.status="below_budget" AND jsonPayload.project="story-6f89f"',
                f"--project={project}", "--freshness=1d", "--limit=1")
    require(logs, "Verify a real or zero-cost test notification through the new subscription first")
    for other in budgets:
        require(other.get("notificationsRule", {}).get("pubsubTopic") != f"projects/{project}/topics/budget-alert-topic", "A budget still uses the old topic")
    old_subscriptions = read("pubsub", "subscriptions", "list", f"--project={project}")
    require(all(s["name"].endswith("/billing-kill-switch-sub") for s in old_subscriptions
                if s["topic"] == f"projects/{project}/topics/budget-alert-topic"), "Old topic has another consumer")
    return [
        ["gcloud", "pubsub", "subscriptions", "delete", "billing-kill-switch-sub", f"--project={project}", "--quiet"],
        ["gcloud", "pubsub", "topics", "delete", "budget-alert-topic", f"--project={project}", "--quiet"],
        ["gcloud", "run", "services", "delete", "billing-kill-switch-func", "--region=europe-west1", f"--project={project}", "--quiet"],
    ]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--execute", action="store_true", help="Delete the three legacy resources after verification")
    args = parser.parse_args()
    commands = retirement_commands()
    for command in commands:
        print(" ".join(command), flush=True)
        if args.execute:
            subprocess.run(command, check=True)
