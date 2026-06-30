# PRD: Enterprise GenAI Secure Landing Zone on Google Cloud (vertex-enterprise-rag)

**Context for Copilot:** This PRD defines an Enterprise Compliance & RFP Intelligence Pipeline. Act as a Senior Cloud Architect and strictly follow these requirements to generate Terraform configurations, a Python Cloud Function, and a TypeScript Cloud Run application.

## 1. Architecture & Tech Stack

- **Infrastructure as Code:** Terraform (Google Cloud Provider)
- **AI Models:** Vertex AI Gemini 1.5 Pro (Text/Reasoning), Vertex AI Text Embeddings (Gecko)
- **Ingestion Pipeline:** Python 3.11, Google Cloud Functions (Gen 2), Eventarc, LangChain, PyPDF2
- **Agent Application:** Node.js 20, TypeScript, Express.js, `@langchain/google-vertexai`, `@google-cloud/bigquery`
- **Storage & Database:** Google Cloud Storage (Raw PDFs), Cloud SQL (PostgreSQL + pgvector for Embeddings), BigQuery (LLMOps Telemetry)
- **Security:** IAM Service Accounts with Least Privilege, Secret Manager

## 2. Directory Structure

```text
.
├── terraform/
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   ├── iam.tf
│   ├── bq.tf
│   └── database.tf
├── functions/
│   └── ingestion/
│       ├── main.py
│       ├── requirements.txt
│       └── utils.py
├── app/
│   ├── src/
│   │   ├── index.ts
│   │   ├── agent.ts
│   │   ├── vector-store.ts
│   │   └── bq-logger.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
└── README.md
```

## 3. Implementation Phases & Prompts for Copilot

### Phase 1: Infrastructure as Code (Terraform)

**Instructions for Copilot:** Implement the `terraform/` directory.

1.  **`main.tf`**: Configure the `google` provider. Create a Google Cloud Storage Bucket for raw PDF uploads (enforce uniform bucket-level access). Create a Google Cloud Run Gen 2 service pointing to a placeholder container image for the `app/`.
2.  **`iam.tf`**: Create two distinct Service Accounts (SA):
    - `ingestion-sa`: Grant `roles/storage.objectViewer`, `roles/aiplatform.user` (to call Vertex Embeddings), and Cloud SQL client access.
    - `app-sa`: Grant `roles/aiplatform.user` (to call Gemini 1.5), `roles/bigquery.dataEditor`, and Cloud SQL client access. Bind this SA to the Cloud Run service.
3.  **`bq.tf`**: Create a BigQuery Dataset named `llm_ops_telemetry` and a table named `prompt_logs`. Schema: `log_id` (STRING), `timestamp` (TIMESTAMP), `user_id` (STRING), `prompt` (STRING), `response` (STRING), `prompt_tokens` (INTEGER), `completion_tokens` (INTEGER), `latency_ms` (INTEGER), `status` (STRING).
4.  **`database.tf`**: Create a Cloud SQL PostgreSQL instance and database. Enable the `pgvector` extension via a null_resource or startup script.

### Phase 2: Data Ingestion Pipeline (Cloud Function)

**Instructions for Copilot:** Implement the `functions/ingestion/` directory in Python.

1.  **`requirements.txt`**: Include `functions-framework`, `google-cloud-storage`, `langchain-google-vertexai`, `langchain-postgres`, `psycopg2-binary`, `pypdf`.
2.  **`main.py`**: Create an Eventarc-triggered Cloud Function (`@functions_framework.cloud_event`).
    - Extract the bucket and filename from the `cloud_event`.
    - Download the PDF from GCS to `/tmp/`.
    - Use LangChain's `PyPDFLoader` to extract text.
    - Use `RecursiveCharacterTextSplitter` (chunk_size=1000, overlap=200).
    - Initialize `VertexAIEmbeddings` (model: `textembedding-gecko@latest`).
    - Write the chunks and embeddings to the Cloud SQL PostgreSQL database using LangChain's `PGVector` store.

### Phase 3: The AI Agent API (Cloud Run App)

**Instructions for Copilot:** Implement the `app/` directory in TypeScript.

1.  **`package.json`**: Include `@langchain/google-vertexai`, `@langchain/core`, `@google-cloud/bigquery`, `express`, `pg`, `zod`, `dotenv`.
2.  **`src/vector-store.ts`**: Connect to the Cloud SQL pgvector database and configure LangChain's VectorStore Retriever to fetch top 5 relevant chunks.
3.  **`src/bq-logger.ts`**: Implement an asynchronous function `logToBigQuery(telemetryData)` that inserts a row into the `llm_ops_telemetry.prompt_logs` table.
4.  **`src/agent.ts`**:
    - Initialize `ChatVertexAI` using the `gemini-1.5-pro` model.
    - Create a RAG chain: Takes a user query, retrieves chunks from `vector-store.ts`, formats the context, and prompts Gemini to answer strictly based on the provided enterprise context.
5.  **`src/index.ts`**: Create an Express server with a `POST /ask` endpoint.
    - Accept JSON: `{ "query": "string", "user_id": "string" }`.
    - Start a performance timer.
    - Invoke the RAG chain.
    - End the timer, extract token counts from the Vertex AI response metadata.
    - Call `logToBigQuery` asynchronously.
    - Return the JSON response: `{ "answer": "string", "sources": [...] }`.
6.  **`Dockerfile`**: Write a production-ready multi-stage Dockerfile to build and serve the Node.js application.

### Phase 4: README & Documentation

**Instructions for Copilot:** Generate a comprehensive `README.md`.

1.  Include an architecture Mermaid diagram mapping GCS -> Cloud Function -> Vector DB -> Cloud Run -> Vertex AI / BigQuery.
2.  Frame the project strictly as an "Enterprise Deployment Blueprint for GenAI".
3.  Include a "Security & Governance" section detailing the IAM least-privilege setup and data sovereignty (all data stays inside the customer VPC/Google Cloud project).
4.  Provide copy-paste commands to initialize and apply the Terraform scripts, and deploy the Cloud Function and Cloud Run services using `gcloud`.
