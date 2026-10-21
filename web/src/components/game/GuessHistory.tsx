"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { formatValue } from "@/game/format";
import type { ClueDef, Guess, GuessResult } from "@/game/types";
import { ClueTile } from "../ClueTile";
import { Thumb } from "./Thumb";
import styles from "./GuessHistory.module.css";

const BADGE: Record<GuessResult, string> = { correct: "Correct", same_franchise: "Same franchise", wrong: "Not it" };

type Props = {
  guesses: Guess[];
  clues: ClueDef[];
  /** attempt number whose tiles flip in; null for guesses loaded from a saved game */
  newest: number | null;
  busy: boolean;
};

// Mobile: one card per guess with a 3 column tile grid. Desktop: one table row per guess under a single
// header row (the same markup, laid out by CSS). Newest guess first.
export function GuessHistory({ guesses, clues, newest, busy }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState(false);
  const [more, setMore] = useState(false);
  const rows = [...guesses].sort((a, b) => b.attempt_no - a.attempt_no);
  const sameFranchise = guesses.some((g) => g.result === "same_franchise");

  // the table scrolls inside its own box when the clue columns get too narrow
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const check = () => {
      setScrollable(box.scrollWidth > box.clientWidth + 1);
      setMore(box.scrollLeft + box.clientWidth < box.scrollWidth - 1);
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(box);
    box.addEventListener("scroll", check, { passive: true });
    return () => {
      observer.disconnect();
      box.removeEventListener("scroll", check);
    };
  }, [rows.length, clues.length]);

  return (
    <section className={styles.history} aria-label="Your guesses" aria-busy={busy}>
      {sameFranchise && <p className={styles.note}>Blue means the right franchise, wrong season or movie.</p>}
      <div className={styles.frame} data-more={more || undefined}>
      <div
        ref={boxRef}
        className={styles.box}
        data-scrollable={scrollable || undefined}
        style={{ "--n": clues.length } as CSSProperties}
        {...(scrollable ? { tabIndex: 0, role: "region", "aria-label": "Guess history table" } : {})}
      >
        <div className={styles.table}>
          <div className={styles.head} aria-hidden="true">
            <span className={`${styles.headCell} ${styles.headFirst}`}>Guess</span>
            {clues.map((c) => (
              <span key={c.clue_key} className={styles.headCell}>{c.label}</span>
            ))}
          </div>
          {rows.length === 0 && <p className={styles.empty}>No guesses yet. Pick a name to start.</p>}
          {rows.map((g) => (
            <article key={g.attempt_no} className={styles.row} aria-label={`Guess ${g.attempt_no}: ${g.guess.name}, ${BADGE[g.result]}`}>
              <p className={styles.attemptM}>Guess {g.attempt_no}</p>
              <div className={styles.who}>
                <Thumb src={g.guess.image_url} name={g.guess.name} size={48} />
                <div className={styles.whoText}>
                  <p className={styles.name}>
                    <span className={styles.attemptD}>#{g.attempt_no}</span> {g.guess.name}
                  </p>
                  <span className={styles.badge} data-result={g.result}>{BADGE[g.result]}</span>
                </div>
              </div>
              <div className={styles.tiles}>
                {g.clues.map((c, i) => (
                  <div key={c.key} className={styles.slot}>
                    <ClueTile
                      label={c.label}
                      value={formatValue(c.key, c.value)}
                      status={c.status}
                      direction={c.direction}
                      revealDelay={i * 0.06}
                      animate={g.attempt_no === newest}
                      detailed
                    />
                    <span className={styles.slotLabel}>{c.label}</span>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
      </div>
      {scrollable && <p className={styles.scrollHint}>Scroll sideways to see all clues</p>}
    </section>
  );
}
