import Link from "next/link";
import type { ReactNode } from "react";
import { ClueTile, type ClueDirection, type ClueStatus } from "@/components/ClueTile";
import { guessHref, type GuessMode } from "@/config/game";
import buttons from "@/components/buttons.module.css";
import styles from "./panels.module.css";

export type ExampleClue = { label: string; value: string; status: ClueStatus; direction?: ClueDirection };

type Props = {
  id: string;
  title: string;
  description: string;
  /** an illustrative guess row; `exampleLabel` describes it for screen readers */
  example: ExampleClue[];
  exampleLabel: string;
  /** first tile's reveal delay, so the two panels flip in one after the other */
  revealStart: number;
  mode: GuessMode;
  dailyLabel: string;
  tone?: "left" | "right";
  children?: ReactNode;
};

export function GuessPanel({
  id, title, description, example, exampleLabel, revealStart, mode, dailyLabel, tone = "right", children,
}: Props) {
  return (
    <article className={styles.panel} aria-labelledby={id}>
      <span className={tone === "left" ? styles.toneLeft : styles.tone} aria-hidden="true" />
      <div className={styles.intro}>
        <h3 id={id} className={styles.title}>{title}</h3>
        <p className={styles.muted}>{description}</p>
      </div>

      <div className={styles.example} role="img" aria-label={exampleLabel}>
        {example.map((clue, i) => (
          <ClueTile key={clue.label} {...clue} revealDelay={revealStart + i * 0.15} />
        ))}
      </div>

      {children}

      <div className={styles.actions}>
        <Link href={guessHref(mode, "daily")} className={buttons.primary}>{dailyLabel}</Link>
        <Link href={guessHref(mode, "random")} className={buttons.secondary}>Random round</Link>
      </div>
    </article>
  );
}
