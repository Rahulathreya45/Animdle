"""Explicit BigQuery schemas for the raw tables (one per landed JSONL file).

Explicit beats autodetect for a raw layer: autodetect samples the first rows only, so a field that first
appears later gets dropped or breaks the load. Schemas are plain dicts in BigQuery's API format, so they work
with `SchemaField.from_api_repr` and `bq load --schema` alike.

Nested objects stay nested (RECORD / REPEATED) so dbt staging can UNNEST them.
"""
from __future__ import annotations


def f(name: str, type_: str = "STRING", mode: str = "NULLABLE", fields: list[dict] | None = None) -> dict:
    d = {"name": name, "type": type_, "mode": mode}
    if fields:
        d["fields"] = fields
    return d


def record(name: str, fields: list[dict], repeated: bool = False) -> dict:
    return f(name, "RECORD", "REPEATED" if repeated else "NULLABLE", fields)


_title = [f("english")]
_date = [f("year", "INT64"), f("month", "INT64"), f("day", "INT64")]

ANILIST_MEDIA = [
    f("id", "INT64"), f("idMal", "INT64"),
    record("title", _title),
    f("format"), f("status"), f("season"), f("seasonYear", "INT64"),
    record("startDate", _date), record("endDate", _date),
    f("episodes", "INT64"), f("duration", "INT64"), f("source"), f("countryOfOrigin"), f("isAdult", "BOOL"),
    f("genres", "STRING", "REPEATED"),
    f("averageScore", "INT64"), f("popularity", "INT64"), f("favourites", "INT64"),
    record("studios", [record("edges", [
        f("isMain", "BOOL"),
        record("node", [f("id", "INT64"), f("name"), f("isAnimationStudio", "BOOL")]),
    ], repeated=True)]),
    record("relations", [record("edges", [
        f("relationType"),
        record("node", [f("id", "INT64"), f("idMal", "INT64"), f("type"), f("format"), record("title", _title)]),
    ], repeated=True)]),
    record("characters", [record("edges", [
        f("role"),
        record("node", [f("id", "INT64"), record("name", [f("full"), f("native")]), f("favourites", "INT64")]),
    ], repeated=True)]),
    f("_loaded_at", "TIMESTAMP"),
]

KITSU_ANIME = [
    f("mal_id", "INT64"), f("id"), f("subtype"), f("title_en"), f("canonical_title"),
    f("age_rating"), f("age_rating_guide"),
    f("_loaded_at", "TIMESTAMP"),
]

SHIKIMORI_ANIME = [
    f("mal_id", "INT64"), f("id", "INT64"), f("name"), f("english"), f("score", "FLOAT64"), f("franchise"),
    record("studios", [f("id", "INT64"), f("name")], repeated=True),
    f("_loaded_at", "TIMESTAMP"),
]

SHIKIMORI_FRANCHISE = [
    f("franchise"), f("current_id", "INT64"), f("status_code", "INT64"),
    record("nodes", [f("id", "INT64"), f("year", "INT64"), f("date", "INT64")], repeated=True),
    record("links", [f("source_id", "INT64"), f("target_id", "INT64"), f("relation")], repeated=True),
    f("_loaded_at", "TIMESTAMP"),
]

# table name -> (local file in data/raw, schema)
TABLES = {
    "anilist_media": ("anilist_media.jsonl", ANILIST_MEDIA),
    "kitsu_anime": ("kitsu_anime.jsonl", KITSU_ANIME),
    "shikimori_anime": ("shikimori_anime.jsonl", SHIKIMORI_ANIME),
    "shikimori_franchise": ("shikimori_franchise.jsonl", SHIKIMORI_FRANCHISE),
}
