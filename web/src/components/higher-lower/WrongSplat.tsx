import styles from "./Card.module.css";

// Chainsaw Man style red ink splats: a few small irregular blobs over the cover that fade out by ~1.2s. Decorative.
const BLOB = "M12 2 L20 6 L30 3 L36 12 L46 16 L42 26 L48 36 L38 42 L32 52 L22 46 L12 54 L8 42 L0 34 L6 24 L2 14 Z";
const SPLATS = [
  { left: "6%", top: "8%", size: 34, delay: 0, rot: 0 },
  { left: "58%", top: "14%", size: 24, delay: 90, rot: 70 },
  { left: "30%", top: "52%", size: 40, delay: 40, rot: 150 },
  { left: "68%", top: "62%", size: 28, delay: 160, rot: 220 },
  { left: "12%", top: "78%", size: 18, delay: 120, rot: 300 },
];

export function WrongSplat() {
  return (
    <div className={styles.splats} aria-hidden="true">
      {SPLATS.map((s, i) => (
        <svg
          key={i}
          className={styles.splat}
          viewBox="0 0 50 56"
          width={s.size}
          height={s.size}
          style={{ left: s.left, top: s.top, animationDelay: `${s.delay}ms`, rotate: `${s.rot}deg` }}
        >
          <path d={BLOB} fill="var(--splat)" />
          <circle cx="44" cy="6" r="3" fill="var(--splat)" />
        </svg>
      ))}
    </div>
  );
}
