"""Shared helpers for the ingestion scripts: paths, JSONL io, rate limiting, retrying requests."""
from __future__ import annotations

import datetime as dt
import json
import os
import pathlib
import time
from typing import Iterable, Iterator

import requests

REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]
RAW_DIR = pathlib.Path(os.environ.get("ANIMDLE_RAW_DIR", REPO_ROOT / "data" / "raw"))

ANILIST_OUT = RAW_DIR / "anilist_media.jsonl"
ANILIST_STATE = RAW_DIR / "anilist_state.json"
KITSU_OUT = RAW_DIR / "kitsu_anime.jsonl"
KITSU_MISSING = RAW_DIR / "kitsu_missing.jsonl"  # mal_ids Kitsu has no mapping for, so we don't retry them
SHIKI_OUT = RAW_DIR / "shikimori_anime.jsonl"
SHIKI_MISSING = RAW_DIR / "shikimori_missing.jsonl"
SHIKI_FRANCHISE_OUT = RAW_DIR / "shikimori_franchise.jsonl"


def now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def append_jsonl(path: pathlib.Path, records: Iterable[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        for r in records:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


def read_jsonl(path: pathlib.Path) -> Iterator[dict]:
    if not path.exists():
        return
    with path.open(encoding="utf-8") as f:
        for line in f:
            if line.strip():
                yield json.loads(line)


class RateLimiter:
    """Blocks so that calls are at least `min_interval` seconds apart."""

    def __init__(self, min_interval: float):
        self.min_interval = min_interval
        self._last = 0.0

    def wait(self) -> None:
        delta = time.monotonic() - self._last
        if delta < self.min_interval:
            time.sleep(self.min_interval - delta)
        self._last = time.monotonic()


def request_with_backoff(method: str, url: str, limiter: RateLimiter, retries: int = 6, **kwargs) -> requests.Response:
    """Rate-limited request. Retries 429 / 5xx / network errors with backoff.

    Returns the response for anything else (including 4xx), so the caller decides what a 404 means.
    """
    for attempt in range(retries):
        limiter.wait()
        try:
            r = requests.request(method, url, timeout=60, **kwargs)
        except requests.RequestException as e:
            print(f"{type(e).__name__} on {url}, retrying")
            time.sleep(10 * (attempt + 1))
            continue
        if r.status_code == 429:
            wait = int(r.headers.get("Retry-After", 30)) + 1
            print(f"429 from {url.split('/')[2]}, sleeping {wait}s")
            time.sleep(wait)
            continue
        if r.status_code >= 500:
            time.sleep(10 * (attempt + 1))
            continue
        return r
    raise RuntimeError(f"{url} failed after {retries} attempts")


def batches(items: list, n: int) -> Iterator[list]:
    for i in range(0, len(items), n):
        yield items[i:i + n]
