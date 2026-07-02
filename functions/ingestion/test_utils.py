import os
import importlib

import pytest

from utils import (
    build_chunk_payload,
    build_vector_search_index_resource,
    make_datapoint_id,
    extract_storage_object,
)


def test_extract_storage_object_reads_bucket_and_name():
    storage_object = extract_storage_object(
        {"bucket": "raw-bucket", "name": "rfp/example.pdf"}
    )

    assert storage_object.bucket == "raw-bucket"
    assert storage_object.name == "rfp/example.pdf"


def test_extract_storage_object_rejects_missing_name():
    with pytest.raises(ValueError, match="CloudEvent data must include bucket and name"):
        extract_storage_object({"bucket": "raw-bucket"})


def test_build_vector_search_index_resource_from_index_id(monkeypatch):
    monkeypatch.setenv("GCP_PROJECT_ID", "test-project")
    monkeypatch.setenv("GCP_REGION", "us-central1")
    monkeypatch.setenv("VECTOR_SEARCH_INDEX_ID", "123456789")

    assert (
        build_vector_search_index_resource()
        == "projects/test-project/locations/us-central1/indexes/123456789"
    )


def test_build_vector_search_index_resource_accepts_full_name(monkeypatch):
    full_name = "projects/prod/locations/us-central1/indexes/987654321"
    monkeypatch.setenv("VECTOR_SEARCH_INDEX_ID", full_name)

    assert build_vector_search_index_resource() == full_name


def test_build_vector_search_index_resource_lists_missing_values(monkeypatch):
    for key in ("GCP_PROJECT_ID", "GCP_REGION", "VECTOR_SEARCH_INDEX_ID"):
        monkeypatch.delenv(key, raising=False)

    with pytest.raises(RuntimeError, match="Missing Vector Search environment variables"):
        build_vector_search_index_resource()


def test_make_datapoint_id_is_stable_and_safe():
    first = make_datapoint_id("raw-bucket", "papers/attention.pdf", 3)
    second = make_datapoint_id("raw-bucket", "papers/attention.pdf", 3)

    assert first == second
    assert first.startswith("chunk_")
    assert first.replace("_", "").replace("-", "").isalnum()


def test_build_chunk_payload_preserves_content_and_metadata():
    payload = build_chunk_payload(
        page_content="Transformer context",
        metadata={"source_object": "papers/attention.pdf", "page": 7},
    )

    assert payload == {
        "pageContent": "Transformer context",
        "metadata": {"source_object": "papers/attention.pdf", "page": 7},
    }


def test_function_module_imports_without_startup_errors():
    assert importlib.import_module("main")


def test_index_datapoint_uses_vertex_ai_v1_type():
    main = importlib.import_module("main")
    datapoint = main._make_index_datapoint("chunk_123", [0.1, 0.2])

    assert datapoint.__class__.__module__ == "google.cloud.aiplatform_v1.types.index"
    assert datapoint.datapoint_id == "chunk_123"
    assert list(datapoint.feature_vector) == pytest.approx([0.1, 0.2])
