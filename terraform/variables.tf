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
  default     = "INGRESS_TRAFFIC_ALL"
}

variable "embedding_dimensions" {
  description = "Embedding vector dimensions for text-embedding-005."
  type        = number
  default     = 768
}

variable "vector_search_approximate_neighbors_count" {
  description = "Approximate neighbor count for the Vertex AI Vector Search index."
  type        = number
  default     = 150
}

variable "vector_search_leaf_node_embedding_count" {
  description = "Leaf node embedding count for the tree-AH Vector Search index."
  type        = number
  default     = 500
}

variable "vector_search_leaf_nodes_to_search_percent" {
  description = "Percent of leaf nodes to search for the tree-AH Vector Search index."
  type        = number
  default     = 7
}

variable "vector_search_deployed_index_id" {
  description = "User-defined deployed index ID used by the Cloud Run retriever."
  type        = string
  default     = "enterprise_documents"
}

variable "vector_search_min_replica_count" {
  description = "Minimum replicas for the deployed Vertex AI Vector Search index."
  type        = number
  default     = 1
}

variable "vector_search_max_replica_count" {
  description = "Maximum replicas for the deployed Vertex AI Vector Search index."
  type        = number
  default     = 1
}
