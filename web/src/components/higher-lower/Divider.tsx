import { VsCircle } from "./VsCircle";
import styles from "./Divider.module.css";

// Bleach style slash between the cards, with the VS badge on it. Decorative.
export function Divider({ revealing }: { revealing: boolean }) {
  return (
    <div className={styles.divider} aria-hidden="true">
      <span className={`${styles.slash} ${revealing ? styles.flash : ""}`} />
      <VsCircle spinning={revealing} />
    </div>
  );
}
