"""AniList (GraphQL): the full anime catalog. Gives us `idMal`, which Kitsu and Shikimori are looked up by.

AniList rejects any query that pages past 5,000 entries, and its `pageInfo.total` / `hasNextPage` are unreliable.
So the catalog is split into popularity ranges that each stay well under the cap, and a partition ends at the
first empty page. Popularity is an integer on every entry, so the ranges cover the whole catalog.
(seasonYear was tried first and is unusable: it is null for ~3,300 entries, and AniList reads years before
~1940 as the next century, e.g. `seasonYear: 1917` returns 2017.)
"""
from __future__ import annotations

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
      title { romaji english native }
      synonyms
      format status season seasonYear
      startDate { year month day } endDate { year month day }
      episodes duration source countryOfOrigin isAdult
      genres
      tags { name rank isMediaSpoiler }
      averageScore popularity favourites
      coverImage { large }
      studios { edges { isMain node { id name isAnimationStudio } } }
      relations { edges { relationType node { id idMal type format title { english } } } }
      characters(sort: FAVOURITES_DESC, perPage: 25) {
        edges { role node { id name { full native } image { medium } gender age favourites } }
      }
    }
  }
}
"""


# (lo, hi] popularity buckets, sized from the catalog's distribution to hold <3,000 entries each
POPULARITY_EDGES = [50, 150, 400, 1000, 2000, 3500, 6000, 10000, 20000, 40000]


def partitions() -> list[tuple[str, str, str]]:
    """(name, filter, sort) triples that together cover the catalog."""
    parts = []
    lo = None
    for hi in POPULARITY_EDGES + [None]:
        # AniList's _greater / _lesser are strict, so (lo, hi] = greater: lo, lesser: hi + 1
        filters = (f"popularity_greater: {lo}, " if lo is not None else "") +                   (f"popularity_lesser: {hi + 1}, " if hi is not None else "")
        parts.append((f"popularity=({lo},{hi}]", filters, "ID"))
        lo = hi
    # catch-alls for entries whose popularity moved across a bucket edge during the run
    parts += [("not_yet_released", "status: NOT_YET_RELEASED,", "ID"),
              ("newest_ids", "", "ID_DESC")]
    return parts


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
        else:
            if name.startswith("popularity"):  # catch-alls are unfiltered and always fill the cap; that's expected
                print(f"WARNING: {name} hit the {MAX_PAGES_PER_PARTITION * PER_PAGE} entry cap, entries may be missing. "
                      "Split it with another POPULARITY_EDGES value.")
        done_parts.add(name)
        ANILIST_STATE.write_text(json.dumps({"done": sorted(done_parts)}))  # checkpoint per finished partition
        print(f"{name}: {new} new entries (total {len(seen_ids)})")
    print("done")
