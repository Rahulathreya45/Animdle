"use client";

import Link from "next/link";
import { useId, useState, useSyncExternalStore } from "react";
import { bestStreakKey, higherLowerHref, type HigherLowerKind } from "@/config/game";
import buttons from "@/components/buttons.module.css";
import styles from "./panels.module.css";

type Props = {
  kind: HigherLowerKind;
  title: string;
  question: string;
  /** where the numbers come from, shown behind the info button */
  source: string;
  playLabel: string;
  /** ink = the dark half of the split panel, paper = the light half */
  side: "ink" | "paper";
};

// Best streak is kept for the browser session only (sessionStorage); the game screen writes it.
function useBestStreak(kind: HigherLowerKind) {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener("storage", onChange);
      return () => window.removeEventListener("storage", onChange);
    },
    () => {
      try {
        return Number(sessionStorage.getItem(bestStreakKey(kind))) || 0;
      } catch {
        return 0;
      }
    },
    () => 0,
  );
}

export function HigherLowerPanel({ kind, title, question, source, playLabel, side }: Props) {
  const [showSource, setShowSource] = useState(false);
  const best = useBestStreak(kind);
  const titleId = useId();
  const sourceId = useId();

  return (
    <article className={side === "ink" ? styles.hlInk : styles.hlPaper} aria-labelledby={titleId}>
      <span className={side === "ink" ? styles.toneLeft : styles.tone} aria-hidden="true" />
      <div className={styles.titleRow}>
        <h3 id={titleId} className={styles.title}>{title}</h3>
        <button
          type="button"
          className={styles.infoButton}
          aria-label={`How ${title.toLowerCase()} is measured`}
          aria-expanded={showSource}
          aria-controls={sourceId}
          onClick={() => setShowSource((v) => !v)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5M12 7.5v.5" />
          </svg>
        </button>
      </div>
      {showSource && <p id={sourceId} className={styles.sourceNote}>{source}</p>}
      <p className={styles.soft}>{question}</p>
      <p className={styles.best}>
        Best: <strong>{best}</strong>
      </p>
      <div className={styles.push}>
        <Link href={higherLowerHref(kind)} className={side === "ink" ? buttons.inverted : buttons.primary}>
          {playLabel}
        </Link>
      </div>
    </article>
  );
}
