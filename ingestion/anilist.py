"""AniList (GraphQL): the full anime catalog. Gives us `idMal`, which Kitsu and Shikimori are looked up by.

AniList rejects any query that pages past 5,000 entries, and its `pageInfo.total` / `hasNextPage` are unreliable.
So the catalog is split into partitions that each stay under the cap (one per seasonYear plus catch-alls),
and a partition ends at the first empty page.
"""
from __future__ import annotations

import datetime as dt
import json
import time

import requests

from .common import ANILIST_OUT, ANILIST_STATE, append_jsonl, now, read_jsonl

URL = "https://graphql.anilist.co"
PER_PAGE = 50
MAX_PAGES_PER_PARTITION = 100  # 100 pages x 50 = the 5,000 entry cap

QUERY = """
query ($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    media(type: ANIME, __FILTERS__ sort: __SORT__) {
      id idMal
      title { english }
      format status season seasonYear
      startDate { year month day } endDate { year month day }
      episodes duration source countryOfOrigin isAdult
      genres
      averageScore popularity favourites
      studios { edges { isMain node { id name isAnimationStudio } } }
      relations { edges { relationType node { id idMal type format title { english } } } }
      characters(sort: FAVOURITES_DESC, perPage: 25) {
        edges { role node { id name { full native } favourites } }
      }
    }
  }
}
"""


def partitions(this_year: int | None = None) -> list[tuple[str, str, str]]:
    """(name, filter, sort) triples that together cover the catalog."""
    this_year = this_year or dt.date.today().year
    return (
        [(f"year={y}", f"seasonYear: {y},", "ID") for y in range(1910, this_year + 3)]
        + [("not_yet_released", "status: NOT_YET_RELEASED,", "ID"),
           ("newest_ids", "", "ID_DESC")]
    )


def build_query(filters: str, sort: str) -> str:
    return QUERY.replace("__FILTERS__", filters).replace("__SORT__", sort)


def fetch_page(query: str, page: int, retries: int = 6) -> tuple[list[dict], int]:
    """Returns (media, requests remaining in the rate-limit window)."""
    for attempt in range(retries):
        r = requests.post(URL, json={"query": query, "variables": {"page": page, "perPage": PER_PAGE}}, timeout=60)
        if r.status_code == 429:
            wait = int(r.headers.get("Retry-After", 60)) + 1
            print(f"429, sleeping {wait}s")
            time.sleep(wait)
            continue
        if r.status_code >= 500:
            time.sleep(5 * (attempt + 1))
            continue
        r.raise_for_status()
        remaining = int(r.headers.get("X-RateLimit-Remaining", 30))
        return r.json()["data"]["Page"]["media"], remaining
    raise RuntimeError(f"AniList page {page} failed after {retries} attempts")


def run() -> None:
    state = json.loads(ANILIST_STATE.read_text()) if ANILIST_STATE.exists() else {}
    done_parts = set(state.get("done", []))
    seen_ids = {m["id"] for m in read_jsonl(ANILIST_OUT)}  # skip entries already landed
    print(len(seen_ids), "entries already landed")

    for name, filters, sort in partitions():
        if name in done_parts:
            continue
        query = build_query(filters, sort)
        new = 0
        for page in range(1, MAX_PAGES_PER_PARTITION + 1):
            media, remaining = fetch_page(query, page)
            if not media:
                break
            fresh = [m for m in media if m["id"] not in seen_ids]
            append_jsonl(ANILIST_OUT, ({**m, "_loaded_at": now()} for m in fresh))
            seen_ids.update(m["id"] for m in fresh)
            new += len(fresh)
            time.sleep(61 if remaining <= 2 else 2.1)  # AniList allows ~30 req/min
        done_parts.add(name)
        ANILIST_STATE.write_text(json.dumps({"done": sorted(done_parts)}))  # checkpoint per finished partition
        print(f"{name}: {new} new entries (total {len(seen_ids)})")
    print("done")
