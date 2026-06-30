import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { Document } from "@langchain/core/documents";
import { ChatVertexAI } from "@langchain/google-vertexai";

import { getConfig } from "./config.js";
import { getRetriever } from "./vector-store.js";

export interface Source {
  source?: string;
  page?: number;
  source_bucket?: string;
  source_object?: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface RagResult {
  answer: string;
  sources: Source[];
  tokenUsage: TokenUsage;
}

function formatDocuments(documents: Document[]): string {
  return documents
    .map((document, index) => {
      const source = document.metadata.source_object ?? document.metadata.source ?? "unknown";
      const page = document.metadata.page ?? "unknown";
      return `[${index + 1}] source=${source} page=${page}\n${document.pageContent}`;
    })
    .join("\n\n");
}

function extractSources(documents: Document[]): Source[] {
  return documents.map((document) => ({
    source: document.metadata.source,
    page: document.metadata.page,
    source_bucket: document.metadata.source_bucket,
    source_object: document.metadata.source_object
  }));
}

function normalizeContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text: unknown }).text);
        }
        return "";
      })
      .join("");
  }
  return String(content ?? "");
}

function normalizeTokenUsage(response: { usage_metadata?: { input_tokens?: number; output_tokens?: number; prompt_tokens?: number; completion_tokens?: number } }): TokenUsage {
  const usage = response.usage_metadata ?? {};
  return {
    promptTokens: usage.input_tokens ?? usage.prompt_tokens ?? 0,
    completionTokens: usage.output_tokens ?? usage.completion_tokens ?? 0
  };
}

export async function runRagQuery(query: string): Promise<RagResult> {
  const config = getConfig();
  const retriever = await getRetriever();
  const documents = await retriever.invoke(query);
  const context = formatDocuments(documents);

  const model = new ChatVertexAI({
    model: "gemini-1.5-pro",
    location: config.region,
    temperature: 0,
    maxRetries: 2
  });

  const response = await model.invoke([
    new SystemMessage(
      "You are an enterprise compliance and RFP assistant. Answer strictly from the provided enterprise context. If the context does not contain the answer, say you do not know from the provided context."
    ),
    new HumanMessage(`Enterprise context:\n${context}\n\nQuestion:\n${query}`)
  ]);

  return {
    answer: normalizeContent(response.content),
    sources: extractSources(documents),
    tokenUsage: normalizeTokenUsage(response)
  };
}
