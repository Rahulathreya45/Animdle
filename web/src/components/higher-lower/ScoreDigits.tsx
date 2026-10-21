import styles from "./ScoreDigits.module.css";

const HIDDEN_TILES = 7;

// Scoreboard tiles for a card number. Hidden = always 7 "?" tiles (no hint of size). Revealed = right-aligned digits
// with leading blanks; `flip` plays the left-to-right flip, otherwise the final state shows at once.
export function ScoreDigits({
  value,
  label,
  flip = false,
  result = null,
}: {
  value: number | null;
  label: string;
  flip?: boolean;
  result?: "right" | "wrong" | null;
}) {
  const revealed = value !== null;
  const digits = revealed ? String(value) : "";
  const count = Math.max(HIDDEN_TILES, digits.length);
  const pad = count - digits.length;
  const text = revealed ? `${value.toLocaleString("en-US")} ${label}` : "Hidden number";

  const tiles = [];
  for (let i = 0; i < count; i++) {
    const face = revealed && i >= pad ? digits[i - pad] : "";
    const fromRight = count - 1 - i;
    tiles.push(
      <span key={i} className={styles.slot}>
        <span className={styles.tile} style={{ "--i": i } as React.CSSProperties}>
          <span className={styles.q} aria-hidden="true">?</span>
          <span className={styles.v} aria-hidden="true">{face}</span>
        </span>
        {fromRight > 0 && fromRight % 3 === 0 && <span className={styles.comma} aria-hidden="true">,</span>}
      </span>,
    );
  }

  const cls = [styles.row, revealed ? (flip ? styles.flip : styles.shown) : ""];
  return (
    <div className={cls.join(" ")} data-result={result ?? undefined} role={revealed ? "img" : undefined} aria-label={revealed ? text : undefined} aria-hidden={revealed ? undefined : true}>
      {tiles}
    </div>
  );
}

// Two-tile streak counter for the top bar. Tiles re-key on change so they flip in.
export function StreakDigits({ value }: { value: number }) {
  const text = String(value).padStart(2, "0");
  return (
    <div className={`${styles.row} ${styles.streak}`} role="img" aria-label={`Streak ${value}`}>
      {text.split("").map((ch, i) => (
        <span key={`${i}${ch}`} className={styles.slot}>
          <span className={`${styles.tile} ${styles.pop}`}>
            <span className={styles.v} aria-hidden="true">{ch}</span>
          </span>
        </span>
      ))}
    </div>
  );
}
