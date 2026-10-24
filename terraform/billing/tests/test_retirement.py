from copy import deepcopy
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import retire_legacy


class RetirementTests(unittest.TestCase):
    def setUp(self):
        self.budget = {
            "name": "billingAccounts/account/budgets/b9ee89dc-1af4-4bb7-845f-9b5ac92fb73e",
            "amount": {"specifiedAmount": {"currencyCode": "USD", "units": "50"}},
            "budgetFilter": {"projects": ["projects/793308156964"], "creditTypesTreatment": "EXCLUDE_ALL_CREDITS"},
            "notificationsRule": {"pubsubTopic": "projects/story-6f89f/topics/story-monthly-budget"},
        }
        self.function = {
            "state": "ACTIVE", "serviceConfig": {
                "uri": "https://example.run.app",
                "environmentVariables": {"PROJECT_ID": "story-6f89f", "MONTHLY_BUDGET_USD": "50"},
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
        if args[:2] == ("functions", "describe"):
            return self.function
        if args[:3] == ("pubsub", "subscriptions", "describe"):
            return self.subscription
        if args[:2] == ("logging", "read"):
            return self.logs
        if args[:3] == ("pubsub", "subscriptions", "list"):
            return self.old_subscriptions
        raise AssertionError(args)

    def test_verified_replacement_only_previews_three_legacy_resources(self):
        with patch.object(retire_legacy, "read", side_effect=self.read), patch.object(retire_legacy.subprocess, "run") as run:
            commands = retire_legacy.retirement_commands()
            self.assertEqual(len(commands), 3)
            self.assertEqual([c[4] for c in commands], ["billing-kill-switch-sub", "budget-alert-topic", "billing-kill-switch-func"])
            run.assert_not_called()

    def test_unverified_delivery_and_wrong_target_block_retirement(self):
        with patch.object(retire_legacy, "read", side_effect=self.read):
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
        with patch.object(retire_legacy, "read", side_effect=self.read):
            with self.assertRaisesRegex(RuntimeError, "still uses"):
                retire_legacy.retirement_commands()

    def test_shared_old_topic_blocks_retirement(self):
        self.old_subscriptions = [{"name": "projects/story-6f89f/subscriptions/another-consumer", "topic": "projects/story-6f89f/topics/budget-alert-topic"}]
        with patch.object(retire_legacy, "read", side_effect=self.read):
            with self.assertRaisesRegex(RuntimeError, "another consumer"):
                retire_legacy.retirement_commands()


if __name__ == "__main__":
    unittest.main()
