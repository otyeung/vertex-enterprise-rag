variable "project_id" {
  description = "Google Cloud project ID."
  type        = string
  default     = "vertex-enterprise-rag"
}

variable "region" {
  description = "Google Cloud region for regional resources."
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Deployment environment label."
  type        = string
  default     = "dev"
}

variable "name_prefix" {
  description = "Prefix used for resource names."
  type        = string
  default     = "vertex-rag"
}

variable "database_name" {
  description = "Application database name."
  type        = string
  default     = "rag_app"
}

variable "database_user" {
  description = "Application database user."
  type        = string
  default     = "rag_app"
}

variable "database_tier" {
  description = "Cloud SQL machine tier."
  type        = string
  default     = "db-custom-1-3840"
}

variable "database_version" {
  description = "Cloud SQL PostgreSQL version."
  type        = string
  default     = "POSTGRES_15"
}

variable "deletion_protection" {
  description = "Whether Cloud SQL deletion protection is enabled."
  type        = bool
  default     = false
}

variable "force_destroy" {
  description = "Whether buckets can be destroyed when they contain objects."
  type        = bool
  default     = false
}

variable "bootstrap_image" {
  description = "Initial Cloud Run image used before the app image is built."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "cloud_run_ingress" {
  description = "Cloud Run ingress setting."
  type        = string
  default     = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"
}
