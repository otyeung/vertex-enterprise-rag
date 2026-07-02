import { describe, expect, it, vi } from "vitest";
import { getConfig } from "./config.js";

describe("Config validation", () => {
  it("throws if required environment variables are missing", () => {
    const originalEnv = process.env;
    process.env = {};

    expect(() => getConfig()).toThrow("Missing required environment variables");

    process.env = originalEnv;
  });

  it("returns valid config when all required env vars are present", () => {
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      GCP_PROJECT_ID: "test-project",
      GCP_REGION: "us-central1",
      BQ_DATASET: "testdataset",
      BQ_TABLE: "testtable",
      VECTOR_SEARCH_INDEX_ENDPOINT_ID: "123456789",
      VECTOR_SEARCH_DEPLOYED_INDEX_ID: "enterprise_documents",
      VECTOR_CHUNKS_BUCKET: "test-vector-chunks"
    };

    const config = getConfig();

    expect(config.projectId).toBe("test-project");
    expect(config.region).toBe("us-central1");
    expect(config.bigQueryDataset).toBe("testdataset");
    expect(config.bigQueryTable).toBe("testtable");
    expect(config.vectorSearchIndexEndpointId).toBe("123456789");
    expect(config.vectorSearchDeployedIndexId).toBe("enterprise_documents");
    expect(config.vectorChunksBucket).toBe("test-vector-chunks");
    expect(config.port).toBeTypeOf("number");

    process.env = originalEnv;
  });
});
