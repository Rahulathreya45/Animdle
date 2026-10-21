"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { guessHref, type GuessMode, type PlayType } from "@/config/game";
import { formatValue } from "@/game/format";
import type { ClueDef, Game } from "@/game/types";
import buttons from "../buttons.module.css";
import { Thumb } from "./Thumb";
import styles from "./EndCards.module.css";

type Props = {
  game: Game;
  mode: GuessMode;
  play: PlayType;
  clues: ClueDef[];
  /** move focus to the heading (only when the game just ended, not on a reload) */
  focusHeading: boolean;
  onPlayRandom: () => void;
};

function Actions({ mode, play, onPlayRandom, dark }: Pick<Props, "mode" | "play" | "onPlayRandom"> & { dark?: boolean }) {
  return (
    <div className={styles.actions}>
      {play === "random" ? (
        <button type="button" className={dark ? styles.light : buttons.primary} onClick={onPlayRandom}>Play random</button>
      ) : (
        <Link href={guessHref(mode, "random")} className={dark ? styles.light : buttons.primary}>Play random</Link>
      )}
      <Link href="/" className={dark ? styles.ghost : buttons.secondary}>Back home</Link>
    </div>
  );
}

function AnswerChips({ game, clues }: { game: Game; clues: ClueDef[] }) {
  return (
    <ul className={styles.chips} aria-label="The answer's clues">
      {clues.map((c) => (
        <li key={c.clue_key} className={styles.chip}>
          <span className={styles.chipLabel}>{c.label}</span> {formatValue(c.clue_key, game.answer?.clues[c.clue_key])}
        </li>
      ))}
    </ul>
  );
}

// Jujutsu Kaisen evocation: rings and rays burst out behind the result (once, 600ms).
export function WinCard({ game, mode, play, clues, focusHeading, onPlayRandom }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusHeading) heading.current?.focus();
  }, [focusHeading]);
  const answer = game.answer;
  if (!answer) return null;

  return (
    <section className={styles.win} aria-label="You won">
      <div className={styles.burst}>
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className={styles.ring} style={{ width: 120 + i * 90, height: 120 + i * 90, animationDelay: `${i * 40}ms` }} aria-hidden="true" />
        ))}
        <div className={styles.strip}>
          <h2 ref={heading} tabIndex={-1} className={styles.winTitle}>
            Solved in {game.attempts} {game.attempts === 1 ? "guess" : "guesses"}
          </h2>
        </div>
      </div>
      <div className={styles.body}>
        <div className={styles.who}>
          <Thumb src={answer.image_url} name={answer.name} size={96} />
          <p className={styles.answerName}>{answer.name}</p>
        </div>
        <AnswerChips game={game} clues={clues} />
        <Actions mode={mode} play={play} onPlayRandom={onPlayRandom} />
      </div>
    </section>
  );
}

// Death Note evocation: a black notebook page with ruled lines and a red margin.
export function LoseCard({ game, mode, play, clues, focusHeading, onPlayRandom }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusHeading) heading.current?.focus();
  }, [focusHeading]);
  const answer = game.answer;
  if (!answer) return null;

  return (
    <section className={styles.lose} aria-label={game.gave_up ? "Answer revealed" : "Out of guesses"}>
      <div className={styles.page}>
        <h2 ref={heading} tabIndex={-1} className={styles.loseEyebrow}>The answer was</h2>
        <div className={styles.who}>
          <Thumb src={answer.image_url} name={answer.name} size={96} />
          <p className={styles.loseName}>{answer.name}</p>
        </div>
        <AnswerChips game={game} clues={clues} />
        {!game.gave_up && <p className={styles.loseLine}>You used all {game.max_attempts} guesses.</p>}
        <Actions mode={mode} play={play} onPlayRandom={onPlayRandom} dark />
      </div>
    </section>
  );
}
