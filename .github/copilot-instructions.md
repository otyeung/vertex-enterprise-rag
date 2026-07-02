# Copilot instructions for `vertex-enterprise-rag`

## Build, test, and validation commands

Run commands from the repository root unless noted.

### Terraform

```bash
terraform -chdir=terraform fmt -check
terraform -chdir=terraform init -backend=false -input=false
terraform -chdir=terraform validate
terraform -chdir=terraform plan
```

Use `terraform -chdir=terraform apply` only when intentionally changing deployed GCP resources.

### Cloud Run app

```bash
cd app
npm ci
npm test
npm test -- src/vector-store.test.ts
npm run build
```

The app has no lint script in `package.json`.

### Ingestion function

```bash
cd functions/ingestion
python3 -m venv venv
source venv/bin/activate
python -m pip install -r requirements.txt
python -m pytest test_utils.py -q
python -m pytest test_utils.py::test_make_datapoint_id_is_stable_and_safe -q
```

The deployed Cloud Function runtime is Python 3.11.

## High-level architecture

This repository is an API-first enterprise RAG blueprint; there is no frontend UI. The user-facing runtime is the Express API in `app/`, primarily `POST /ask` plus `GET /healthz`.

Terraform in `terraform/` provisions the deployed stack in project `vertex-enterprise-rag`, region `us-central1`: raw PDF and chunk GCS buckets, a streaming Vertex AI Vector Search index and public index endpoint, a Cloud Run service, a Gen 2 Cloud Function, BigQuery telemetry, Artifact Registry, Eventarc prerequisites, and least-privilege service accounts. Cloud SQL/pgvector is not part of the current stack.

Document ingestion flows from Cloud Storage object-finalized events to Eventarc and then `functions/ingestion/main.py`. The function downloads PDFs to `/tmp`, extracts pages with `PyPDFLoader`, chunks text with `RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)`, embeds chunks with Vertex AI `text-embedding-005`, writes chunk JSON payloads to the vector chunk bucket, and upserts v1 `IndexDatapoint` records into Vertex AI Vector Search.

Query handling starts in `app/src/index.ts`. `POST /ask` validates `{ query, user_id }` with Zod, retrieves top-5 chunks through `app/src/vector-store.ts`, calls Gemini through `app/src/agent.ts`, and writes success/error telemetry through `app/src/bq-logger.ts` into BigQuery table `llm_ops_telemetry.prompt_logs`.

Vector retrieval is split between Vertex AI Vector Search and GCS. Vector Search stores only embeddings and datapoint IDs; the full chunk text and metadata live as JSON objects in GCS under `chunks/<datapoint_id>.json`. The Node retriever calls the Vector Search public endpoint domain with REST `:findNeighbors`; do not switch it back to the regional gRPC `MatchServiceClient`, which does not work for the public endpoint path.

## Codebase-specific conventions

- Keep the ingestion and retrieval contracts synchronized:
  - Datapoint IDs are `chunk_` plus a SHA-256 hash of `bucket/object#chunk_index`.
  - Chunk payloads are JSON with `pageContent` and `metadata`.
  - GCS chunk object names are `chunks/<datapoint_id>.json`.
  - The bootstrap datapoint ID `__bootstrap__` is ignored by the retriever.
- Use `text-embedding-005` with 768-dimensional vectors. Terraform variable `embedding_dimensions` must match the embedding model output.
- Use `gemini-2.5-flash` for answer generation; older README-era model names such as `gemini-1.5-pro` and `gemini-2.0-flash-001` were not accessible in this project/region.
- Required Cloud Run app environment variables are defined in `app/src/config.ts`: `GCP_PROJECT_ID`, `GCP_REGION`, `VECTOR_SEARCH_INDEX_ENDPOINT_ID`, `VECTOR_SEARCH_PUBLIC_ENDPOINT_DOMAIN_NAME`, `VECTOR_SEARCH_DEPLOYED_INDEX_ID`, `VECTOR_CHUNKS_BUCKET`, `BQ_DATASET`, and `BQ_TABLE`.
- The current developer path uses Cloud Run ingress `all` with `--no-allow-unauthenticated`, so local terminal curls first set `TOKEN="$(gcloud auth print-identity-token)"` and then send it as a bearer token. The README also documents the production HTTPS Load Balancer + IAP path.
- Terraform intentionally ignores Cloud Run `client`, `client_version`, and container image drift because images are built and deployed with `gcloud builds submit` / `gcloud run deploy`.
- Unit tests avoid live GCP calls by injecting dependencies into the Express app and Vector Search retriever. Keep this pattern when adding tests around request handling or retrieval behavior.
- Local/generated artifacts are ignored: `app/node_modules/`, `app/dist/`, `functions/ingestion/venv/`, Terraform state/plan files, `.terraform/`, `.worktrees/`, and `docs/`.
