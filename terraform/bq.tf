resource "google_bigquery_dataset" "llm_ops" {
  dataset_id                 = "llm_ops_telemetry"
  friendly_name              = "LLMOps Telemetry"
  description                = "Prompt and response telemetry for the Enterprise GenAI RAG blueprint."
  location                   = var.region
  delete_contents_on_destroy = var.force_destroy
  labels                     = local.labels

  depends_on = [google_project_service.required]
}

resource "google_bigquery_table" "prompt_logs" {
  dataset_id          = google_bigquery_dataset.llm_ops.dataset_id
  table_id            = "prompt_logs"
  deletion_protection = false
  labels              = local.labels

  schema = jsonencode([
    { name = "log_id", type = "STRING", mode = "REQUIRED" },
    { name = "timestamp", type = "TIMESTAMP", mode = "REQUIRED" },
    { name = "user_id", type = "STRING", mode = "REQUIRED" },
    { name = "prompt", type = "STRING", mode = "REQUIRED" },
    { name = "response", type = "STRING", mode = "REQUIRED" },
    { name = "prompt_tokens", type = "INTEGER", mode = "NULLABLE" },
    { name = "completion_tokens", type = "INTEGER", mode = "NULLABLE" },
    { name = "latency_ms", type = "INTEGER", mode = "REQUIRED" },
    { name = "status", type = "STRING", mode = "REQUIRED" }
  ])
}
