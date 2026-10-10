# Animdle

An entity-resolved anime data warehouse with a title-guessing game on top. The warehouse and dbt models are the core; the game is an add-on.

## Data flow
```
AniList (GraphQL) ──┐
Kitsu (JSON:API)  ──┼─> data/raw/*.jsonl ─> GCS bucket ─> BigQuery raw tables ─> dbt (staging, marts) ─> app
Shikimori (REST)  ──┘      ingestion/                      warehouse/
```
- **AniList** is the catalog: titles, dates, genres, studios, relations, top characters, and `idMal`.
- **Kitsu** and **Shikimori** are looked up by MAL id: age rating (Kitsu), score, studios and the franchise graph (Shikimori).
- Raw responses are landed as JSONL with a `_loaded_at` timestamp. All transformation happens in dbt.

## Layout
| Path | What |
|---|---|
| `ingestion/` | one module per source, resumable, rate-limit aware. `python -m ingestion <step>` |
| `warehouse/` | BigQuery schemas and the loader. `python -m warehouse.load` |
| `tests/` | unit tests, plus a check that every landed file fits its BigQuery schema |
| `docs/gcp_setup.md` | one-time GCP console setup |
| `notebooks/` | exploration only |
| `data/raw/` | landed files (gitignored) |

## Run it
```
pip install -r requirements.txt
python -m ingestion anilist            # ~20 min: full catalog
python -m ingestion all --limit 500    # Kitsu + Shikimori for the 500 most popular titles (test run)
python -m ingestion all                # everything; re-run any time, it resumes
python -m warehouse.load               # after docs/gcp_setup.md
pytest
```

Rate limits: AniList 30 req/min; Shikimori 5 req/s and 90 req/min (shared by REST and GraphQL); Kitsu publishes none, so ingestion stays at ~2.5 req/s.
