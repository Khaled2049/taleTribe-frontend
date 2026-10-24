from contextlib import ExitStack
from copy import deepcopy
from pathlib import Path
import sys
import unittest
import subprocess
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import retire_legacy


class RetirementTests(unittest.TestCase):
    def setUp(self):
        self.config = {
            "project_id": "story-6f89f", "project_number": "793308156964",
            "billing_account_id": "account", "budget_id": "b9ee89dc-1af4-4bb7-845f-9b5ac92fb73e",
            "region": "us-central1", "monthly_budget_usd": 50, "function": "story-budget-shutdown",
            "topic": "projects/story-6f89f/topics/story-monthly-budget",
            "subscription": "story-monthly-budget-shutdown",
            "push_account": "story-budget-push@story-6f89f.iam.gserviceaccount.com",
            "runtime_account": "story-budget-runtime@story-6f89f.iam.gserviceaccount.com",
        }
        self.granted = list(retire_legacy.SHUTDOWN_PERMISSIONS)
        self.billing_info = {"billingEnabled": True, "billingAccountName": "billingAccounts/account"}
        self.legacy = {"environment": "GEN_2"}
        self.budget = {
            "name": "billingAccounts/account/budgets/b9ee89dc-1af4-4bb7-845f-9b5ac92fb73e",
            "amount": {"specifiedAmount": {"currencyCode": "USD", "units": "50"}},
            "budgetFilter": {"projects": ["projects/793308156964"], "creditTypesTreatment": "EXCLUDE_ALL_CREDITS"},
            "notificationsRule": {"pubsubTopic": "projects/story-6f89f/topics/story-monthly-budget"},
        }
        self.function = {
            "state": "ACTIVE", "serviceConfig": {
                "uri": "https://example.run.app",
                "environmentVariables": {
                    "PROJECT_ID": "story-6f89f", "MONTHLY_BUDGET_USD": "50",
                    "EXPECTED_BUDGET_ID": "b9ee89dc-1af4-4bb7-845f-9b5ac92fb73e",
                },
            },
        }
        self.subscription = {
            "topic": "projects/story-6f89f/topics/story-monthly-budget",
            "pushConfig": {"pushEndpoint": "https://example.run.app", "oidcToken": {
                "serviceAccountEmail": "story-budget-push@story-6f89f.iam.gserviceaccount.com",
            }},
        }
        self.logs = [{"jsonPayload": {"status": "below_budget"}}]
        self.budgets = [self.budget]
        self.old_subscriptions = []

    def read(self, *args):
        if args[:3] == ("billing", "budgets", "list"):
            return self.budgets
        if args[:3] == ("functions", "describe", retire_legacy.LEGACY_FUNCTION):
            if self.legacy is None:
                raise subprocess.CalledProcessError(1, args)
            return self.legacy
        if args[:3] == ("run", "services", "describe"):
            return {}
        if args[:2] == ("functions", "describe"):
            return self.function
        if args[:3] == ("pubsub", "subscriptions", "describe"):
            return self.subscription
        if args[:2] == ("logging", "read"):
            return self.logs
        if args[:3] == ("pubsub", "subscriptions", "list"):
            return self.old_subscriptions
        raise AssertionError(args)

    def call(self, url, token, body=None):
        self.assertEqual(token, "runtime-token")
        if url.endswith(":testIamPermissions"):
            return {"permissions": self.granted}
        if url.endswith("/billingInfo"):
            return self.billing_info
        raise AssertionError(url)

    def patched(self):
        stack = ExitStack()
        stack.enter_context(patch.object(retire_legacy, "read", side_effect=self.read))
        stack.enter_context(patch.object(retire_legacy, "call", side_effect=self.call))
        stack.enter_context(patch.object(retire_legacy, "terraform_config", return_value=self.config))
        stack.enter_context(patch.object(retire_legacy, "runtime_token", return_value="runtime-token"))
        return stack

    def test_verified_replacement_only_previews_three_legacy_resources(self):
        with self.patched(), patch.object(retire_legacy.subprocess, "run") as run:
            commands = retire_legacy.retirement_commands()
            self.assertEqual(len(commands), 3)
            self.assertEqual([c[4] for c in commands[:2]], ["billing-kill-switch-sub", "budget-alert-topic"])
            self.assertEqual(commands[2][:5], ["gcloud", "functions", "delete", "billing-kill-switch-func", "--gen2"])
            run.assert_not_called()

    def test_legacy_target_is_deleted_as_the_kind_of_resource_it_is(self):
        for legacy, prefix in (({"environment": "GEN_1"}, ["gcloud", "functions", "delete", "billing-kill-switch-func", "--region=europe-west1"]),
                               (None, ["gcloud", "run", "services", "delete", "billing-kill-switch-func"])):
            self.legacy = legacy
            with self.subTest(legacy=legacy), self.patched():
                command = retire_legacy.retirement_commands()[2]
                self.assertEqual(command[:len(prefix)], prefix)

    def test_runtime_identity_must_be_able_to_shut_down(self):
        self.granted = ["resourcemanager.projects.get"]
        with self.patched(), self.assertRaisesRegex(RuntimeError, "permissions"):
            retire_legacy.retirement_commands()
        self.granted = list(retire_legacy.SHUTDOWN_PERMISSIONS)
        self.billing_info = {"billingEnabled": True, "billingAccountName": "billingAccounts/other"}
        with self.patched(), self.assertRaisesRegex(RuntimeError, "billing account"):
            retire_legacy.retirement_commands()

    def test_checks_follow_terraform_configuration(self):
        self.config["monthly_budget_usd"] = 75
        with self.patched(), self.assertRaisesRegex(RuntimeError, "USD 75"):
            retire_legacy.retirement_commands()

    def test_unverified_delivery_and_wrong_target_block_retirement(self):
        with self.patched():
            self.logs = []
            with self.assertRaisesRegex(RuntimeError, "notification"):
                retire_legacy.retirement_commands()
            self.function["serviceConfig"]["environmentVariables"]["PROJECT_ID"] = "story"
            with self.assertRaisesRegex(RuntimeError, "configuration"):
                retire_legacy.retirement_commands()

    def test_old_budget_topic_blocks_retirement(self):
        other = deepcopy(self.budget)
        other["name"] = "billingAccounts/account/budgets/other"
        other["notificationsRule"]["pubsubTopic"] = "projects/story-6f89f/topics/budget-alert-topic"
        self.budgets.append(other)
        with self.patched():
            with self.assertRaisesRegex(RuntimeError, "still uses"):
                retire_legacy.retirement_commands()

    def test_shared_old_topic_blocks_retirement(self):
        self.old_subscriptions = [{"name": "projects/story-6f89f/subscriptions/another-consumer", "topic": "projects/story-6f89f/topics/budget-alert-topic"}]
        with self.patched():
            with self.assertRaisesRegex(RuntimeError, "another consumer"):
                retire_legacy.retirement_commands()


if __name__ == "__main__":
    unittest.main()
