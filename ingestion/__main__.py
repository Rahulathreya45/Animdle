"""python -m ingestion <step> [--limit N]

Steps: anilist, kitsu, shikimori, franchise, all. Every step is resumable.
Kitsu and Shikimori are looked up by MAL id, so `anilist` has to have run first.
"""
import argparse

from . import anilist, kitsu, shikimori
from .targets import mal_ids


def main() -> None:
    p = argparse.ArgumentParser(prog="python -m ingestion", description=__doc__)
    p.add_argument("step", choices=["anilist", "kitsu", "shikimori", "franchise", "all"])
    p.add_argument("--limit", type=int, default=None, help="only the N most popular titles (for a test run)")
    args = p.parse_args()

    if args.step in ("anilist", "all"):
        anilist.run()
    if args.step in ("kitsu", "shikimori", "franchise", "all"):
        ids = mal_ids(limit=args.limit)
        print(len(ids), "MAL ids to look up")
        if args.step in ("kitsu", "all"):
            kitsu.run(ids)
        if args.step in ("shikimori", "all"):
            shikimori.run_anime(ids)
        if args.step in ("franchise", "all"):
            shikimori.run_franchise(ids)  # needs shikimori anime to have landed (it reads the franchise slugs)


if __name__ == "__main__":
    main()
