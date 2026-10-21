"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { guessHref, HINT_AFTER_GUESSES, MAX_GUESSES, type GuessMode, type PlayType } from "@/config/game";
import {
  fetchClues,
  GameError,
  getGame,
  getPlayerId,
  giveUp,
  revealHint,
  saveRandomSession,
  savedRandomSession,
  startGame,
  submitGuess,
} from "@/game/api";
import { formatValue } from "@/game/format";
import type { ClueDef, Game as GameState } from "@/game/types";
import buttons from "../buttons.module.css";
import { DifficultyPicker } from "./DifficultyPicker";
import { LoseCard, WinCard } from "./EndCards";
import { GuessHistory } from "./GuessHistory";
import { GiveUpDialog } from "./GiveUpDialog";
import { GuessInput } from "./GuessInput";
import { HintPicker } from "./HintPicker";
import { TurnTracker } from "./TurnTracker";
import styles from "./Game.module.css";

type Phase = "loading" | "ready" | "failed" | "config" | "nodaily";
type Notice = { kind: "dup" | "error"; text: string } | null;

const TITLE: Record<GuessMode, string> = {
  franchise: "Guess the anime",
  anime: "Guess the anime",
  character: "Guess the character",
};

const DESC: Record<GuessMode, string> = {
  franchise: `Guess the anime in ${MAX_GUESSES} tries. Every guess shows how close you are on each clue.`,
  anime: `Guess the anime in ${MAX_GUESSES} tries. Every season and movie counts on its own.`,
  character: `Guess the character in ${MAX_GUESSES} tries. Every guess shows how close you are on each clue.`,
};
const HINT_NOTE = `After guesses ${HINT_AFTER_GUESSES.join(" and ")} you can reveal one clue.`;

const guessesLeft = (n: number) => `${n} ${n === 1 ? "guess" : "guesses"} left`;

