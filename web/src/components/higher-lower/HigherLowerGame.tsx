"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import buttons from "@/components/buttons.module.css";
import { HIGHER_LOWER_WIN_STREAK, type HigherLowerKind } from "@/config/game";
import { fetchDeck } from "@/game/api";
import type { HigherLowerCard } from "@/game/types";
import { Card } from "./Card";
import { Divider } from "./Divider";
import { GameOver, LoadError } from "./GameOver";
import { NenMeter } from "./NenMeter";
import { StreakDigits } from "./ScoreDigits";
import { WinBanner } from "./WinBanner";
import { saveBest, useBestStreak } from "./useBestStreak";
import styles from "./HigherLowerGame.module.css";

type Choice = "higher" | "lower";
// entering = the new card B is sliding in; buttons stay locked in every phase except "playing"
type Phase = "loading" | "playing" | "revealing" | "advancing" | "entering" | "over" | "won" | "error";

const DECK_SIZE = 50;
const REFILL_BELOW = 5;
const PENDING_LIMIT_MS = 8000;

const COPY: Record<HigherLowerKind, { pill: string; label: string; note: string; desc: string }> = {
  anime: { pill: "Anime", label: "members", note: "Popularity is the number of AniList users who have the show on their list.", desc: `Is the next anime more or less popular than this one? Pick higher or lower. Get ${HIGHER_LOWER_WIN_STREAK} right in a row to win.` },
  character: { pill: "Characters", label: "fans", note: "Popularity is the number of AniList users who marked the character as a favourite.", desc: `Is the next character more or less loved by fans? Pick higher or lower. Get ${HIGHER_LOWER_WIN_STREAK} right in a row to win.` },
};

const fmt = (n: number) => n.toLocaleString("en-US");

