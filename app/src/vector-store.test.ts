import { describe, expect, it } from "vitest";

import {
  createPublicEndpointVectorSearchClient,
  createVectorSearchRetriever,
  vectorChunkObjectName
} from "./vector-store.js";

describe("Vertex AI Vector Search retriever", () => {
  it("maps Vector Search neighbor IDs to stored source documents", async () => {
    const retriever = createVectorSearchRetriever({
      deployedIndexId: "enterprise_documents",
      neighborCount: 2,
      embeddings: {
        embedQuery: async () => [0.1, 0.2, 0.3]
      },
      vectorSearch: {
        findNeighbors: async (request) => {
          expect(request.deployedIndexId).toBe("enterprise_documents");
          expect(request.queries[0].neighborCount).toBe(2);
          expect(request.queries[0].datapoint.featureVector).toEqual([0.1, 0.2, 0.3]);
          return {
            nearestNeighbors: [
              {
                neighbors: [
                  { datapoint: { datapointId: "chunk-1" } },
                  { datapoint: { datapointId: "chunk-2" } }
                ]
              }
            ]
          };
        }
      },
      chunkStore: {
        readChunk: async (datapointId) => ({
          pageContent: `content for ${datapointId}`,
          metadata: {
            source_object: "papers/attention.pdf",
            page: datapointId === "chunk-1" ? 1 : 2
          }
        })
      }
    });

    const documents = await retriever.invoke("What is attention?");

    expect(documents).toEqual([
      {
        pageContent: "content for chunk-1",
        metadata: {
          source_object: "papers/attention.pdf",
          page: 1,
          vector_search_datapoint_id: "chunk-1"
        }
      },
      {
        pageContent: "content for chunk-2",
        metadata: {
          source_object: "papers/attention.pdf",
          page: 2,
          vector_search_datapoint_id: "chunk-2"
        }
      }
    ]);
  });

  it("stores chunks under deterministic GCS object names", () => {
    expect(vectorChunkObjectName("paper-01-page-03")).toBe("chunks/paper-01-page-03.json");
  });

  it("queries the Vector Search public endpoint with REST JSON", async () => {
    const requests: Array<{ url: string; init: { method?: string; headers?: Record<string, string>; body?: string } }> = [];
    const client = createPublicEndpointVectorSearchClient({
      publicEndpointDomainName: "123.us-central1-456.vdb.vertexai.goog",
      indexEndpoint: "projects/demo/locations/us-central1/indexEndpoints/789",
      auth: {
        getRequestHeaders: async () => ({ Authorization: "Bearer token" })
      },
      fetchFn: async (url, init) => {
        requests.push({ url, init: init as { method?: string; headers?: Record<string, string>; body?: string } });
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              nearestNeighbors: [
                {
                  neighbors: [{ datapoint: { datapointId: "chunk-1" } }]
                }
              ]
            })
        };
      }
    });

    const response = await client.findNeighbors({
      deployedIndexId: "enterprise_documents",
      queries: [
        {
          datapoint: { featureVector: [0.1, 0.2] },
          neighborCount: 5
        }
      ],
      returnFullDatapoint: false
    });

    expect(response.nearestNeighbors?.[0]?.neighbors?.[0]?.datapoint?.datapointId).toBe("chunk-1");
    expect(requests).toEqual([
      {
        url: "https://123.us-central1-456.vdb.vertexai.goog/v1/projects/demo/locations/us-central1/indexEndpoints/789:findNeighbors",
        init: {
          method: "POST",
          headers: {
            Authorization: "Bearer token",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            deployed_index_id: "enterprise_documents",
            queries: [
              {
                datapoint: { feature_vector: [0.1, 0.2] },
                neighbor_count: 5
              }
            ],
            return_full_datapoint: false
          })
        }
      }
    ]);
  });
});
