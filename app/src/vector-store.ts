import { MatchServiceClient } from "@google-cloud/aiplatform";
import { Storage } from "@google-cloud/storage";
import { VertexAIEmbeddings } from "@langchain/google-vertexai";
import type { Document } from "@langchain/core/documents";

import { getConfig } from "./config.js";

const DEFAULT_NEIGHBOR_COUNT = 5;
const BOOTSTRAP_DATAPOINT_ID = "__bootstrap__";

export interface StoredChunk {
  pageContent: string;
  metadata: Record<string, unknown>;
}

export interface EmbeddingsClient {
  embedQuery(query: string): Promise<number[]>;
}

export interface VectorSearchRequest {
  indexEndpoint?: string;
  deployedIndexId: string;
  queries: Array<{
    datapoint: {
      featureVector: number[];
    };
    neighborCount: number;
  }>;
  returnFullDatapoint: boolean;
}

export interface VectorSearchResponse {
  nearestNeighbors?: Array<{
    neighbors?: Array<{
      datapoint?: {
        datapointId?: string | null;
      } | null;
    }> | null;
  }> | null;
}

export interface VectorSearchClient {
  findNeighbors(
    request: VectorSearchRequest
  ): Promise<VectorSearchResponse | [VectorSearchResponse, unknown, unknown]>;
}

export interface ChunkStore {
  readChunk(datapointId: string): Promise<StoredChunk>;
}

export interface VectorSearchRetrieverDependencies {
  deployedIndexId: string;
  embeddings: EmbeddingsClient;
  vectorSearch: VectorSearchClient;
  chunkStore: ChunkStore;
  neighborCount?: number;
}

export function vectorChunkObjectName(datapointId: string): string {
  return `chunks/${datapointId}.json`;
}

function normalizeFindNeighborsResponse(
  response: VectorSearchResponse | [VectorSearchResponse, unknown, unknown]
): VectorSearchResponse {
  return Array.isArray(response) ? response[0] : response;
}

function extractDatapointIds(response: VectorSearchResponse): string[] {
  return (response.nearestNeighbors?.[0]?.neighbors ?? [])
    .map((neighbor) => neighbor.datapoint?.datapointId)
    .filter((datapointId): datapointId is string => Boolean(datapointId))
    .filter((datapointId) => datapointId !== BOOTSTRAP_DATAPOINT_ID);
}

export function createVectorSearchRetriever({
  deployedIndexId,
  embeddings,
  vectorSearch,
  chunkStore,
  neighborCount = DEFAULT_NEIGHBOR_COUNT
}: VectorSearchRetrieverDependencies) {
  return {
    async invoke(query: string): Promise<Document[]> {
      const featureVector = await embeddings.embedQuery(query);
      const response = normalizeFindNeighborsResponse(
        await vectorSearch.findNeighbors({
          deployedIndexId,
          queries: [
            {
              datapoint: { featureVector },
              neighborCount
            }
          ],
          returnFullDatapoint: false
        })
      );

      const datapointIds = extractDatapointIds(response);
      return Promise.all(
        datapointIds.map(async (datapointId) => {
          const chunk = await chunkStore.readChunk(datapointId);
          return {
            pageContent: chunk.pageContent,
            metadata: {
              ...chunk.metadata,
              vector_search_datapoint_id: datapointId
            }
          };
        })
      );
    }
  };
}

function indexEndpointResourceName(config: ReturnType<typeof getConfig>): string {
  if (config.vectorSearchIndexEndpointId.startsWith("projects/")) {
    return config.vectorSearchIndexEndpointId;
  }

  return `projects/${config.projectId}/locations/${config.region}/indexEndpoints/${config.vectorSearchIndexEndpointId}`;
}

function createGcsChunkStore(bucketName: string): ChunkStore {
  const storage = new Storage();
  const bucket = storage.bucket(bucketName);

  return {
    async readChunk(datapointId: string): Promise<StoredChunk> {
      const [contents] = await bucket.file(vectorChunkObjectName(datapointId)).download();
      const parsed = JSON.parse(contents.toString("utf8")) as StoredChunk;
      return parsed;
    }
  };
}

let retrieverPromise: Promise<ReturnType<typeof createVectorSearchRetriever>> | null = null;

export async function getRetriever(): Promise<ReturnType<typeof createVectorSearchRetriever>> {
  if (!retrieverPromise) {
    retrieverPromise = (async () => {
      const config = getConfig();
      const vectorSearchClient = new MatchServiceClient({
        apiEndpoint: `${config.region}-aiplatform.googleapis.com`
      });
      const indexEndpoint = indexEndpointResourceName(config);

      return createVectorSearchRetriever({
        deployedIndexId: config.vectorSearchDeployedIndexId,
        embeddings: new VertexAIEmbeddings({
          model: "text-embedding-005"
        }),
        vectorSearch: {
          async findNeighbors(request) {
            return vectorSearchClient.findNeighbors({
              ...request,
              indexEndpoint
            });
          }
        },
        chunkStore: createGcsChunkStore(config.vectorChunksBucket)
      });
    })().catch((error) => {
      retrieverPromise = null;
      throw error;
    });
  }

  return retrieverPromise;
}
