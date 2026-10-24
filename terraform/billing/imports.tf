# Adopt the console-created budget rather than creating a duplicate. Keep this
# block as a record of the migration; Terraform ignores it after adoption.
import {
  to = google_billing_budget.monthly
  id = "billingAccounts/${var.billing_account_id}/budgets/${var.budget_id}"
}
