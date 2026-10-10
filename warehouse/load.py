"""Load the landed JSONL files into BigQuery raw tables.

python -m warehouse.load                 # local -> GCS -> BigQuery (default)
python -m warehouse.load --direct        # local -> BigQuery, no bucket
python -m warehouse.load --tables kitsu_anime shikimori_anime

Config comes from the environment (or a .env file, see .env.example). Auth is Application Default Credentials:
run `gcloud auth application-default login` once. No key files.

Each run replaces the raw tables (WRITE_TRUNCATE) from the full local files, so it is safe to re-run.
Load jobs are free; you only pay for the storage.
"""
from __future__ import annotations

import argparse
import datetime as dt
import os
import pathlib

from dotenv import load_dotenv
from google.cloud import bigquery, storage

from ingestion.common import RAW_DIR, read_jsonl
from .schemas import TABLES

load_dotenv()


def env(name: str, default: str | None = None) -> str:
    value = os.environ.get(name, default)
    if not value:
        raise SystemExit(f"Set {name} (see .env.example)")
    return value


def ensure_dataset(client: bigquery.Client, dataset_id: str, location: str) -> None:
    ds = bigquery.Dataset(f"{client.project}.{dataset_id}")
    ds.location = location
    client.create_dataset(ds, exists_ok=True)


def upload_to_gcs(path: pathlib.Path, table: str, bucket_name: str) -> str:
    """Raw archive layout: raw/<table>/load_date=YYYY-MM-DD/<file>. Each day's copy is kept."""
    blob_name = f"raw/{table}/load_date={dt.date.today().isoformat()}/{path.name}"
    blob = storage.Client().bucket(bucket_name).blob(blob_name)
    blob.upload_from_filename(str(path))
    return f"gs://{bucket_name}/{blob_name}"


def load_table(client: bigquery.Client, table: str, filename: str, schema: list[dict], dataset_id: str,
               bucket: str | None) -> None:
    path = RAW_DIR / filename
    if not path.exists():
        print(f"{table}: {path} not found, skipping")
        return

    table_id = f"{client.project}.{dataset_id}.{table}"
    job_config = bigquery.LoadJobConfig(
        source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON,
        schema=[bigquery.SchemaField.from_api_repr(f) for f in schema],
        write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
    )  # unknown fields in the file fail the load on purpose: the schema is the contract

    if bucket:
        uri = upload_to_gcs(path, table, bucket)
        job = client.load_table_from_uri(uri, table_id, job_config=job_config)
    else:
        with path.open("rb") as fh:
            job = client.load_table_from_file(fh, table_id, job_config=job_config)
    job.result()

    loaded = client.get_table(table_id).num_rows
    expected = sum(1 for _ in read_jsonl(path))
    status = "OK" if loaded == expected else "MISMATCH"
    print(f"{table}: {loaded} rows in BigQuery, {expected} in file [{status}]")
    if loaded != expected:
        raise SystemExit(f"{table}: row count mismatch")


def main() -> None:
    p = argparse.ArgumentParser(prog="python -m warehouse.load", description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--direct", action="store_true", help="skip GCS and load straight from local files")
    p.add_argument("--tables", nargs="+", choices=list(TABLES), default=list(TABLES))
    args = p.parse_args()

    project = env("GCP_PROJECT")
    location = env("BQ_LOCATION", "us-central1")
    dataset_id = env("BQ_RAW_DATASET", "animdle_raw")
    bucket = None if args.direct else env("GCS_BUCKET")

    client = bigquery.Client(project=project, location=location)
    ensure_dataset(client, dataset_id, location)
    for table in args.tables:
        filename, schema = TABLES[table]
        load_table(client, table, filename, schema, dataset_id, bucket)


if __name__ == "__main__":
    main()
