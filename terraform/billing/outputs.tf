output "budget_id" {
  value = google_billing_budget.monthly.id
}

output "shutdown_url" {
  value = google_cloudfunctions2_function.shutdown.service_config[0].uri
}

output "budget_topic" {
  value = google_pubsub_topic.budget.id
}
