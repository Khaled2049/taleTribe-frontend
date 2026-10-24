"""Authenticated Pub/Sub push endpoint for one project's monthly budget."""

import base64
import binascii
from datetime import datetime
from decimal import Decimal, InvalidOperation
from functools import lru_cache
import json
import logging
import os
from zoneinfo import ZoneInfo


class AccountChanged(Exception):
    """The project moved billing accounts; retrying cannot make shutdown safe."""


def _amount(value):
    amount = Decimal(str(value))
    if not amount.is_finite() or amount < 0:
        raise ValueError("Invalid amount")
    return amount


def notification_cost(envelope, now):
    """Return actual spend for this month's matching budget, or ignore it."""
    message = envelope["message"]
    attributes = message["attributes"]
    if not isinstance(attributes, dict):
        raise ValueError("Invalid message attributes")
    if (
        attributes.get("billingAccountId") != os.environ["BILLING_ACCOUNT_ID"]
        or attributes.get("budgetId") != os.environ["EXPECTED_BUDGET_ID"]
        or attributes.get("schemaVersion") != "1.0"
    ):
        return None
    data = json.loads(base64.b64decode(message["data"], validate=True))
    if not isinstance(data, dict):
        raise ValueError("Invalid budget data")
    if data.get("currencyCode") != "USD" or data.get("budgetAmountType") != "SPECIFIED_AMOUNT":
        return None
    if _amount(data["budgetAmount"]) != _amount(os.environ["MONTHLY_BUDGET_USD"]):
        return None  # Ignore a delayed notification from before a budget change.
    start = datetime.fromisoformat(data["costIntervalStart"].replace("Z", "+00:00"))
    if start.tzinfo is None:
        raise ValueError("Budget period must include a timezone")
    start = start.astimezone(ZoneInfo("America/Los_Angeles"))
    current = now.astimezone(ZoneInfo("America/Los_Angeles"))
    if (start.year, start.month, start.day) != (current.year, current.month, 1):
        return None  # A retry from last month must not shut down this month.
    return _amount(data["costAmount"])


@lru_cache(maxsize=1)
def billing_session():
    # Lazy import keeps decision tests independent of credentials and SDKs.
    import google.auth
    from google.auth.transport.requests import AuthorizedSession

    credentials, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
    return AuthorizedSession(credentials)


def disable_billing(project_id):
    session = billing_session()
    url = f"https://cloudbilling.googleapis.com/v1/projects/{project_id}/billingInfo"
    response = session.get(url, timeout=20)
    response.raise_for_status()
    info = response.json()
    if not info.get("billingEnabled", False):
        return "already_disabled"
    expected = f"billingAccounts/{os.environ['BILLING_ACCOUNT_ID']}"
    if info.get("billingAccountName") != expected:
        raise AccountChanged("Project billing account changed; refusing a stale shutdown")
    response = session.put(url, json={"billingAccountName": ""}, timeout=20)
    response.raise_for_status()
    if response.json().get("billingEnabled", False):
        raise RuntimeError("Billing API did not disable billing")
    return "billing_disabled"


def stop_billing(request):
    if request.method != "POST":
        return {"error": "POST required"}, 405
    try:
        project = os.environ["PROJECT_ID"]
        limit = _amount(os.environ["MONTHLY_BUDGET_USD"])
        # Checked here so a missing value is a retryable 500, not a discarded notification.
        if not (project and os.environ["BILLING_ACCOUNT_ID"] and os.environ["EXPECTED_BUDGET_ID"]) or limit <= 0:
            raise ValueError("Missing configuration or positive budget")
    except (KeyError, ValueError, InvalidOperation):
        logging.exception("Invalid shutdown configuration")
        return {"error": "invalid configuration"}, 500
    try:
        cost = notification_cost(request.get_json(silent=True), datetime.now(ZoneInfo("UTC")))
    except (KeyError, TypeError, ValueError, InvalidOperation, binascii.Error):
        logging.warning("Discarded malformed budget notification")
        # A malformed message cannot become valid through retries. Acknowledge
        # it without invoking the Billing API; log the failure for operators.
        return {"status": "invalid_notification"}, 200
    if cost is None:
        status = "ignored_notification"
    elif cost < limit:
        status = "below_budget"
    else:
        try:
            status = disable_billing(project)
        except AccountChanged:
            logging.error("Billing account changed; acknowledging without shutdown")
            status = "account_changed"
        except Exception:
            # A 5xx makes Pub/Sub retry; the legacy handler swallowed errors.
            logging.exception("Project billing shutdown failed")
            return {"error": "billing shutdown failed"}, 500
    print(json.dumps({"status": status, "project": project, "cost": str(cost) if cost is not None else None}), flush=True)
    return {"status": status}, 200
