import crypto from "node:crypto";
import { performance } from "node:perf_hooks";

import express from "express";
import { z } from "zod";

import { getConfig } from "./config.js";
import { logToBigQuery, type TelemetryData } from "./bq-logger.js";
import { runRagQuery, type RagResult } from "./agent.js";

const askSchema = z.object({
  query: z.string().trim().min(1),
  user_id: z.string().trim().min(1)
});

export interface AppDependencies {
  runRagQuery: (query: string) => Promise<RagResult>;
  logToBigQuery: (data: TelemetryData) => Promise<void>;
}

export function createApp(dependencies: Partial<AppDependencies> = {}) {
  const app = express();
  const deps: AppDependencies = {
    runRagQuery: dependencies.runRagQuery ?? runRagQuery,
    logToBigQuery: dependencies.logToBigQuery ?? logToBigQuery
  };

  app.use(express.json({ limit: "1mb" }));

  app.get("/healthz", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });

  app.post("/ask", async (request, response) => {
    const parsed = askSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Invalid request body" });
      return;
    }

    const startedAt = performance.now();
    const { query, user_id } = parsed.data;

    try {
      const result = await deps.runRagQuery(query);
      const latencyMs = Math.round(performance.now() - startedAt);

      void deps
        .logToBigQuery({
          log_id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          user_id,
          prompt: query,
          response: result.answer,
          prompt_tokens: result.tokenUsage.promptTokens,
          completion_tokens: result.tokenUsage.completionTokens,
          latency_ms: latencyMs,
          status: "success"
        })
        .catch((error) => {
          console.error("Failed to write BigQuery telemetry", error);
        });

      response.status(200).json({ answer: result.answer, sources: result.sources });
    } catch (error) {
      const latencyMs = Math.round(performance.now() - startedAt);
      console.error("RAG request failed", error);

      void deps
        .logToBigQuery({
          log_id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          user_id,
          prompt: query,
          response: "",
          prompt_tokens: 0,
          completion_tokens: 0,
          latency_ms: latencyMs,
          status: "error"
        })
        .catch((telemetryError) => {
          console.error("Failed to write BigQuery error telemetry", telemetryError);
        });

      response.status(500).json({ error: "RAG request failed" });
    }
  });

  return app;
}

if (process.env.NODE_ENV !== "test") {
  const config = getConfig();
  createApp().listen(config.port, () => {
    console.log(`Enterprise RAG API listening on port ${config.port}`);
  });
}
