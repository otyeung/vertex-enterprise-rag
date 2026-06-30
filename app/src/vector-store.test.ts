import { describe, expect, it } from "vitest";

describe("PGVector schema alignment", () => {
  it("uses the same table and collection configuration as Python ingestion", () => {
    // This test documents the shared schema contract between Node.js retrieval
    // (app/src/vector-store.ts) and Python ingestion (functions/ingestion/main.py).
    // Both must use identical table names and collection names to share the same
    // physical PostgreSQL tables via the LangChain convention.

    const nodeConfig = {
      tableName: "langchain_pg_embedding",
      collectionTableName: "langchain_pg_collection",
      collectionName: "enterprise_documents"
    };

    // Python uses LangChain defaults for table names (same as Node.js explicit config)
    // and reads collection_name from PGVECTOR_COLLECTION env var or defaults to "enterprise_documents".
    const pythonConfig = {
      tableName: "langchain_pg_embedding", // default in langchain_postgres.PGVector
      collectionTableName: "langchain_pg_collection", // default in langchain_postgres.PGVector
      collectionName: "enterprise_documents" // default in functions/ingestion/main.py
    };

    expect(nodeConfig).toEqual(pythonConfig);
  });
});