export function HigherLowerGame({ kind }: { kind: HigherLowerKind }) {
  const copy = COPY[kind];
  const best = useBestStreak(kind);
  const noteId = useId();

  const [a, setA] = useState<HigherLowerCard | null>(null);
  const [b, setB] = useState<HigherLowerCard | null>(null);
  const [streak, setStreak] = useState(0);
  const [phase, setPhase] = useState<Phase>("loading");
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState<"right" | "wrong" | null>(null);
  const [banner, setBanner] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [message, setMessage] = useState("");
  const [showNote, setShowNote] = useState(false);

  // deck bookkeeping lives in refs: it never drives rendering
  const queue = useRef<HigherLowerCard[]>([]);
  const seen = useRef(new Set<string>());
  const pending = useRef<Promise<void> | null>(null);
  const run = useRef(0);
  const timers = useRef<number[]>([]);
  const wantFocus = useRef(false);
  const higherBtn = useRef<HTMLButtonElement>(null);
  const actions = useRef<HTMLDivElement>(null);
  const infoBtn = useRef<HTMLButtonElement>(null);

  function at(id: number, ms: number, fn: () => void) {
    timers.current.push(
      window.setTimeout(() => {
        if (run.current === id) fn();
      }, ms),
    );
  }

  // Fetch another batch, skipping ids already seen this run. Shared while in flight.
  function refill(id: number): Promise<void> {
    if (pending.current) return pending.current;
    const p: Promise<void> = fetchDeck(kind, DECK_SIZE)
      .then((rows) => {
        if (run.current !== id) return;
        for (const r of rows) {
          if (seen.current.has(r.item_id)) continue;
          seen.current.add(r.item_id);
          queue.current.push(r);
        }
      })
      .finally(() => {
        if (pending.current === p) pending.current = null;
      });
    pending.current = p;
    return p;
  }

  // Next unused card; waits (up to 8s) for a refill if the queue ran dry. null = nothing to show.
  async function pull(id: number): Promise<HigherLowerCard | null> {
    if (queue.current.length === 0) {
      let timer = 0;
      const limit = new Promise<void>((_, reject) => {
        timer = window.setTimeout(reject, PENDING_LIMIT_MS);
      });
      try {
        await Promise.race([refill(id), limit]);
      } catch {
        // timed out or failed: fall through with whatever is queued
      }
      window.clearTimeout(timer);
    }
    if (run.current !== id) return null;
    const card = queue.current.shift() ?? null;
    if (queue.current.length < REFILL_BELOW) refill(id).catch(() => {});
    return card;
  }

  async function begin() {
    const id = ++run.current;
    queue.current = [];
    seen.current = new Set();
    pending.current = null;
    let ok = true;
    try {
      await refill(id);
    } catch {
      ok = false;
    }
    if (run.current !== id) return;
    const first = await pull(id);
    const second = await pull(id);
    if (run.current !== id) return;
    if (!first || !second) {
      setEmpty(ok);
      setMessage(ok ? "No cards to show right now." : "Could not load cards.");
      setA(first);
      setPhase("error");
      return;
    }
    setA(first);
    setB(second);
    setPhase("playing");
  }

  function playAgain() {
    run.current++;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    wantFocus.current = true;
    setA(null);
    setB(null);
    setStreak(0);
    setRevealed(false);
    setResult(null);
    setBanner(false);
    setEmpty(false);
    setMessage("");
    setPhase("loading");
    void begin();
  }

  // Try again: a failed first load starts over, a failed mid-run refill just fetches the next B.
  async function retry() {
    wantFocus.current = true;
    setMessage("");
    if (!a) {
      setEmpty(false);
      setPhase("loading");
      void begin();
      return;
    }
    const id = run.current;
    setPhase("loading");
    const card = await pull(id);
    if (run.current !== id) return;
    if (!card) {
      setPhase("error");
      return;
    }
    setB(card);
    setMessage(`New card: ${card.name}.`);
    setPhase("playing");
  }

  useEffect(() => {
    void begin();
    const list = timers;
    const counter = run;
    return () => {
      counter.current++;
      list.current.forEach(clearTimeout);
      list.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Move focus to Higher once play resumes, but only if focus was on the game buttons or nowhere.
  useEffect(() => {
    if (phase !== "playing" || !wantFocus.current) return;
    wantFocus.current = false;
    const ae = document.activeElement;
    if (ae === document.body || (ae && actions.current?.contains(ae))) higherBtn.current?.focus();
  }, [phase]);

  function answer(choice: Choice) {
    if (phase !== "playing" || !a || !b) return;
    const id = run.current;
    const right = b.value === a.value || (choice === "higher" ? b.value > a.value : b.value < a.value);
    const nextStreak = streak + 1;
    const count = `${b.name} has ${fmt(b.value)} ${copy.label}.`;
    setPhase("revealing");
    setRevealed(true);

    at(id, 800, () => {
      setResult(right ? "right" : "wrong");
      if (!right) {
        setMessage(`Wrong. ${count} Streak ${streak}.`);
        return;
      }
      setStreak(nextStreak);
      saveBest(kind, nextStreak);
      if (nextStreak >= HIGHER_LOWER_WIN_STREAK) {
        setMessage(`You win. ${HIGHER_LOWER_WIN_STREAK} in a row.`);
        setBanner(true);
        return;
      }
      setMessage(`Right. ${count} Streak ${nextStreak}.`);
    });

    if (!right) {
      at(id, 1400, () => setPhase("over"));
      return;
    }
    if (nextStreak >= HIGHER_LOWER_WIN_STREAK) {
      at(id, 2700, () => {
        setBanner(false);
        setPhase("won");
      });
      return;
    }
    at(id, 1300, () => setPhase("advancing"));
    at(id, 1600, () => {
      void pull(id).then((card) => {
        if (run.current !== id) return;
        setA(b);
        setRevealed(false);
        setResult(null);
        if (!card) {
          setB(null);
          setEmpty(false);
          setMessage("Could not load cards.");
          setPhase("error");
          return;
        }
        setB(card);
        setMessage(`New card: ${card.name}.`);
        setPhase("entering");
        at(id, 300, () => {
          wantFocus.current = true;
          setPhase("playing");
        });
      });
    });
  }

  // Keyboard: ArrowUp or H = higher, ArrowDown or L = lower. Latest handler kept in a ref.
  const onKey = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    onKey.current = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const k = e.key.toLowerCase();
      const choice = k === "arrowup" || k === "h" ? "higher" : k === "arrowdown" || k === "l" ? "lower" : null;
      if (!choice) return;
      if (k.startsWith("arrow")) e.preventDefault();
      answer(choice);
    };
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey.current(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const ended = phase === "over" || phase === "won";
  const locked = phase !== "playing";
  const revealing = phase === "revealing";
  const motionA = phase === "advancing" ? "leave" : null;
  const motionB = phase === "advancing" ? "shift" : phase === "entering" ? "enter" : null;
  const showB = b && phase !== "loading" ? b : null;

  return (
    <div className={styles.page}>
      <a href="#hl-main" className={styles.skip}>Skip to game</a>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>Animdle</Link>
        <div className={styles.titleBox}>
          <h1 className={styles.title}>Higher or lower</h1>
          <span className={styles.pill}>{copy.pill}</span>
        </div>
        <div className={styles.streakBox}>
          <span className={styles.streakLabel}>Streak</span>
          <StreakDigits value={streak} />
        </div>
        <div className={styles.theme}>
          <ThemeToggle />
        </div>
      </header>
      <p className={styles.desc}>{copy.desc}</p>

      <main id="hl-main" tabIndex={-1} className={styles.main}>
        <div className={styles.board}>
          <NenMeter streak={streak} paused={revealing || ended || phase === "advancing"} />
          {phase === "error" ? (
            <LoadError empty={empty} onRetry={retry} />
          ) : (
            <div className={styles.stage}>
              <Card card={a} side="A" kind={kind} revealed eager motion={motionA} />
              <Divider revealing={revealing} />
              <Card card={showB} side="B" kind={kind} revealed={revealed} flip result={result} motion={motionB} eager />
              {!ended && (
                <div className={styles.actions} ref={actions}>
                  {a && (
                    <p className={styles.question}>Does it have more or fewer {copy.label} than {a.name}?</p>
                  )}
                  <div className={styles.buttons}>
                    <button
                      type="button"
                      ref={higherBtn}
                      className={`${buttons.primary} ${styles.choice}`}
                      aria-disabled={locked || !showB}
                      aria-label={a ? `Higher than ${a.name}` : "Higher"}
                      onClick={() => answer("higher")}
                    >
                      <Arrow up />
                      Higher
                    </button>
                    <button
                      type="button"
                      className={`${buttons.secondary} ${styles.choice}`}
                      aria-disabled={locked || !showB}
                      aria-label={a ? `Lower than ${a.name}` : "Lower"}
                      onClick={() => answer("lower")}
                    >
                      <Arrow up={false} />
                      Lower
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {ended && <GameOver won={phase === "won"} streak={streak} best={best} onAgain={playAgain} />}
        </div>

        <div
          className={styles.footer}
          onKeyDown={(e) => {
            if (e.key === "Escape" && showNote) {
              setShowNote(false);
              infoBtn.current?.focus();
            }
          }}
        >
          <div className={styles.bestRow}>
            <p className={styles.best}>Best: <strong>{best}</strong></p>
            <button
              type="button"
              ref={infoBtn}
              className={styles.info}
              aria-label="How popularity is measured"
              aria-expanded={showNote}
              aria-controls={noteId}
              onClick={() => setShowNote((v) => !v)}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 11v5M12 7.5v.5" />
              </svg>
            </button>
          </div>
          <p className={styles.hint}>Keys: Up or H for higher, Down or L for lower.</p>
          {showNote && <p id={noteId} className={styles.note}>{copy.note}</p>}
        </div>
        <div role="status" aria-live="polite" aria-atomic="true" className={styles.sr}>{message}</div>
      </main>
      {banner && <WinBanner />}
    </div>
  );
}

function Arrow({ up }: { up: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" aria-hidden="true">
      {up ? <path d="M12 20V5M5 11l7-7 7 7" /> : <path d="M12 4v15M5 13l7 7 7-7" />}
    </svg>
  );
}
