"""Shikimori: anime facts (GraphQL, batched) and the franchise graph (REST, one call per franchise).

Shikimori ids are MAL ids. Rate limit: 5 req/s and 90 req/min, shared by REST and GraphQL, so we run at ~85/min.
"""
from __future__ import annotations

from .common import (RateLimiter, SHIKI_FRANCHISE_OUT, SHIKI_MISSING, SHIKI_OUT, append_jsonl, batches, now,
                     read_jsonl, request_with_backoff)

GRAPHQL = "https://shikimori.one/api/graphql"
REST = "https://shikimori.one/api"
BATCH = 50
HEADERS = {"User-Agent": "animdle/0.1"}
limiter = RateLimiter(0.7)  # ~85 req/min, under the 90/min cap

QUERY = """
query ($ids: String!, $limit: PositiveInt!) {
  animes(ids: $ids, limit: $limit) {
    id malId name english score franchise
    studios { id name }
  }
}
"""


def to_record(a: dict, ts: str) -> dict:
    return {
        "mal_id": int(a["malId"] or a["id"]),
        "id": int(a["id"]),
        "name": a["name"],
        "english": a["english"],
        "score": a["score"],
        "franchise": a["franchise"],
        "studios": [{"id": int(s["id"]), "name": s["name"]} for s in a["studios"]],
        "_loaded_at": ts,
    }


def lookup(batch: list[int]) -> list[dict]:
    r = request_with_backoff("POST", GRAPHQL, limiter, headers=HEADERS,
                             json={"query": QUERY, "variables": {"ids": ",".join(map(str, batch)), "limit": BATCH}})
    r.raise_for_status()
    body = r.json()
    if body.get("errors"):
        raise RuntimeError(body["errors"])
    return body["data"]["animes"]


def run_anime(mal_ids: list[int]) -> None:
    done = {r["mal_id"] for r in read_jsonl(SHIKI_OUT)} | {r["mal_id"] for r in read_jsonl(SHIKI_MISSING)}
    todo = [i for i in mal_ids if i not in done]
    print(f"shikimori: {len(todo)} to fetch in {-(-len(todo) // BATCH)} requests")
    for n, batch in enumerate(batches(todo, BATCH), 1):
        ts = now()
        records = [to_record(a, ts) for a in lookup(batch)]
        got = {r["mal_id"] for r in records}
        append_jsonl(SHIKI_OUT, records)
        append_jsonl(SHIKI_MISSING, ({"mal_id": i, "_loaded_at": ts} for i in batch if i not in got))
        if n % 20 == 0:
            print(f"shikimori: {n * BATCH}/{len(todo)}")
    print("shikimori: done")


def franchise_representatives(mal_ids: list[int]) -> dict[str, int]:
    """One anime per franchise slug: the most popular member (mal_ids is ordered by popularity)."""
    rank = {m: n for n, m in enumerate(mal_ids)}
    rep: dict[str, int] = {}
    for rec in read_jsonl(SHIKI_OUT):
        slug = rec["franchise"]
        if slug and (slug not in rep or rank.get(rec["mal_id"], 1e9) < rank.get(rep[slug], 1e9)):
            rep[slug] = rec["mal_id"]
    return rep


def franchise_record(slug: str, graph: dict, ts: str) -> dict:
    """Trim a /franchise response to what we need.

    nodes: `id` is the anime id (= MAL id). Dropped: Russian name/kind, image, url.
    links: `source_id` / `target_id` are anime ids. Dropped: `id` (internal row id), `source` / `target`
    (positions in `nodes`, only for drawing) and `weight`.
    """
    return {
        "franchise": slug,
        "current_id": graph["current_id"],
        "nodes": [{"id": n["id"], "year": n.get("year"), "date": n.get("date")} for n in graph["nodes"]],
        "links": [{"source_id": l["source_id"], "target_id": l["target_id"], "relation": l["relation"]} for l in graph["links"]],
        "_loaded_at": ts,
    }


def run_franchise(mal_ids: list[int]) -> None:
    rep = franchise_representatives(mal_ids)
    rank = {m: n for n, m in enumerate(mal_ids)}
    slugs = sorted(rep, key=lambda s: rank.get(rep[s], 1e9))
    done = {r["franchise"] for r in read_jsonl(SHIKI_FRANCHISE_OUT)}
    todo = [s for s in slugs if s not in done]
    print(f"franchise: {len(slugs)} franchises, {len(todo)} to fetch")
    for n, slug in enumerate(todo, 1):
        r = request_with_backoff("GET", f"{REST}/animes/{rep[slug]}/franchise", limiter, headers=HEADERS)
        ts = now()
        if r.status_code >= 400:
            append_jsonl(SHIKI_FRANCHISE_OUT, [{"franchise": slug, "current_id": rep[slug], "status_code": r.status_code,
                                                "nodes": [], "links": [], "_loaded_at": ts}])
            continue
        append_jsonl(SHIKI_FRANCHISE_OUT, [franchise_record(slug, r.json(), ts)])
        if n % 100 == 0:
            print(f"franchise: {n}/{len(todo)}")
    print("franchise: done")
