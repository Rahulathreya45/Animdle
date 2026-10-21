"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { GuessMode } from "@/config/game";
import { searchTitles } from "@/game/api";
import type { TitleHit } from "@/game/types";
import buttons from "../buttons.module.css";
import styles from "./GuessInput.module.css";

const PLACEHOLDER: Record<GuessMode, string> = {
  franchise: "Type an anime name",
  anime: "Type an anime name",
  character: "Type a character name",
};

type Pick = { id: string; name: string };
type Props = {
  mode: GuessMode;
  guessedIds: Set<string>;
  disabled: boolean;
  submitting: boolean;
  /** resolves true when the guess was accepted (the box is then cleared) */
  onSubmit: (pick: Pick) => Promise<boolean>;
  /** the text changed: clear any message shown for the last guess */
  onEdit: () => void;
  /** notices shown right under the input */
  children?: ReactNode;
};

// Autocomplete following the ARIA combobox pattern (the list is a listbox, focus stays in the input).
export function GuessInput({ mode, guessedIds, disabled, submitting, onSubmit, onEdit, children }: Props) {
  const uid = useId();
  const listId = `${uid}-list`;
  const helpId = `${uid}-help`;
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRun = useRef(0);
  const wantFocus = useRef(false);

  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<TitleHit[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [active, setActive] = useState(-1);
  const [picked, setPicked] = useState<Pick | null>(null);

  const query = text.trim();
  const listShown = open && query.length >= 2;

  // search 200ms after the last keystroke; older responses are ignored
  useEffect(() => {
    if (query.length < 2 || picked) return;
    const run = ++searchRun.current;
    const timer = setTimeout(async () => {
      try {
        const found = await searchTitles(query, mode);
        if (run !== searchRun.current) return;
        setHits(found);
        setStatus("ok");
      } catch {
        if (run !== searchRun.current) return;
        setStatus("error");
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query, mode, picked]);

  // a typed name that exactly matches one result counts as picked
  const exact = hits.filter((h) => h.display_name.toLowerCase() === query.toLowerCase());
  const chosen: Pick | null = picked ?? (status === "ok" && exact.length === 1 ? { id: exact[0].target_id, name: exact[0].display_name } : null);

  // put the cursor back in the box once a guess has been handled
  useEffect(() => {
    if (!disabled && wantFocus.current) {
      wantFocus.current = false;
      inputRef.current?.focus();
    }
  }, [disabled]);

  function onChange(value: string) {
    setText(value);
    setPicked(null);
    setActive(-1);
    setOpen(true);
    if (value.trim().length >= 2) setStatus("loading");
    onEdit();
  }

  function choose(hit: TitleHit) {
    setPicked({ id: hit.target_id, name: hit.display_name });
    setText(hit.display_name);
    setOpen(false);
    setActive(-1);
    onEdit();
  }

  async function submit() {
    if (!chosen || disabled) return;
    setOpen(false);
    wantFocus.current = true;
    if (await onSubmit(chosen)) {
      setText("");
      setPicked(null);
      setHits([]);
      setStatus("idle");
    }
  }

  const count = status === "ok" ? hits.length : 0;

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (query.length < 2) return;
      e.preventDefault();
      setOpen(true);
      if (!count) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => (a < 0 ? (step === 1 ? 0 : count - 1) : (a + step + count) % count));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (listShown && count) choose(hits[active >= 0 ? active : 0]);
      else void submit();
    } else if (e.key === "Escape") {
      if (listShown) setOpen(false);
      else if (text) {
        onChange("");
        setOpen(false);
      }
    }
  }

  const note =
    status === "loading" ? "Searching" : status === "error" ? "Search failed. Keep typing to try again." : count ? null : "No matches. Try another spelling.";

  return (
    <div className={styles.box}>
      <label htmlFor="guess-box" className={styles.label}>Your guess</label>
      <div className={styles.field}>
        <input
          id="guess-box"
          ref={inputRef}
          className={styles.input}
          type="text"
          role="combobox"
          aria-expanded={listShown}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={listShown && active >= 0 ? `${uid}-opt-${active}` : undefined}
          aria-describedby={helpId}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder={PLACEHOLDER[mode]}
          value={text}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => !chosen && setOpen(true)}
          onBlur={() => setOpen(false)}
        />
        {status === "loading" && listShown && <span className={styles.spinner} aria-hidden="true" />}
        <ul id={listId} role="listbox" aria-label="Suggestions" className={styles.list} hidden={!listShown}>
          {listShown && note && (
            <li role="option" aria-disabled="true" aria-selected="false" className={styles.note}>{note}</li>
          )}
          {listShown &&
            status === "ok" &&
            hits.map((h, i) => (
              <li
                key={h.target_id}
                id={`${uid}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                data-active={i === active || undefined}
                className={styles.option}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(h)}
              >
                <span className={styles.optionText}>
                  <span className={styles.name}>{h.display_name}</span>
                  {h.matched_title !== h.display_name && <span className={styles.alt}>{h.matched_title}</span>}
                </span>
                {guessedIds.has(h.target_id) && <span className={styles.tag}>Guessed</span>}
              </li>
            ))}
        </ul>
      </div>
      <p className={styles.status} role="status">
        {listShown && status === "ok" ? (count ? `${count} results` : "No results") : ""}
      </p>
      {children}
      <button type="button" className={`${buttons.primary} ${styles.submit}`} disabled={!chosen || disabled} onClick={submit}>
        {submitting && <span className={styles.spinnerInline} aria-hidden="true" />}
        {submitting ? "Checking..." : "Guess"}
      </button>
      <p id={helpId} className={styles.help}>{chosen || disabled ? "" : "Pick a name from the list"}</p>
    </div>
  );
}
