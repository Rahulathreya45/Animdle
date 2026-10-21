import type { CSSProperties } from "react";
import styles from "./ClueTile.module.css";

// One clue box, in the statuses check_guess returns (warehouse/supabase_schema.sql).
// "partial" (sets such as genres) shares the amber of "close".
export type ClueStatus = "match" | "close" | "partial" | "miss" | "unknown";
export type ClueDirection = "up" | "down" | null;

type Props = {
  label: string;
  value: string;
  status: ClueStatus;
  direction?: ClueDirection;
  /** seconds; staggers the flip-in so a row reveals left to right */
  revealDelay?: number;
  /** false for tiles that are already on screen (older guesses) */
  animate?: boolean;
  /** game tiles: corner glyph per status, spoken description, no label under the tile */
  detailed?: boolean;
};

const STATUS_WORD: Record<ClueStatus, string> = {
  match: "exact match",
  close: "close",
  partial: "partial match",
  miss: "no match",
  unknown: "unknown",
};

const GLYPH: Record<ClueStatus, string> = {
  match: "M5 12.5l4.5 4.5L19 7.5",
  close: "M4 14c3-5 5-5 8 0s5 5 8 0",
  partial: "M4 14c3-5 5-5 8 0s5 5 8 0",
  miss: "M6 6l12 12M18 6L6 18",
  unknown: "M9 9a3 3 0 1 1 4 2.8c-.7.4-1 .9-1 1.7M12 18h.01",
};

export function ClueTile({ label, value, status, direction = null, revealDelay = 0, animate = true, detailed = false }: Props) {
  const spoken = `${label}: ${value}, ${STATUS_WORD[status]}${direction ? `, answer is ${direction === "up" ? "higher" : "lower"}` : ""}`;

  return (
    <div className={styles.cell}>
      <div
        className={styles.tile}
        data-status={status}
        data-still={!animate || undefined}
        data-detailed={detailed || undefined}
        style={{ "--delay": `${revealDelay}s` } as CSSProperties}
        {...(detailed ? { role: "group", "aria-label": spoken, title: value } : {})}
      >
        <span className={styles.value} aria-hidden={detailed || undefined}>{value}</span>
        {direction && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={direction === "up" ? "M12 19V5M5 12l7-7 7 7" : "M12 5v14M5 12l7 7 7-7"} />
          </svg>
        )}
        {detailed && (
          <svg className={styles.glyph} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={GLYPH[status]} />
          </svg>
        )}
      </div>
      {!detailed && <span className={styles.label}>{label}</span>}
    </div>
  );
}
