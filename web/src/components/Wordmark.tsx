import styles from "./Wordmark.module.css";

// The Animdle logo with three props drawn on the letters: a straw hat on the A, a four-star dragon ball as the
// dot of the i and a ninja headband tied round the l. Props are sized in em, so they scale with the font size.
// Screen readers get the plain name; the props are decoration.

const OUTLINE = "#1C2130";
const STAR = "M0-4 1.2-1.3 3.8-1.2 1.9.6 2.4 3.2 0 1.8-2.4 3.2-1.9.6-3.8-1.2-1.2-1.3Z";

function StrawHat() {
  return (
    <svg className={`${styles.prop} ${styles.hat}`} viewBox="0 0 120 64" aria-hidden="true">
      <ellipse cx="60" cy="48" rx="56" ry="12" fill="#F2C14E" stroke={OUTLINE} strokeWidth="3.5" />
      <path d="M27 48 C27 12 93 12 93 48 Z" fill="#F2C14E" stroke={OUTLINE} strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M29 38 C42 31 78 31 91 38 L92 46 C78 40 42 40 28 46 Z" fill="#D7263D" stroke={OUTLINE} strokeWidth="3" strokeLinejoin="round" />
      <path d="M44 22 C50 18 58 17 64 18" fill="none" stroke="#FFF3C4" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function DragonBall() {
  return (
    <svg className={`${styles.prop} ${styles.ball}`} viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="17.5" fill="#F39C26" stroke={OUTLINE} strokeWidth="3" />
      <ellipse cx="13" cy="11" rx="5" ry="3" fill="#FFE1A8" transform="rotate(-30 13 11)" />
      <g fill="#D7263D">
        {[[20, 12.5], [12.5, 20], [27.5, 20], [20, 27.5]].map(([x, y]) => (
          <path key={`${x}-${y}`} transform={`translate(${x} ${y})`} d={STAR} />
        ))}
      </g>
    </svg>
  );
}

function Headband() {
  return (
    <svg className={`${styles.prop} ${styles.band}`} viewBox="0 0 140 64" aria-hidden="true">
      {/* tails fly up and right, above the e */}
      <path d="M66 29 C86 21 98 9 124 6 L126 16 C102 19 90 31 68 39 Z" fill="#2B4C9B" stroke={OUTLINE} strokeWidth="3" strokeLinejoin="round" />
      <path d="M68 39 C88 35 102 25 120 26 L118 36 C102 35 90 43 68 47 Z" fill="#2B4C9B" stroke={OUTLINE} strokeWidth="3" strokeLinejoin="round" />
      <rect x="14" y="26" width="52" height="24" fill="#2B4C9B" stroke={OUTLINE} strokeWidth="3" />
      <rect x="20" y="19" width="40" height="38" rx="5" fill="#C9CED6" stroke={OUTLINE} strokeWidth="3" />
      <path d="M40 30 C47 30 50 36 46 41 C43 45 36 44 35 39 C34 35 38 33 41 35 C43 37 42 39 40 39" fill="none" stroke={OUTLINE} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M46 41 L54 47" fill="none" stroke={OUTLINE} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ id }: { id?: string }) {
  return (
    <h1 id={id} className={styles.wordmark} aria-label="Animdle">
      <span className={styles.letter} aria-hidden="true">A<StrawHat /></span>
      <span aria-hidden="true">n</span>
      <span className={styles.letter} aria-hidden="true">i<DragonBall /></span>
      <span aria-hidden="true">md</span>
      <span className={styles.letter} aria-hidden="true">l<Headband /></span>
      <span aria-hidden="true">e</span>
    </h1>
  );
}
