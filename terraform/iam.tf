resource "google_service_account" "ingestion" {
  account_id   = "${var.name_prefix}-ingestion"
  display_name = "Enterprise RAG ingestion runtime"
}

resource "google_service_account" "app" {
  account_id   = "${var.name_prefix}-app"
  display_name = "Enterprise RAG Cloud Run runtime"
}

data "google_storage_project_service_account" "gcs_account" {
  project = var.project_id

  depends_on = [google_project_service.required]
}

locals {
  ingestion_project_roles = toset([
    "roles/aiplatform.user",
    "roles/cloudsql.client",
    "roles/eventarc.eventReceiver",
    "roles/logging.logWriter",
    "roles/run.invoker",
    "roles/secretmanager.secretAccessor"
  ])

  app_project_roles = toset([
    "roles/aiplatform.user",
    "roles/bigquery.dataEditor",
    "roles/bigquery.jobUser",
    "roles/cloudsql.client",
    "roles/logging.logWriter",
    "roles/secretmanager.secretAccessor"
  ])
}

resource "google_project_iam_member" "ingestion_roles" {
  for_each = local.ingestion_project_roles

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.ingestion.email}"
}

resource "google_project_iam_member" "app_roles" {
  for_each = local.app_project_roles

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.app.email}"
}

resource "google_storage_bucket_iam_member" "ingestion_raw_pdf_viewer" {
  bucket = google_storage_bucket.raw_documents.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.ingestion.email}"
}

resource "google_secret_manager_secret_iam_member" "ingestion_db_password" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.db_password.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.ingestion.email}"
}

resource "google_secret_manager_secret_iam_member" "app_db_password" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.db_password.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.app.email}"
}

# Eventarc Gen2 GCS trigger prerequisites:
# The Cloud Storage service agent needs Pub/Sub publisher role to publish events
# for Eventarc GCS triggers to work.
resource "google_project_iam_member" "gcs_eventarc_pubsub" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${data.google_storage_project_service_account.gcs_account.email_address}"
}

resource "google_project_iam_member" "eventarc_service_agent" {
  project = var.project_id
  role    = "roles/eventarc.serviceAgent"
  member  = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-eventarc.iam.gserviceaccount.com"
}
