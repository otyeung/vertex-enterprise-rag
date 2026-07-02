terraform {
  required_version = ">= 1.6.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.30"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

data "google_project" "current" {
  project_id = var.project_id
}

locals {
  labels = {
    app         = "vertex-enterprise-rag"
    environment = var.environment
  }

  services = toset([
    "aiplatform.googleapis.com",
    "artifactregistry.googleapis.com",
    "bigquery.googleapis.com",
    "cloudbuild.googleapis.com",
    "cloudfunctions.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "eventarc.googleapis.com",
    "run.googleapis.com",
    "storage.googleapis.com",
  ])
}

resource "google_project_service" "required" {
  for_each = local.services

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_storage_bucket" "raw_documents" {
  name                        = "${var.project_id}-${var.name_prefix}-raw-pdfs"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = var.force_destroy
  labels                      = local.labels

  depends_on = [google_project_service.required]
}

resource "google_storage_bucket" "vector_chunks" {
  name                        = "${var.project_id}-${var.name_prefix}-vector-chunks"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = var.force_destroy
  labels                      = local.labels

  depends_on = [google_project_service.required]
}

resource "google_storage_bucket_object" "vector_index_bootstrap" {
  name         = "indexes/bootstrap/data.json"
  bucket       = google_storage_bucket.vector_chunks.name
  content_type = "application/json"
  content = "${jsonencode({
    id        = "__bootstrap__"
    embedding = [for _ in range(var.embedding_dimensions) : 0]
  })}\n"
}

resource "google_vertex_ai_index" "documents" {
  region              = var.region
  display_name        = "${var.name_prefix}-documents"
  description         = "Streaming Vertex AI Vector Search index for enterprise document chunks."
  labels              = local.labels
  index_update_method = "STREAM_UPDATE"

  metadata {
    contents_delta_uri = "gs://${google_storage_bucket.vector_chunks.name}/indexes/bootstrap"

    config {
      dimensions                  = var.embedding_dimensions
      approximate_neighbors_count = var.vector_search_approximate_neighbors_count
      distance_measure_type       = "DOT_PRODUCT_DISTANCE"

      algorithm_config {
        tree_ah_config {
          leaf_node_embedding_count    = var.vector_search_leaf_node_embedding_count
          leaf_nodes_to_search_percent = var.vector_search_leaf_nodes_to_search_percent
        }
      }
    }
  }

  timeouts {
    create = "2h"
    update = "1h"
    delete = "1h"
  }

  depends_on = [
    google_project_service.required,
    google_storage_bucket_object.vector_index_bootstrap
  ]
}

resource "google_vertex_ai_index_endpoint" "documents" {
  region                  = var.region
  display_name            = "${var.name_prefix}-documents-endpoint"
  description             = "Vertex AI Vector Search endpoint for enterprise document retrieval."
  public_endpoint_enabled = true
  labels                  = local.labels

  depends_on = [google_project_service.required]
}

resource "google_vertex_ai_index_endpoint_deployed_index" "documents" {
  index_endpoint        = google_vertex_ai_index_endpoint.documents.id
  index                 = google_vertex_ai_index.documents.id
  deployed_index_id     = var.vector_search_deployed_index_id
  display_name          = "${var.name_prefix}-enterprise-documents"
  enable_access_logging = true

  automatic_resources {
    min_replica_count = var.vector_search_min_replica_count
    max_replica_count = var.vector_search_max_replica_count
  }

  timeouts {
    create = "2h"
    update = "1h"
    delete = "1h"
  }
}

resource "google_artifact_registry_repository" "app" {
  location      = var.region
  repository_id = "${var.name_prefix}-app"
  description   = "Cloud Run application images for the Enterprise GenAI RAG blueprint."
  format        = "DOCKER"
  labels        = local.labels

  depends_on = [google_project_service.required]
}

resource "google_cloud_run_v2_service" "app" {
  name     = "${var.name_prefix}-app"
  location = var.region
  ingress  = var.cloud_run_ingress
  labels   = local.labels

  template {
    service_account                  = google_service_account.app.email
    execution_environment            = "EXECUTION_ENVIRONMENT_GEN2"
    max_instance_request_concurrency = 20
    timeout                          = "300s"

    scaling {
      min_instance_count = 0
      max_instance_count = 5
    }

    containers {
      image = var.bootstrap_image

      ports {
        container_port = 8080
      }

      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "GCP_REGION"
        value = var.region
      }
      env {
        name  = "BQ_DATASET"
        value = google_bigquery_dataset.llm_ops.dataset_id
      }
      env {
        name  = "BQ_TABLE"
        value = google_bigquery_table.prompt_logs.table_id
      }
      env {
        name  = "VECTOR_SEARCH_INDEX_ENDPOINT_ID"
        value = google_vertex_ai_index_endpoint.documents.name
      }
      env {
        name  = "VECTOR_SEARCH_DEPLOYED_INDEX_ID"
        value = var.vector_search_deployed_index_id
      }
      env {
        name  = "VECTOR_CHUNKS_BUCKET"
        value = google_storage_bucket.vector_chunks.name
      }
    }
  }

  # Ignore container image changes after initial creation to prevent Terraform
  # from reverting images deployed via `gcloud run deploy` CI/CD pipelines.
  lifecycle {
    ignore_changes = [
      client,
      client_version,
      template[0].containers[0].image
    ]
  }

  depends_on = [
    google_project_service.required,
    google_vertex_ai_index_endpoint_deployed_index.documents
  ]
}
