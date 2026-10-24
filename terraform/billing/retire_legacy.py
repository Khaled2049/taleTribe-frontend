"""Run manually after deploying and verifying the replacement; never run by CI."""

import argparse
import json
from pathlib import Path
import subprocess
import urllib.request

LEGACY_TOPIC = "budget-alert-topic"
LEGACY_SUBSCRIPTION = "billing-kill-switch-sub"
LEGACY_FUNCTION = "billing-kill-switch-func"
LEGACY_REGION = "europe-west1"
SHUTDOWN_PERMISSIONS = ["resourcemanager.projects.deleteBillingAssignment", "resourcemanager.projects.get"]


def read(*args):
    return json.loads(subprocess.check_output(["gcloud", *args, "--format=json"], text=True))


def terraform_config():
    output = subprocess.check_output(
        ["terraform", f"-chdir={Path(__file__).resolve().parent}", "output", "-json", "retirement_config"], text=True)
    return json.loads(output)


def runtime_token(account):
    return subprocess.check_output(
        ["gcloud", "auth", "print-access-token", f"--impersonate-service-account={account}"], text=True).strip()


def call(url, token, body=None):
    request = urllib.request.Request(
        url, data=None if body is None else json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.loads(response.read())


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def verify_runtime_can_shut_down(config):
    # A below_budget log never reaches IAM or the Billing API, so prove both
    # as the runtime identity, read-only, before removing the fallback.
    project, token = config["project_id"], runtime_token(config["runtime_account"])
    granted = call(f"https://cloudresourcemanager.googleapis.com/v1/projects/{project}:testIamPermissions",
                   token, {"permissions": SHUTDOWN_PERMISSIONS}).get("permissions", [])
    require(sorted(granted) == sorted(SHUTDOWN_PERMISSIONS), "Runtime identity lacks shutdown permissions")
    info = call(f"https://cloudbilling.googleapis.com/v1/projects/{project}/billingInfo", token)
    require(info.get("billingAccountName") == f"billingAccounts/{config['billing_account_id']}",
            "Runtime identity cannot read the expected billing account")


def legacy_function_command(project):
    common = [f"--region={LEGACY_REGION}", f"--project={project}", "--quiet"]
    try:
        legacy = read("functions", "describe", LEGACY_FUNCTION, f"--region={LEGACY_REGION}", f"--project={project}")
    except subprocess.CalledProcessError:
        # Not a Cloud Function; confirm it is a plain Cloud Run service before deleting it as one.
        read("run", "services", "describe", LEGACY_FUNCTION, f"--region={LEGACY_REGION}", f"--project={project}")
        return ["gcloud", "run", "services", "delete", LEGACY_FUNCTION, *common]
    generation = ["--gen2"] if legacy.get("environment") == "GEN_2" else []
    return ["gcloud", "functions", "delete", LEGACY_FUNCTION, *generation, *common]


def retirement_commands():
    config = terraform_config()
    project = config["project_id"]
    budgets = read("billing", "budgets", "list", f"--billing-account={config['billing_account_id']}")
    budget = next(b for b in budgets if b["name"].endswith(f"/budgets/{config['budget_id']}"))
    budget_units = str(int(config["monthly_budget_usd"]))
    require(budget["amount"]["specifiedAmount"] == {"currencyCode": "USD", "units": budget_units},
            f"Budget must be USD {budget_units}")
    require(budget["budgetFilter"]["projects"] == [f"projects/{config['project_number']}"], "Unexpected budget scope")
    require(budget["budgetFilter"]["creditTypesTreatment"] == "EXCLUDE_ALL_CREDITS", "Unexpected credit treatment")
    topic = config["topic"]
    require(budget["notificationsRule"]["pubsubTopic"] == topic, "Budget has not switched topics")
    function = read("functions", "describe", config["function"], "--gen2",
                    f"--region={config['region']}", f"--project={project}")
    require(function["state"] == "ACTIVE", "Replacement is not active")
    env = function["serviceConfig"]["environmentVariables"]
    require(env["PROJECT_ID"] == project and env["MONTHLY_BUDGET_USD"] == budget_units
            and env["EXPECTED_BUDGET_ID"] == config["budget_id"], "Incorrect shutdown configuration")
    subscription = read("pubsub", "subscriptions", "describe", config["subscription"], f"--project={project}")
    require(subscription["topic"] == topic, "Incorrect subscription topic")
    require(subscription["pushConfig"]["pushEndpoint"] == function["serviceConfig"]["uri"], "Incorrect subscription endpoint")
    require(subscription["pushConfig"]["oidcToken"]["serviceAccountEmail"] == config["push_account"], "Incorrect push identity")
    logs = read("logging", "read",
                f'resource.type="cloud_run_revision" AND resource.labels.service_name="{config["function"]}" '
                f'AND jsonPayload.status="below_budget" AND jsonPayload.project="{project}"',
                f"--project={project}", "--freshness=1d", "--limit=1")
    require(logs, "Verify a real or zero-cost test notification through the new subscription first")
    verify_runtime_can_shut_down(config)
    old_topic = f"projects/{project}/topics/{LEGACY_TOPIC}"
    for other in budgets:
        require(other.get("notificationsRule", {}).get("pubsubTopic") != old_topic, "A budget still uses the old topic")
    old_subscriptions = read("pubsub", "subscriptions", "list", f"--project={project}")
    require(all(s["name"].endswith(f"/{LEGACY_SUBSCRIPTION}") for s in old_subscriptions
                if s["topic"] == old_topic), "Old topic has another consumer")
    return [
        ["gcloud", "pubsub", "subscriptions", "delete", LEGACY_SUBSCRIPTION, f"--project={project}", "--quiet"],
        ["gcloud", "pubsub", "topics", "delete", LEGACY_TOPIC, f"--project={project}", "--quiet"],
        legacy_function_command(project),
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
