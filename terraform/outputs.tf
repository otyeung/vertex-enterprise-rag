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

output "cloud_sql_instance_connection_name" {
  value       = google_sql_database_instance.postgres.connection_name
  description = "Cloud SQL instance connection name."
}

output "cloud_sql_private_ip" {
  value       = google_sql_database_instance.postgres.private_ip_address
  description = "Cloud SQL private IP address."
}

output "database_name" {
  value       = google_sql_database.app.name
  description = "Application database name."
}

output "database_user" {
  value       = google_sql_user.app_user.name
  description = "Application database user."
}

output "db_password_secret_id" {
  value       = google_secret_manager_secret.db_password.secret_id
  description = "Secret Manager secret ID for the database password."
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

output "vpc_connector_id" {
  value       = google_vpc_access_connector.serverless.id
  description = "Serverless VPC Access connector ID."
}
