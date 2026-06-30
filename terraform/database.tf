resource "random_password" "db_password" {
  length           = 32
  special          = true
  override_special = "_%@"
}

resource "google_secret_manager_secret" "db_password" {
  secret_id = "${var.name_prefix}-db-password"
  labels    = local.labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = random_password.db_password.result
}

resource "google_sql_database_instance" "postgres" {
  name                = "${var.name_prefix}-postgres"
  database_version    = var.database_version
  region              = var.region
  deletion_protection = var.deletion_protection

  settings {
    tier              = var.database_tier
    availability_type = "ZONAL"
    disk_type         = "PD_SSD"
    disk_size         = 20
    disk_autoresize   = true
    user_labels       = local.labels

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      start_time                     = "03:00"
    }

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.main.id
    }
  }

  depends_on = [
    google_project_service.required,
    google_service_networking_connection.private_vpc_connection
  ]
}

resource "google_sql_database" "app" {
  name     = var.database_name
  instance = google_sql_database_instance.postgres.name
}

resource "google_sql_user" "app_user" {
  name     = var.database_user
  instance = google_sql_database_instance.postgres.name
  password = random_password.db_password.result
}

resource "null_resource" "enable_pgvector" {
  triggers = {
    instance = google_sql_database_instance.postgres.name
    database = google_sql_database.app.name
    user     = google_sql_user.app_user.name
  }

  provisioner "local-exec" {
    command = <<EOT
gcloud sql connect ${google_sql_database_instance.postgres.name} \
  --project ${var.project_id} \
  --user ${google_sql_user.app_user.name} \
  --database ${google_sql_database.app.name} \
  --quiet -- -c "CREATE EXTENSION IF NOT EXISTS vector;"
EOT
    environment = {
      PGPASSWORD = random_password.db_password.result
    }
  }

  depends_on = [
    google_sql_database.app,
    google_sql_user.app_user
  ]
}
