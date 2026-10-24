output "budget_id" {
  value = google_billing_budget.monthly.id
}

output "shutdown_url" {
  value = google_cloudfunctions2_function.shutdown.service_config[0].uri
}

output "budget_topic" {
  value = google_pubsub_topic.budget.id
}

# Read by retire_legacy.py so its checks follow the variables.
output "retirement_config" {
  value = {
    project_id         = var.project_id
    project_number     = data.google_project.current.number
    billing_account_id = var.billing_account_id
    budget_id          = var.budget_id
    region             = var.region
    monthly_budget_usd = var.monthly_budget_usd
    function           = google_cloudfunctions2_function.shutdown.name
    topic              = google_pubsub_topic.budget.id
    subscription       = google_pubsub_subscription.shutdown.name
    push_account       = google_service_account.push.email
    runtime_account    = google_service_account.runtime.email
  }
}
