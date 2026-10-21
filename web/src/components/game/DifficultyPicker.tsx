import { useId } from "react";
import styles from "./DifficultyPicker.module.css";

const TIERS = [
  { tier: 1, label: "Easy", help: "The most famous ones" },
  { tier: 2, label: "Normal", help: "Well known" },
  { tier: 3, label: "Hard", help: "Includes deep cuts" },
];

type Props = { tier: number; onChange: (tier: number) => void; disabled: boolean };

// Random mode only, before the first guess. Picking a level starts a new round.
export function DifficultyPicker({ tier, onChange, disabled }: Props) {
  const labelId = useId();
  const helpId = useId();

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const move = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!move) return;
    e.preventDefault();
    const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    buttons[(at + move + buttons.length) % buttons.length].focus();
  }

  return (
    <div className={styles.picker}>
      <span id={labelId} className={styles.label}>Difficulty</span>
      <div role="radiogroup" aria-labelledby={labelId} aria-describedby={helpId} className={styles.group} onKeyDown={onKeyDown}>
        {TIERS.map((t) => (
          <button
            key={t.tier}
            type="button"
            role="radio"
            aria-checked={t.tier === tier}
            tabIndex={t.tier === tier ? 0 : -1}
            disabled={disabled}
            className={styles.option}
            onClick={() => t.tier !== tier && onChange(t.tier)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p id={helpId} className={styles.help}>{TIERS.find((t) => t.tier === tier)?.help}</p>
    </div>
  );
}
