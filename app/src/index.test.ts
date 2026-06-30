import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "./index.js";

describe("POST /ask", () => {
  it("rejects malformed request bodies", async () => {
    const app = createApp();

    const response = await request(app).post("/ask").send({ query: "" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid request body");
  });

  it("returns an answer and logs telemetry asynchronously", async () => {
    const logToBigQuery = vi.fn().mockResolvedValue(undefined);
    const app = createApp({
      runRagQuery: vi.fn().mockResolvedValue({
        answer: "The deployment uses least-privilege service accounts.",
        sources: [{ source: "security.pdf", page: 2 }],
        tokenUsage: { promptTokens: 12, completionTokens: 9 }
      }),
      logToBigQuery
    });

    const response = await request(app)
      .post("/ask")
      .send({ query: "How is IAM handled?", user_id: "alice" });

    expect(response.status).toBe(200);
    expect(response.body.answer).toContain("least-privilege");
    expect(response.body.sources).toEqual([{ source: "security.pdf", page: 2 }]);
    expect(logToBigQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "alice",
        prompt: "How is IAM handled?",
        response: "The deployment uses least-privilege service accounts.",
        prompt_tokens: 12,
        completion_tokens: 9,
        status: "success"
      })
    );
  });
});
