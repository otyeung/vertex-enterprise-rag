import "dotenv/config";

const requiredKeys = [
  "GCP_PROJECT_ID",
  "GCP_REGION",
  "VECTOR_SEARCH_INDEX_ENDPOINT_ID",
  "VECTOR_SEARCH_PUBLIC_ENDPOINT_DOMAIN_NAME",
  "VECTOR_SEARCH_DEPLOYED_INDEX_ID",
  "VECTOR_CHUNKS_BUCKET",
  "BQ_DATASET",
  "BQ_TABLE"
] as const;

export interface AppConfig {
  projectId: string;
  region: string;
  bigQueryDataset: string;
  bigQueryTable: string;
  vectorSearchIndexEndpointId: string;
  vectorSearchPublicEndpointDomainName: string;
  vectorSearchDeployedIndexId: string;
  vectorChunksBucket: string;
  port: number;
}

export function getConfig(): AppConfig {
  const missing = requiredKeys.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  return {
    projectId: process.env.GCP_PROJECT_ID as string,
    region: process.env.GCP_REGION as string,
    bigQueryDataset: process.env.BQ_DATASET as string,
    bigQueryTable: process.env.BQ_TABLE as string,
    vectorSearchIndexEndpointId: process.env.VECTOR_SEARCH_INDEX_ENDPOINT_ID as string,
    vectorSearchPublicEndpointDomainName: process.env.VECTOR_SEARCH_PUBLIC_ENDPOINT_DOMAIN_NAME as string,
    vectorSearchDeployedIndexId: process.env.VECTOR_SEARCH_DEPLOYED_INDEX_ID as string,
    vectorChunksBucket: process.env.VECTOR_CHUNKS_BUCKET as string,
    port: Number(process.env.PORT ?? "8080")
  };
}
