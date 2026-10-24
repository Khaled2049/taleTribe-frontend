# Adopt the console-created budget rather than creating a duplicate. Keep this
# block as a record of the migration; Terraform ignores it after adoption.
import {
  to = google_billing_budget.monthly
  id = "billingAccounts/01F66B-B18158-2731DE/budgets/b9ee89dc-1af4-4bb7-845f-9b5ac92fb73e"
}
