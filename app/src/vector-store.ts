import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import { VertexAIEmbeddings } from "@langchain/google-vertexai";

import { getConfig } from "./config.js";

export async function getRetriever() {
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
}
