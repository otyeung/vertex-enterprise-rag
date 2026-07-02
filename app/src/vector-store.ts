import { Storage } from "@google-cloud/storage";
import { VertexAIEmbeddings } from "@langchain/google-vertexai";
import type { Document } from "@langchain/core/documents";
import { GoogleAuth } from "google-auth-library";

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
        datapoint_id?: string | null;
      } | null;
    }> | null;
  }> | null;
  nearest_neighbors?: Array<{
    neighbors?: Array<{
      datapoint?: {
        datapointId?: string | null;
        datapoint_id?: string | null;
      } | null;
    }> | null;
  }> | null;
}

export interface VectorSearchClient {
  findNeighbors(request: VectorSearchRequest): Promise<VectorSearchResponse>;
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

export type AuthHeaders = Record<string, string> | Headers;

export interface AuthClient {
  getRequestHeaders(): Promise<AuthHeaders>;
}

export interface FetchResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

export type FetchFn = (
  url: string,
  init: {
    method: "POST";
    headers: Record<string, string>;
    body: string;
  }
) => Promise<FetchResponse>;

export interface PublicEndpointVectorSearchClientOptions {
  publicEndpointDomainName: string;
  indexEndpoint: string;
  auth: AuthClient;
  fetchFn?: FetchFn;
}

export function vectorChunkObjectName(datapointId: string): string {
  return `chunks/${datapointId}.json`;
}

function normalizeFindNeighborsResponse(
  response: VectorSearchResponse
): VectorSearchResponse {
  return response;
}

function extractDatapointIds(response: VectorSearchResponse): string[] {
  return ((response.nearestNeighbors ?? response.nearest_neighbors)?.[0]?.neighbors ?? [])
    .map((neighbor) => neighbor.datapoint?.datapointId ?? neighbor.datapoint?.datapoint_id)
    .filter((datapointId): datapointId is string => Boolean(datapointId))
    .filter((datapointId) => datapointId !== BOOTSTRAP_DATAPOINT_ID);
}

export function createPublicEndpointVectorSearchClient({
  publicEndpointDomainName,
  indexEndpoint,
  auth,
  fetchFn = fetch as FetchFn
}: PublicEndpointVectorSearchClientOptions): VectorSearchClient {
  return {
    async findNeighbors(request): Promise<VectorSearchResponse> {
      const rawAuthHeaders = await auth.getRequestHeaders();
      const authHeaders =
        rawAuthHeaders instanceof Headers
          ? Object.fromEntries(rawAuthHeaders.entries())
          : rawAuthHeaders;
      const response = await fetchFn(
        `https://${publicEndpointDomainName}/v1/${indexEndpoint}:findNeighbors`,
        {
          method: "POST",
          headers: {
            ...authHeaders,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            deployed_index_id: request.deployedIndexId,
            queries: request.queries.map((query) => ({
              datapoint: {
                feature_vector: query.datapoint.featureVector
              },
              neighbor_count: query.neighborCount
            })),
            return_full_datapoint: request.returnFullDatapoint
          })
        }
      );
      const body = await response.text();
      if (!response.ok) {
        throw new Error(`Vector Search findNeighbors failed with HTTP ${response.status}: ${body}`);
      }

      return JSON.parse(body) as VectorSearchResponse;
    }
  };
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
      const auth = new GoogleAuth({
        scopes: ["https://www.googleapis.com/auth/cloud-platform"]
      });
      const indexEndpoint = indexEndpointResourceName(config);

      return createVectorSearchRetriever({
        deployedIndexId: config.vectorSearchDeployedIndexId,
        embeddings: new VertexAIEmbeddings({
          model: "text-embedding-005"
        }),
        vectorSearch: createPublicEndpointVectorSearchClient({
          publicEndpointDomainName: config.vectorSearchPublicEndpointDomainName,
          indexEndpoint,
          auth
        }),
        chunkStore: createGcsChunkStore(config.vectorChunksBucket)
      });
    })().catch((error) => {
      retrieverPromise = null;
      throw error;
    });
  }

  return retrieverPromise;
}
