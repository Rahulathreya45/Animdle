"""Kitsu (JSON:API): age rating and titles.

Kitsu keeps a `/mappings` table, so one call looks up 20 MAL ids at once and, with `include=item`,
returns the anime itself. No published rate limit (it throttles heavy clients), so we stay at ~2.5 req/s.
"""
from __future__ import annotations

from .common import KITSU_MISSING, KITSU_OUT, RateLimiter, append_jsonl, batches, now, read_jsonl, request_with_backoff

URL = "https://kitsu.io/api/edge/mappings"
BATCH = 20  # Kitsu's max page size
HEADERS = {"Accept": "application/vnd.api+json", "User-Agent": "animdle/0.1"}
limiter = RateLimiter(0.4)


def parse_mappings(body: dict) -> dict[int, dict]:
    """Mappings response -> {mal_id: trimmed Kitsu record}."""
    items = {(i["type"], i["id"]): i for i in body.get("included", [])}
    found = {}
    for m in body["data"]:
        ref = m["relationships"]["item"]["data"]
        item = items.get((ref["type"], ref["id"]))
        if ref["type"] != "anime" or item is None:
            continue
        a = item["attributes"]
        mal_id = int(m["attributes"]["externalId"])
        found[mal_id] = {
            "mal_id": mal_id,
            "id": item["id"],
            "subtype": a.get("subtype"),
            "title_en": (a.get("titles") or {}).get("en"),
            "canonical_title": a.get("canonicalTitle"),
            "age_rating": a.get("ageRating"),
            "age_rating_guide": a.get("ageRatingGuide"),
        }
    return found


def lookup(batch: list[int]) -> dict[int, dict]:
    found: dict[int, dict] = {}
    offset = 0
    while True:
        r = request_with_backoff("GET", URL, limiter, headers=HEADERS, params={
            "filter[externalSite]": "myanimelist/anime",
            "filter[externalId]": ",".join(map(str, batch)),
            "include": "item",
            "fields[mappings]": "externalId,item",  # keep the `item` relationship or the sparse fieldset drops it
            "fields[anime]": "titles,canonicalTitle,ageRating,ageRatingGuide,subtype",
            "page[limit]": BATCH, "page[offset]": offset,
        })
        r.raise_for_status()
        body = r.json()
        found.update(parse_mappings(body))
        if "next" not in body.get("links", {}):
            return found
        offset += BATCH


def run(mal_ids: list[int]) -> None:
    done = {r["mal_id"] for r in read_jsonl(KITSU_OUT)} | {r["mal_id"] for r in read_jsonl(KITSU_MISSING)}
    todo = [i for i in mal_ids if i not in done]
    print(f"kitsu: {len(todo)} to fetch in {-(-len(todo) // BATCH)} requests")
    for n, batch in enumerate(batches(todo, BATCH), 1):
        found = lookup(batch)
        ts = now()
        append_jsonl(KITSU_OUT, ({**rec, "_loaded_at": ts} for rec in found.values()))
        append_jsonl(KITSU_MISSING, ({"mal_id": i, "_loaded_at": ts} for i in batch if i not in found))
        if n % 50 == 0:
            print(f"kitsu: {n * BATCH}/{len(todo)}")
    print("kitsu: done")
