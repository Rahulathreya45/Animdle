import { HIGHER_LOWER_WIN_STREAK } from "@/config/game";
import styles from "./NenMeter.module.css";

const NOTCHES = [5, 10, 15, 20];

// Hunter x Hunter style aura meter: fills one notch per right answer (horizontal on mobile, vertical on desktop).
export function NenMeter({ streak, paused }: { streak: number; paused: boolean }) {
  const pct = (streak / HIGHER_LOWER_WIN_STREAK) * 100;
  const full = streak >= HIGHER_LOWER_WIN_STREAK;
  return (
    <div
      className={styles.meter}
      role="progressbar"
      aria-label="Streak progress"
      aria-valuemin={0}
      aria-valuemax={HIGHER_LOWER_WIN_STREAK}
      aria-valuenow={streak}
    >
      <div className={styles.track}>
        <div
          className={`${styles.fill} ${streak === 0 || paused || full ? styles.still : ""}`}
          style={{ "--p": `${pct}%` } as React.CSSProperties}
        />
        <div className={styles.cells} aria-hidden="true" />
      </div>
      <ul className={styles.labels} aria-hidden="true">
        {NOTCHES.map((n) => (
          <li key={n} className={streak >= n ? styles.reached : ""} style={{ "--at": `${(n / HIGHER_LOWER_WIN_STREAK) * 100}%` } as React.CSSProperties}>
            {n}
          </li>
        ))}
      </ul>
    </div>
  );
}
