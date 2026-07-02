from dataclasses import dataclass
import hashlib
from os import environ
from typing import Any


@dataclass(frozen=True)
class StorageObject:
    bucket: str
    name: str


def extract_storage_object(event_data: dict) -> StorageObject:
    bucket = event_data.get("bucket")
    name = event_data.get("name")
    if not bucket or not name:
        raise ValueError("CloudEvent data must include bucket and name")
    return StorageObject(bucket=bucket, name=name)


def build_vector_search_index_resource() -> str:
    index_id = environ.get("VECTOR_SEARCH_INDEX_ID")
    if index_id and index_id.startswith("projects/"):
        return index_id

    required_keys = ["GCP_PROJECT_ID", "GCP_REGION", "VECTOR_SEARCH_INDEX_ID"]
    missing = [key for key in required_keys if not environ.get(key)]
    if missing:
        raise RuntimeError(
            "Missing Vector Search environment variables: " + ", ".join(sorted(missing))
        )

    return (
        f"projects/{environ['GCP_PROJECT_ID']}/locations/{environ['GCP_REGION']}"
        f"/indexes/{environ['VECTOR_SEARCH_INDEX_ID']}"
    )


def make_datapoint_id(bucket: str, object_name: str, chunk_index: int) -> str:
    digest = hashlib.sha256(f"{bucket}/{object_name}#{chunk_index}".encode("utf-8")).hexdigest()
    return f"chunk_{digest}"


def vector_chunk_object_name(datapoint_id: str) -> str:
    return f"chunks/{datapoint_id}.json"


def build_chunk_payload(page_content: str, metadata: dict[str, Any]) -> dict[str, Any]:
    return {
        "pageContent": page_content,
        "metadata": metadata,
    }
