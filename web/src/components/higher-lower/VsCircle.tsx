import styles from "./Divider.module.css";

// Fullmetal Alchemist style transmutation circle with "VS" in the centre. Decorative.
const TICKS = Array.from({ length: 12 }, (_, i) => i * 30);

export function VsCircle({ spinning }: { spinning: boolean }) {
  return (
    <span className={`${styles.vs} ${spinning ? styles.spin : ""}`} aria-hidden="true">
      <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeLinejoin="round">
        <circle cx="50" cy="50" r="46" strokeWidth="4" fill="var(--paper)" />
        <circle cx="50" cy="50" r="33" strokeWidth="2.5" />
        <polygon points="50,19 77,66 23,66" strokeWidth="2.5" />
        <polygon points="50,81 23,34 77,34" strokeWidth="2.5" />
        {TICKS.map((deg) => (
          <line key={deg} x1="50" y1="6" x2="50" y2="14" strokeWidth="2.5" transform={`rotate(${deg} 50 50)`} />
        ))}
        <circle cx="50" cy="50" r="17" strokeWidth="0" fill="var(--paper)" />
      </svg>
      <span className={styles.vsText}>VS</span>
    </span>
  );
}
