from dataclasses import dataclass
from os import environ
from urllib.parse import quote_plus


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


def build_postgres_connection_string() -> str:
    required_keys = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"]
    missing = [key for key in required_keys if not environ.get(key)]
    if missing:
        raise RuntimeError(
            "Missing database environment variables: " + ", ".join(sorted(missing))
        )

    user = quote_plus(environ["DB_USER"])
    password = quote_plus(environ["DB_PASSWORD"])
    host = environ["DB_HOST"]
    port = environ["DB_PORT"]
    database = environ["DB_NAME"]
    return f"postgresql+psycopg://{user}:{password}@{host}:{port}/{database}"
