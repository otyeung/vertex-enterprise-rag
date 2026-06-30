import { BigQuery } from "@google-cloud/bigquery";

import { getConfig } from "./config.js";

export interface TelemetryData {
  log_id: string;
  timestamp: string;
  user_id: string;
  prompt: string;
  response: string;
  prompt_tokens: number;
  completion_tokens: number;
  latency_ms: number;
  status: string;
}

export async function logToBigQuery(data: TelemetryData): Promise<void> {
  const config = getConfig();
  const bigQuery = new BigQuery({ projectId: config.projectId });
  await bigQuery.dataset(config.bigQueryDataset).table(config.bigQueryTable).insert([data]);
}
