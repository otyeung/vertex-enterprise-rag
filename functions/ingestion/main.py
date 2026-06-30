import os
from pathlib import Path

import functions_framework
from google.cloud import storage
from langchain_community.document_loaders import PyPDFLoader
from langchain_google_vertexai import VertexAIEmbeddings
from langchain_postgres import PGVector
from langchain_text_splitters import RecursiveCharacterTextSplitter

from utils import build_postgres_connection_string, extract_storage_object


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


def _write_documents(chunks):
    embeddings = VertexAIEmbeddings(model_name="textembedding-gecko@latest")
    vector_store = PGVector(
        embeddings=embeddings,
        collection_name=os.environ.get("PGVECTOR_COLLECTION", "enterprise_documents"),
        connection=build_postgres_connection_string(),
        use_jsonb=True,
        create_extension=True,
    )
    vector_store.add_documents(chunks)


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

        _write_documents(chunks)
        print(
            f"Ingested {len(chunks)} chunks from gs://{storage_object.bucket}/{storage_object.name}"
        )
    finally:
        # Clean up downloaded PDF file after processing
        if local_path.exists():
            local_path.unlink()
