"""Which MAL ids to look up in Kitsu and Shikimori."""
from __future__ import annotations

import pathlib

from .common import ANILIST_OUT, read_jsonl


def mal_ids(path: pathlib.Path = ANILIST_OUT, limit: int | None = None) -> list[int]:
    """AniList entries with an `idMal`, MUSIC excluded, one per MAL id, most popular first.

    Most popular first means stopping a run early still leaves the useful titles.
    """
    rows = [r for r in read_jsonl(path) if r["format"] != "MUSIC" and r["idMal"] is not None]
    rows.sort(key=lambda r: r["popularity"] or 0, reverse=True)
    seen: set[int] = set()
    ids = []
    for r in rows:
        if r["idMal"] not in seen:
            seen.add(r["idMal"])
            ids.append(int(r["idMal"]))
    return ids[:limit] if limit else ids
