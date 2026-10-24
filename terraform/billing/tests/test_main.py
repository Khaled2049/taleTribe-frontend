import base64
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "function"))
import main


class ShutdownTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {
            "PROJECT_ID": "story-6f89f",
            "BILLING_ACCOUNT_ID": "test-account",
            "EXPECTED_BUDGET_ID": "test-budget",
            "MONTHLY_BUDGET_USD": "50",
        })
        self.env.start()
        self.addCleanup(self.env.stop)
        now = datetime.now(timezone.utc).astimezone(main.ZoneInfo("America/Los_Angeles"))
        self.data = {
            "budgetAmount": 50,
            "budgetAmountType": "SPECIFIED_AMOUNT",
            "currencyCode": "USD",
            "costAmount": 50,
            "costIntervalStart": now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat(),
        }
        self.attributes = {
            "billingAccountId": "test-account", "budgetId": "test-budget", "schemaVersion": "1.0",
        }

    def request(self):
        envelope = {"message": {
            "attributes": self.attributes,
            "data": base64.b64encode(json.dumps(self.data).encode()).decode(),
        }}
        return Mock(method="POST", get_json=Mock(return_value=envelope))

    def test_below_budget_and_forecast_do_not_disable_billing(self):
        self.data.update(costAmount=49.99, forecastThresholdExceeded=1.5)
        with patch.object(main, "disable_billing") as disable:
            self.assertEqual(main.stop_billing(self.request()), ({"status": "below_budget"}, 200))
            disable.assert_not_called()

    def test_exactly_at_or_above_budget_targets_configured_project(self):
        for cost in (50, 50.01):
            with self.subTest(cost=cost), patch.object(main, "disable_billing", return_value="billing_disabled") as disable:
                self.data["costAmount"] = cost
                self.assertEqual(main.stop_billing(self.request()), ({"status": "billing_disabled"}, 200))
                disable.assert_called_once_with("story-6f89f")

    def test_foreign_account_budget_and_schema_are_ignored(self):
        for key in self.attributes:
            with self.subTest(key=key), patch.dict(self.attributes, {key: "other"}), patch.object(main, "disable_billing") as disable:
                self.assertEqual(main.stop_billing(self.request())[0]["status"], "ignored_notification")
                disable.assert_not_called()

    def test_stale_limit_currency_and_previous_period_are_ignored(self):
        for change in ({"budgetAmount": 100}, {"currencyCode": "EUR"},
                       {"budgetAmountType": "LAST_MONTH_COST"},
                       {"costIntervalStart": "2020-01-01T08:00:00Z"}):
            with self.subTest(change=change), patch.dict(self.data, change), patch.object(main, "disable_billing") as disable:
                self.assertEqual(main.stop_billing(self.request())[0]["status"], "ignored_notification")
                disable.assert_not_called()

    def test_malformed_and_nonfinite_amounts_never_disable(self):
        for value in ("NaN", "Infinity", -1, "not-money", None):
            with self.subTest(value=value), patch.object(main, "disable_billing") as disable:
                self.data["costAmount"] = value
                self.assertEqual(main.stop_billing(self.request())[0]["status"], "invalid_notification")
                disable.assert_not_called()
        for envelope in (None, {}, {"message": {"attributes": self.attributes, "data": "!bad!"}}):
            request = Mock(method="POST", get_json=Mock(return_value=envelope))
            with self.subTest(envelope=envelope), patch.object(main, "disable_billing") as disable:
                self.assertEqual(main.stop_billing(request)[0]["status"], "invalid_notification")
                disable.assert_not_called()

    def test_invalid_configuration_is_retryable(self):
        with patch.dict(os.environ, {"MONTHLY_BUDGET_USD": "0"}), patch.object(main, "disable_billing") as disable:
            self.assertEqual(main.stop_billing(self.request())[1], 500)
            disable.assert_not_called()

    def test_billing_api_failure_requests_pubsub_retry(self):
        with patch.object(main, "disable_billing", side_effect=RuntimeError("temporary outage")):
            self.assertEqual(main.stop_billing(self.request())[1], 500)

    def test_shutdown_is_idempotent_when_billing_is_already_disabled(self):
        session = Mock()
        session.get.return_value.json.return_value = {"billingEnabled": False}
        with patch.object(main, "billing_session", return_value=session):
            self.assertEqual(main.disable_billing("story-6f89f"), "already_disabled")
            session.put.assert_not_called()

    def test_account_change_is_not_disabled(self):
        session = Mock()
        session.get.return_value.json.return_value = {
            "billingEnabled": True, "billingAccountName": "billingAccounts/other",
        }
        with patch.object(main, "billing_session", return_value=session):
            with self.assertRaises(ValueError):
                main.disable_billing("story-6f89f")
            session.put.assert_not_called()

    def test_disable_uses_correct_project_and_empty_billing_account(self):
        session = Mock()
        session.get.return_value.json.return_value = {
            "billingEnabled": True, "billingAccountName": "billingAccounts/test-account",
        }
        session.put.return_value.json.return_value = {"billingEnabled": False}
        with patch.object(main, "billing_session", return_value=session):
            self.assertEqual(main.disable_billing("story-6f89f"), "billing_disabled")
            session.put.assert_called_once_with(
                "https://cloudbilling.googleapis.com/v1/projects/story-6f89f/billingInfo",
                json={"billingAccountName": ""}, timeout=20,
            )
            session.put.return_value.raise_for_status.assert_called_once()

    def test_previous_month_retry_near_pacific_month_boundary(self):
        self.data["costIntervalStart"] = "2026-10-01T07:00:00Z"
        now = datetime(2026, 11, 1, 8, tzinfo=timezone.utc)
        self.assertIsNone(main.notification_cost(self.request().get_json(), now))


if __name__ == "__main__":
    unittest.main()