export function Game({ mode, play }: { mode: GuessMode; play: PlayType }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [game, setGame] = useState<GameState | null>(null);
  const [clues, setClues] = useState<ClueDef[]>([]);
  const [tier, setTier] = useState(2);
  const [req, setReq] = useState({ n: 0, tier: 2, fresh: false });
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [newest, setNewest] = useState<number | null>(null);
  const [justEnded, setJustEnded] = useState(false);
  const [inputKey, setInputKey] = useState(0);
  const [announce, setAnnounce] = useState("");
  const lastPick = useRef<{ id: string; name: string } | null>(null);
  const focusInputNext = useRef(false);
  const retryRef = useRef<HTMLButtonElement>(null);

  // Load the clue columns and the game. Daily resumes on the server; a random round resumes from this tab.
  useEffect(() => {
    let live = true;
    async function begin() {
      if (play === "random" && !req.fresh) {
        const saved = savedRandomSession(mode);
        if (saved) {
          try {
            return await getGame(saved);
          } catch {
            // unknown or unreachable session: start a new round below
          }
        }
      }
      const started = await startGame(mode, play, getPlayerId(), req.tier);
      if (play === "random") saveRandomSession(mode, started.session_id);
      return started;
    }
    Promise.all([fetchClues(mode), begin()]).then(
      ([defs, loaded]) => {
        if (!live) return;
        setClues(defs);
        setGame(loaded);
        if (loaded.difficulty_tier) setTier(loaded.difficulty_tier);
        if (req.fresh) setAnnounce(`New round. ${loaded.max_attempts} guesses.`);
        focusInputNext.current = req.fresh;
        setPhase("ready");
      },
      (err: unknown) => {
        if (!live) return;
        const kind = err instanceof GameError ? err.kind : "other";
        setPhase(kind === "config" ? "config" : kind === "missing" ? "nodaily" : "failed");
      },
    );
    return () => {
      live = false;
    };
  }, [mode, play, req]);

  useEffect(() => {
    if (phase === "ready" && focusInputNext.current) {
      focusInputNext.current = false;
      document.getElementById("guess-box")?.focus();
    }
    if (phase === "failed") retryRef.current?.focus();
  }, [phase]);

  function newRound(nextTier: number) {
    setPhase("loading");
    setGame(null);
    setNotice(null);
    setNewest(null);
    setJustEnded(false);
    setTier(nextTier);
    setReq((r) => ({ n: r.n + 1, tier: nextTier, fresh: true }));
  }

  function retryLoad() {
    setPhase("loading");
    setReq((r) => ({ n: r.n + 1, tier: r.tier, fresh: r.fresh }));
  }

  function duplicate(name: string) {
    const text = `You already guessed ${name}`;
    setNotice({ kind: "dup", text });
    setAnnounce(`${text}.`);
  }

  async function submit(pick: { id: string; name: string }): Promise<boolean> {
    if (!game) return false;
    if (game.guesses.some((g) => g.guess.id === pick.id)) {
      duplicate(pick.name);
      return false;
    }
    lastPick.current = pick;
    setSubmitting(true);
    setNotice(null);
    try {
      const { feedback, game: next } = await submitGuess(game.session_id, pick.id);
      setGame(next);
      setNewest(feedback.attempt_no);
      const left = next.max_attempts - next.attempts;
      if (next.status === "won") {
        setAnnounce(`Correct. You solved it in ${next.attempts} ${next.attempts === 1 ? "guess" : "guesses"}.`);
      } else if (next.status === "lost") {
        setAnnounce(`Out of guesses. The answer was ${next.answer?.name}.`);
      } else {
        const result = feedback.result === "same_franchise" ? "Right franchise, wrong entry" : "Not it";
        const unlocked = next.hints_available > game.hints_available ? " A clue is now available." : "";
        setAnnounce(`${pick.name}: ${result}. ${guessesLeft(left)}.${unlocked}`);
      }
      if (next.status !== "playing") setJustEnded(true);
      return true;
    } catch (err) {
      if (err instanceof GameError && err.kind === "duplicate") duplicate(pick.name);
      else setNotice({ kind: "error", text: "Something went wrong. Check your connection and try again." });
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function retrySubmit() {
    if (lastPick.current && (await submit(lastPick.current))) {
      setInputKey((k) => k + 1);
      requestAnimationFrame(() => document.getElementById("guess-box")?.focus());
    }
  }

  async function reveal(key: string): Promise<boolean> {
    if (!game) return false;
    try {
      const next = await revealHint(game.session_id, key);
      setGame(next);
      const hint = next.hints.find((h) => h.key === key);
      if (hint) setAnnounce(`Clue revealed. ${hint.label}: ${formatValue(hint.key, hint.value)}.`);
      return true;
    } catch {
      return false;
    }
  }

  async function giveUpNow(): Promise<boolean> {
    if (!game) return false;
    try {
      const next = await giveUp(game.session_id);
      setGame(next);
      setJustEnded(true);
      setAnnounce(`You gave up. The answer was ${next.answer?.name}.`);
      return true;
    } catch {
      return false;
    }
  }

  const playing = game?.status === "playing";
  const ended = !!game && !playing;
  const titleLine = (
    <div className={styles.titleRow}>
      <h1 className={styles.title}>{TITLE[mode]}</h1>
      <div className={styles.pills}>
        <span className={styles.pill}>{play === "daily" ? "Daily" : "Random"}</span>
        {mode === "anime" && <span className={styles.pill}>Hard mode</span>}
      </div>
    </div>
  );
  const description = <p className={styles.desc}>{DESC[mode]} {HINT_NOTE}</p>;

  return (
    <div className={styles.root} aria-busy={phase === "loading"}>
      <p className={styles.srOnly} aria-live="polite" aria-atomic="true">{announce}</p>
      <div className={styles.layout}>
        <div className={styles.side}>
          {titleLine}
          {description}

          <div className={styles.controls} data-ended={ended || undefined}>
          {phase === "loading" && (
            <>
              <p className={styles.srOnly}>Loading the game</p>
              <div className={styles.skeletonTracker} aria-hidden="true">
                {Array.from({ length: 15 }, (_, i) => <span key={i} className={styles.skeleton} />)}
              </div>
              <span className={`${styles.skeleton} ${styles.skeletonInput}`} aria-hidden="true" />
            </>
          )}

          {phase === "ready" && game && (
            <>
              <div className={styles.tracker}>
                <TurnTracker used={game.attempts} total={game.max_attempts} />
              </div>
              {playing && (
                <>
                  <div className={styles.inputArea}>
                  <GuessInput
                    key={inputKey}
                    mode={mode}
                    guessedIds={new Set(game.guesses.map((g) => g.guess.id))}
                    disabled={submitting}
                    submitting={submitting}
                    onSubmit={submit}
                    onEdit={() => setNotice(null)}
                  >
                    {notice && (
                      <div className={styles.notice} data-kind={notice.kind} role="alert">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M12 3 2 21h20L12 3zM12 10v5M12 18h.01" />
                        </svg>
                        <span>{notice.text}</span>
                        {notice.kind === "error" && (
                          <button type="button" className={`${buttons.secondary} ${styles.small}`} onClick={retrySubmit}>Try again</button>
                        )}
                      </div>
                    )}
                  </GuessInput>
                  {play === "random" && game.attempts === 0 && (
                    <DifficultyPicker tier={tier} onChange={newRound} disabled={submitting} />
                  )}
                  </div>
                  <div className={styles.hintArea}>
                    <HintPicker clues={clues} revealed={game.hints.map((h) => h.key)} available={game.hints_available} onReveal={reveal} />
                    <GiveUpDialog disabled={submitting} onConfirm={giveUpNow} />
                  </div>
                </>
              )}
              {game.hints.length > 0 && (
                <ul className={`${styles.hints} ${styles.chips}`} aria-label="Revealed clues">
                  {game.hints.map((h) => (
                    <li key={h.key} className={styles.hint}>
                      <span className={styles.hintLabel}>{h.label}:</span> {formatValue(h.key, h.value)}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          </div>
        </div>

        <div className={styles.main}>
          {phase === "loading" && (
            <div className={styles.skeletonCards} aria-hidden="true">
              <span className={`${styles.skeleton} ${styles.skeletonCard}`} />
              <span className={`${styles.skeleton} ${styles.skeletonCard}`} />
            </div>
          )}

          {phase === "failed" && (
            <div className={styles.panel}>
              <h2 className={styles.panelTitle}>Could not load the game</h2>
              <p>Check your connection and try again.</p>
              <button ref={retryRef} type="button" className={buttons.primary} onClick={retryLoad}>Try again</button>
            </div>
          )}

          {phase === "config" && (
            <div className={styles.panel}>
              <h2 className={styles.panelTitle}>The game is not set up yet</h2>
              <p>Please come back soon.</p>
              <Link href="/" className={buttons.primary}>Back home</Link>
            </div>
          )}

          {phase === "nodaily" && (
            <div className={styles.panel}>
              <h2 className={styles.panelTitle}>No puzzle today</h2>
              <p>Today&apos;s puzzle is not ready yet. Try a random round while you wait.</p>
              <div className={styles.panelActions}>
                <Link href={guessHref(mode, "random")} className={buttons.primary}>Play random</Link>
                <Link href="/" className={buttons.secondary}>Back home</Link>
              </div>
            </div>
          )}

          {phase === "ready" && game && (
            <>
              {ended && game.status === "won" && (
                <WinCard game={game} mode={mode} play={play} clues={clues} focusHeading={justEnded} onPlayRandom={() => newRound(tier)} />
              )}
              {ended && game.status === "lost" && (
                <LoseCard game={game} mode={mode} play={play} clues={clues} focusHeading={justEnded} onPlayRandom={() => newRound(tier)} />
              )}
              <GuessHistory guesses={game.guesses} clues={clues} newest={newest} busy={submitting} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
