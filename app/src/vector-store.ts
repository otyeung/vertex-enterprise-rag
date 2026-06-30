import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import { VertexAIEmbeddings } from "@langchain/google-vertexai";
import type { VectorStoreRetriever } from "@langchain/core/vectorstores";

import { getConfig } from "./config.js";

// SHARED SCHEMA CONTRACT: This table configuration MUST match the schema used by
// the Python ingestion function (functions/ingestion/main.py) which uses
// langchain_postgres.PGVector with the same table names and collection name.
// Both libraries share the physical PostgreSQL tables via convention.
// - tableName: "langchain_pg_embedding" (document vectors and content)
// - collectionTableName: "langchain_pg_collection" (collection metadata)
// - collectionName: "enterprise_documents" (default, or PGVECTOR_COLLECTION env var)
// Changes to this schema must be coordinated across both Node.js and Python code paths.

// Module-level singleton to prevent connection pool leak.
// PGVectorStore.initialize() creates a new pg.Pool instance on every call.
// We lazily initialize once per Cloud Run instance and reuse across requests.
let retrieverPromise: Promise<VectorStoreRetriever> | null = null;

export async function getRetriever(): Promise<VectorStoreRetriever> {
  if (!retrieverPromise) {
    retrieverPromise = (async () => {
      const config = getConfig();
      const embeddings = new VertexAIEmbeddings({
        model: "textembedding-gecko@latest"
      });

      const store = await PGVectorStore.initialize(embeddings, {
        postgresConnectionOptions: {
          connectionString: config.databaseUrl
        },
        tableName: "langchain_pg_embedding",
        collectionTableName: "langchain_pg_collection",
        collectionName: config.pgVectorCollection,
        columns: {
          idColumnName: "id",
          vectorColumnName: "embedding",
          contentColumnName: "document",
          metadataColumnName: "cmetadata"
        }
      });

      return store.asRetriever(5);
    })().catch((error) => {
      // Reset the cached promise on error so subsequent requests can retry initialization.
      // Without this, a failed initialization (e.g., transient network error) poisons the
      // singleton and all future requests will reject until the Cloud Run instance recycles.
      retrieverPromise = null;
      throw error;
    });
  }

  return retrieverPromise;
}
