import "dotenv/config";

const requiredKeys = [
  "GCP_PROJECT_ID",
  "GCP_REGION",
  "DB_HOST",
  "DB_PORT",
  "DB_NAME",
  "DB_USER",
  "DB_PASSWORD",
  "BQ_DATASET",
  "BQ_TABLE"
] as const;

export interface AppConfig {
  projectId: string;
  region: string;
  databaseUrl: string;
  bigQueryDataset: string;
  bigQueryTable: string;
  pgVectorCollection: string;
  port: number;
}

export function getConfig(): AppConfig {
  const missing = requiredKeys.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  const user = encodeURIComponent(process.env.DB_USER as string);
  const password = encodeURIComponent(process.env.DB_PASSWORD as string);
  const host = process.env.DB_HOST as string;
  const port = process.env.DB_PORT as string;
  const database = process.env.DB_NAME as string;

  return {
    projectId: process.env.GCP_PROJECT_ID as string,
    region: process.env.GCP_REGION as string,
    databaseUrl: `postgresql://${user}:${password}@${host}:${port}/${database}`,
    bigQueryDataset: process.env.BQ_DATASET as string,
    bigQueryTable: process.env.BQ_TABLE as string,
    pgVectorCollection: process.env.PGVECTOR_COLLECTION ?? "enterprise_documents",
    port: Number(process.env.PORT ?? "8080")
  };
}
