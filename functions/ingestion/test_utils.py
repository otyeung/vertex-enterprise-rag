import os

import pytest

from utils import build_postgres_connection_string, extract_storage_object


def test_extract_storage_object_reads_bucket_and_name():
    storage_object = extract_storage_object(
        {"bucket": "raw-bucket", "name": "rfp/example.pdf"}
    )

    assert storage_object.bucket == "raw-bucket"
    assert storage_object.name == "rfp/example.pdf"


def test_extract_storage_object_rejects_missing_name():
    with pytest.raises(ValueError, match="CloudEvent data must include bucket and name"):
        extract_storage_object({"bucket": "raw-bucket"})


def test_build_postgres_connection_string(monkeypatch):
    monkeypatch.setenv("DB_HOST", "10.1.2.3")
    monkeypatch.setenv("DB_PORT", "5432")
    monkeypatch.setenv("DB_NAME", "rag_app")
    monkeypatch.setenv("DB_USER", "rag_app")
    monkeypatch.setenv("DB_PASSWORD", "secret")

    assert (
        build_postgres_connection_string()
        == "postgresql+psycopg://rag_app:secret@10.1.2.3:5432/rag_app"
    )


def test_build_postgres_connection_string_lists_missing_values(monkeypatch):
    for key in ("DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"):
        monkeypatch.delenv(key, raising=False)

    with pytest.raises(RuntimeError, match="Missing database environment variables"):
        build_postgres_connection_string()
