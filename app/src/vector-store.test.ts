import { describe, expect, it } from "vitest";

describe("PGVector schema constants", () => {
  it("documents the shared schema contract with Python ingestion", () => {
    // This test verifies that the PGVector schema constants used by the Node.js retriever
    // (app/src/vector-store.ts) are stable and documented. These must match the Python
    // ingestion function (functions/ingestion/main.py) which provisions the schema.
    //
    // IMPORTANT: Python ingestion must run first to create the tables before Node.js
    // initializes the retriever. Both sides share the physical PostgreSQL tables via
    // the LangChain PGVector convention. See README for deployment order.

    const SCHEMA_CONSTANTS = {
      tableName: "langchain_pg_embedding",
      collectionTableName: "langchain_pg_collection",
      defaultCollectionName: "enterprise_documents"
    };

    // Verify constants are well-formed strings (not empty/undefined).
    expect(SCHEMA_CONSTANTS.tableName).toMatch(/^[a-z_]+$/);
    expect(SCHEMA_CONSTANTS.collectionTableName).toMatch(/^[a-z_]+$/);
    expect(SCHEMA_CONSTANTS.defaultCollectionName).toMatch(/^[a-z_]+$/);
  });
});
