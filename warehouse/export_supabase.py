"""Copy the game marts from BigQuery into Supabase (Postgres).

python -m warehouse.export_supabase --init                       # create tables / indexes / policies, then export
python -m warehouse.export_supabase                              # export from animedle_prod_marts
python -m warehouse.export_supabase --dataset animedle_dev_marts # export from dev

All tables are replaced inside ONE transaction (truncate + COPY), so the app sees either the old data or the new
data, never a half-loaded table. Row counts are checked against BigQuery before committing.
Needs SUPABASE_DB_URL in .env (the Session pooler connection string) and gcloud application-default credentials.
"""
from __future__ import annotations

import argparse
import os
import pathlib

import psycopg
from dotenv import load_dotenv
from google.cloud import bigquery
from psycopg.types.json import Jsonb

load_dotenv()

SCHEMA_SQL = pathlib.Path(__file__).with_name("supabase_schema.sql")

# Postgres table -> BigQuery mart. Columns are matched by name, so the marts and the schema must stay in sync.
TABLES = {
    "franchises": "dim_franchise",
    "anime": "dim_anime",
    "anime_characters": "dim_anime_characters",
    "search_titles": "dim_search_titles",
    "daily_puzzles": "fct_daily_puzzles",
}


def env(name: str, default: str | None = None) -> str:
    value = os.environ.get(name, default)
    if not value:
        raise SystemExit(f"Set {name} in .env")
    return value


def pg_columns(cur: psycopg.Cursor, table: str) -> list[tuple[str, str]]:
    """(column, type) pairs of a Postgres table, in table order."""
    cur.execute(
        """select a.attname, format_type(a.atttypid, a.atttypmod)
           from pg_attribute a
           where a.attrelid = %s::regclass and a.attnum > 0 and not a.attisdropped
           order by a.attnum""",
        (table,),
    )
    return cur.fetchall()


def to_pg(value, pg_type: str):
    """BigQuery row value -> value psycopg can COPY."""
    if value is None:
        return None
    if pg_type == "jsonb":
        return Jsonb(value)
    return value


def export_table(cur: psycopg.Cursor, bq: bigquery.Client, table: str, source: str) -> None:
    columns = pg_columns(cur, table)
    names = [c for c, _ in columns]
    bq_table = bq.get_table(source)
    missing = set(names) - {f.name for f in bq_table.schema}
    if missing:
        raise SystemExit(f"{table}: columns missing in {source}: {sorted(missing)}. Re-run dbt or update the schema.")

    cur.execute(f'truncate table "{table}"')
    col_list = ", ".join(f'"{c}"' for c in names)
    with cur.copy(f'copy "{table}" ({col_list}) from stdin') as copy:
        copy.set_types([t for _, t in columns])
        for row in bq.list_rows(bq_table, selected_fields=[f for f in bq_table.schema if f.name in set(names)]):
            copy.write_row([to_pg(row[c], t) for c, t in columns])

    cur.execute(f'select count(*) from "{table}"')
    loaded = cur.fetchone()[0]
    print(f"{table}: {loaded} rows (BigQuery {source}: {bq_table.num_rows})")
    if loaded != bq_table.num_rows:
        raise SystemExit(f"{table}: row count mismatch, rolling back")


def main() -> None:
    p = argparse.ArgumentParser(prog="python -m warehouse.export_supabase", description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--dataset", default=os.environ.get("BQ_MARTS_DATASET", "animedle_prod_marts"))
    p.add_argument("--init", action="store_true", help="apply supabase_schema.sql first (idempotent)")
    p.add_argument("--tables", nargs="+", choices=list(TABLES), default=list(TABLES))
    args = p.parse_args()

    project = env("GCP_PROJECT")
    bq = bigquery.Client(project=project, location=env("BQ_LOCATION", "us-central1"))

    with psycopg.connect(env("SUPABASE_DB_URL"), prepare_threshold=None) as conn:
        if args.init:
            conn.execute(SCHEMA_SQL.read_text(encoding="utf-8"))
            conn.commit()
            print("schema applied")
        with conn.transaction(), conn.cursor() as cur:  # all tables or nothing
            for table in args.tables:
                export_table(cur, bq, table, f"{project}.{args.dataset}.{TABLES[table]}")
    print("done")


if __name__ == "__main__":
    main()
