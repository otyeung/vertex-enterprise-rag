resource "google_service_account" "ingestion" {
  account_id   = "${var.name_prefix}-ingestion"
  display_name = "Enterprise RAG ingestion runtime"
}

resource "google_service_account" "app" {
  account_id   = "${var.name_prefix}-app"
  display_name = "Enterprise RAG Cloud Run runtime"
}

locals {
  ingestion_project_roles = toset([
    "roles/aiplatform.user",
    "roles/cloudsql.client",
    "roles/eventarc.eventReceiver",
    "roles/logging.logWriter",
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
