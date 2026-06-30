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
      DB_HOST: "localhost",
      DB_PORT: "5432",
      DB_NAME: "testdb",
      DB_USER: "testuser",
      DB_PASSWORD: "testpass",
      BQ_DATASET: "testdataset",
      BQ_TABLE: "testtable",
      PGVECTOR_COLLECTION: "enterprise_documents"
    };

    const config = getConfig();

    expect(config.projectId).toBe("test-project");
    expect(config.region).toBe("us-central1");
    expect(config.databaseUrl).toContain("postgresql://");
    expect(config.bigQueryDataset).toBe("testdataset");
    expect(config.bigQueryTable).toBe("testtable");
    expect(config.pgVectorCollection).toBe("enterprise_documents");
    expect(config.port).toBeTypeOf("number");

    process.env = originalEnv;
  });
});
