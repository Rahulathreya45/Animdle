import Link from "next/link";
import { useEffect, useRef } from "react";
import buttons from "@/components/buttons.module.css";
import styles from "./HigherLowerGame.module.css";

// Wrong answer or win: replaces the Higher / Lower buttons, cards stay visible above. Focus goes to the heading.
export function GameOver({ won, streak, best, onAgain }: { won: boolean; streak: number; best: number; onAgain: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);

  return (
    <section className={styles.end} aria-labelledby="hl-end-title">
      <div className={styles.endText}>
        <h2 id="hl-end-title" ref={heading} tabIndex={-1} className={styles.endTitle}>
          {won ? "You win" : "Wrong"}
        </h2>
        <p>{won ? `${streak} in a row.` : `Streak: ${streak}`}</p>
        <p className={styles.muted}>Best: {best}</p>
      </div>
      <div className={styles.endActions}>
        <button type="button" className={buttons.primary} onClick={onAgain}>Play again</button>
        <Link href="/" className={buttons.secondary}>Back home</Link>
      </div>
    </section>
  );
}

export function LoadError({ empty, onRetry }: { empty: boolean; onRetry: () => void }) {
  const retry = useRef<HTMLButtonElement>(null);
  useEffect(() => retry.current?.focus(), []);

  return (
    <section className={styles.error} aria-labelledby="hl-error-title">
      <h2 id="hl-error-title" className={styles.endTitle}>{empty ? "No cards to show right now." : "Could not load cards."}</h2>
      <div className={styles.endActions}>
        <button type="button" ref={retry} className={buttons.primary} onClick={onRetry}>
          Try again
        </button>
        <Link href="/" className={buttons.secondary}>Back home</Link>
      </div>
    </section>
  );
}
