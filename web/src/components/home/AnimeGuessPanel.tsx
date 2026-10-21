"use client";

import { useState } from "react";
import { GuessPanel, type ExampleClue } from "./GuessPanel";
import styles from "./panels.module.css";

const EXAMPLE: ExampleClue[] = [
  { label: "Genres", value: "Action, Drama", status: "partial" },
  { label: "Year", value: "2002", status: "miss", direction: "up" },
  { label: "Studio", value: "Pierrot", status: "match" },
  { label: "Source", value: "Manga", status: "match" },
];

// Normal mode guesses the whole series (franchise); hard mode makes every season and movie its own answer.
export function AnimeGuessPanel() {
  const [hard, setHard] = useState(false);

  return (
    <GuessPanel
      id="guess-anime"
      title="Guess the anime"
      description="Every guess is compared with the answer on genres, year, studio, score, source and more."
      example={EXAMPLE}
      exampleLabel="Example guess Naruto: genres partly match, the answer aired later than 2002, studio and source match"
      revealStart={0.15}
      mode={hard ? "anime" : "franchise"}
      dailyLabel="Play today's anime"
    >
      <label className={styles.switchRow}>
        <input type="checkbox" className={styles.switchInput} checked={hard} onChange={(e) => setHard(e.target.checked)} />
        <span className={styles.switch} aria-hidden="true" />
        <span className={styles.switchText}>
          <span className={styles.switchTitle}>Hard mode</span>
          <span className={styles.switchHelp}>
            {hard ? "On: every season and movie is its own answer." : "Off: guess the whole series."}
          </span>
        </span>
      </label>
    </GuessPanel>
  );
}
