import styles from "./WinBanner.module.css";

// My Hero Academia style win banner: a diagonal band with speed lines. Decorative; the live region says "You win".
export function WinBanner() {
  return (
    <div className={styles.overlay} aria-hidden="true">
      <div className={styles.lines}>
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className={styles.line} style={{ "--n": i } as React.CSSProperties} />
        ))}
      </div>
      <div className={styles.band}>
        <p className={styles.title}>Plus ultra!</p>
        <p className={styles.sub}>20 in a row. You win.</p>
      </div>
    </div>
  );
}
