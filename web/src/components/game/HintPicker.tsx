"use client";

import { useEffect, useId, useRef, useState } from "react";
import { HINT_AFTER_GUESSES } from "@/config/game";
import type { ClueDef } from "@/game/types";
import buttons from "../buttons.module.css";
import styles from "./HintPicker.module.css";

type Props = {
  clues: ClueDef[];
  revealed: string[];
  available: number;
  /** resolves true when the clue was revealed */
  onReveal: (key: string) => Promise<boolean>;
};

// The clue button and its Pokedex style picker: a centred native <dialog> (focus trap, inert page, Escape).
// Only clue columns not yet revealed are listed, and never the name or the image.
export function HintPicker({ clues, revealed, available, onReveal }: Props) {
  const titleId = useId();
  const helpId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const left = clues.filter((c) => !revealed.includes(c.clue_key));
  const nextAt = HINT_AFTER_GUESSES[revealed.length];
  const help = available > 0 ? "" : nextAt ? `Unlocks after guess ${nextAt}` : "No clues left";

  function show() {
    setFailed(false);
    setOpen(true);
  }

  // open as a modal once mounted, then focus the first clue
  useEffect(() => {
    const d = dialogRef.current;
    if (!open || !d) return;
    if (!d.open) d.showModal();
    d.querySelector<HTMLElement>("[data-clue]")?.focus();
  }, [open]);

  // Escape, Cancel and backdrop all end up here (the native close event)
  function onClose() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  async function pick(key: string) {
    setScanning(key);
    setFailed(false);
    const ok = await onReveal(key);
    setScanning(null);
    if (ok) dialogRef.current?.close();
    else setFailed(true);
  }

  return (
    <div className={styles.wrap}>
      <button
        ref={triggerRef}
        type="button"
        className={`${buttons.secondary} ${styles.trigger}`}
        aria-disabled={!available || undefined}
        aria-describedby={help ? helpId : undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={available ? show : undefined}
      >
        {available > 0 ? `Reveal a clue (${available} left)` : "Reveal a clue"}
      </button>
      {help && <p id={helpId} className={styles.help}>{help}</p>}

      {open && (
        <dialog
          ref={dialogRef}
          className={styles.dex}
          aria-labelledby={titleId}
          onClose={onClose}
          onClick={(e) => {
            if (e.target === e.currentTarget) e.currentTarget.close();
          }}
        >
          <div className={styles.top}>
            <span className={styles.lens} aria-hidden="true" />
            <span className={styles.dots} aria-hidden="true"><i /><i /></span>
            <h2 id={titleId} className={styles.title}>Pick a clue to reveal</h2>
            <button type="button" className={styles.close} onClick={() => dialogRef.current?.close()}>Cancel</button>
          </div>
          <div className={styles.screen}>
            <ul className={styles.list}>
              {left.map((c) => (
                <li key={c.clue_key}>
                  <button
                    type="button"
                    data-clue
                    className={styles.item}
                    disabled={scanning !== null}
                    title={c.label}
                    onClick={() => pick(c.clue_key)}
                  >
                    <span className={styles.itemLabel}>{c.label}</span>
                    <span>{scanning === c.clue_key ? "Scanning..." : "Scan"}</span>
                  </button>
                </li>
              ))}
            </ul>
            {failed && <p className={styles.error} role="alert">Could not scan that clue. Try again.</p>}
          </div>
        </dialog>
      )}
    </div>
  );
}
