output "raw_bucket_name" {
  value       = google_storage_bucket.raw_documents.name
  description = "Raw PDF upload bucket."
}

output "app_service_account_email" {
  value       = google_service_account.app.email
  description = "Cloud Run app service account."
}

output "ingestion_service_account_email" {
  value       = google_service_account.ingestion.email
  description = "Cloud Function ingestion service account."
}

output "vector_chunks_bucket_name" {
  value       = google_storage_bucket.vector_chunks.name
  description = "Bucket containing retrievable chunk payloads keyed by Vector Search datapoint ID."
}

output "vector_search_index_name" {
  value       = google_vertex_ai_index.documents.name
  description = "Vertex AI Vector Search index resource name."
}

output "vector_search_index_endpoint_name" {
  value       = google_vertex_ai_index_endpoint.documents.name
  description = "Vertex AI Vector Search index endpoint resource name."
}

output "vector_search_public_endpoint_domain_name" {
  value       = google_vertex_ai_index_endpoint.documents.public_endpoint_domain_name
  description = "Public domain name used to query the Vertex AI Vector Search endpoint."
}

output "vector_search_deployed_index_id" {
  value       = var.vector_search_deployed_index_id
  description = "Deployed index ID used for Vector Search queries."
}

output "bigquery_dataset_id" {
  value       = google_bigquery_dataset.llm_ops.dataset_id
  description = "BigQuery telemetry dataset ID."
}

output "bigquery_table_id" {
  value       = google_bigquery_table.prompt_logs.table_id
  description = "BigQuery telemetry table ID."
}

output "artifact_registry_repository" {
  value       = google_artifact_registry_repository.app.name
  description = "Artifact Registry repository resource name."
}

output "cloud_run_service_name" {
  value       = google_cloud_run_v2_service.app.name
  description = "Cloud Run service name."
}

output "cloud_run_service_uri" {
  value       = google_cloud_run_v2_service.app.uri
  description = "Cloud Run service URI."
}
