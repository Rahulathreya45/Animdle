import { HINT_AFTER_GUESSES } from "@/config/game";
import styles from "./TurnTracker.module.css";

// Demon Slayer evocation: every guess fills one cell with a green and black check pattern.
// Cells 5 and 10 (the clue turns) get a notch and a number, so they are not marked by position alone.
export function TurnTracker({ used, total }: { used: number; total: number }) {
  return (
    <div className={styles.wrap}>
      <div className={styles.row} role="img" aria-label={`${used} of ${total} guesses used`}>
        {Array.from({ length: total }, (_, i) => {
          const marked = (HINT_AFTER_GUESSES as readonly number[]).includes(i + 1);
          return (
            <span key={i} className={styles.cell} data-used={i < used || undefined} data-newest={i === used - 1 || undefined}>
              {marked && (
                <>
                  <span className={styles.notch} />
                  <span className={styles.num}>{i + 1}</span>
                </>
              )}
            </span>
          );
        })}
      </div>
      <p className={styles.caption} aria-hidden="true">{used} of {total} guesses used</p>
    </div>
  );
}
