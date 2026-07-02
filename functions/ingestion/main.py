import json
import os
from pathlib import Path

import functions_framework
from google.cloud import aiplatform
from google.cloud import storage
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from vertexai.language_models import TextEmbeddingModel

from utils import (
    build_chunk_payload,
    build_vector_search_index_resource,
    extract_storage_object,
    make_datapoint_id,
    vector_chunk_object_name,
)


def _download_pdf(bucket_name: str, object_name: str) -> Path:
    # Google Cloud Functions provide /tmp as writable ephemeral storage per PRD requirement.
    # This temporary directory is suitable for staging files during processing.
    local_path = Path("/tmp") / Path(object_name).name
    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(object_name)
    blob.download_to_filename(local_path)
    return local_path


def _load_and_split_pdf(local_path: Path):
    loader = PyPDFLoader(str(local_path))
    documents = loader.load()
    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    return splitter.split_documents(documents)


def _require_vector_chunks_bucket() -> str:
    bucket_name = os.environ.get("VECTOR_CHUNKS_BUCKET")
    if not bucket_name:
        raise RuntimeError("Missing Vector Search environment variables: VECTOR_CHUNKS_BUCKET")
    return bucket_name


def _make_index_datapoint(datapoint_id: str, vector: list[float]):
    return aiplatform.compat.types.index_v1.IndexDatapoint(
        datapoint_id=datapoint_id,
        feature_vector=vector,
    )


def _write_documents(storage_object, chunks):
    aiplatform.init(
        project=os.environ.get("GCP_PROJECT_ID"),
        location=os.environ.get("GCP_REGION"),
    )
    embedding_model = TextEmbeddingModel.from_pretrained("text-embedding-005")
    vectors = [
        embedding.values
        for embedding in embedding_model.get_embeddings(
            [chunk.page_content for chunk in chunks]
        )
    ]

    storage_client = storage.Client()
    chunk_bucket = storage_client.bucket(_require_vector_chunks_bucket())
    datapoints = []

    for index, (chunk, vector) in enumerate(zip(chunks, vectors)):
        datapoint_id = make_datapoint_id(storage_object.bucket, storage_object.name, index)
        chunk_bucket.blob(vector_chunk_object_name(datapoint_id)).upload_from_string(
            json.dumps(
                build_chunk_payload(
                    page_content=chunk.page_content,
                    metadata=dict(chunk.metadata),
                )
            ),
            content_type="application/json",
        )
        datapoints.append(_make_index_datapoint(datapoint_id, vector))

    vector_index = aiplatform.MatchingEngineIndex(
        index_name=build_vector_search_index_resource()
    )
    vector_index.upsert_datapoints(datapoints=datapoints)


@functions_framework.cloud_event
def ingest_pdf(cloud_event):
    storage_object = extract_storage_object(cloud_event.data)
    if not storage_object.name.lower().endswith(".pdf"):
        print(f"Skipping non-PDF object: gs://{storage_object.bucket}/{storage_object.name}")
        return

    local_path = _download_pdf(storage_object.bucket, storage_object.name)
    try:
        chunks = _load_and_split_pdf(local_path)
        if not chunks:
            raise RuntimeError(
                f"No extractable text found in gs://{storage_object.bucket}/{storage_object.name}"
            )

        for chunk in chunks:
            chunk.metadata["source_bucket"] = storage_object.bucket
            chunk.metadata["source_object"] = storage_object.name

        _write_documents(storage_object, chunks)
        print(
            f"Ingested {len(chunks)} chunks from gs://{storage_object.bucket}/{storage_object.name}"
        )
    finally:
        # Clean up downloaded PDF file after processing
        if local_path.exists():
            local_path.unlink()
