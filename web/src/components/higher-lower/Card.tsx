import { useState } from "react";
import type { HigherLowerKind } from "@/config/game";
import type { HigherLowerCard } from "@/game/types";
import { ScoreDigits } from "./ScoreDigits";
import { WrongSplat } from "./WrongSplat";
import styles from "./Card.module.css";

export type CardMotion = "leave" | "shift" | "enter" | null;

type Props = {
  card: HigherLowerCard | null; // null = skeleton
  side: "A" | "B";
  kind: HigherLowerKind;
  revealed: boolean;
  /** play the flip animation on reveal (card B); card A shows its number at once */
  flip?: boolean;
  result?: "right" | "wrong" | null;
  motion?: CardMotion;
  eager?: boolean;
};

// The data's subtitles use a middle dot ("TV · 2014"); show a plain space instead.
const cleanSubtitle = (s: string | null) => (s ? s.replace(/\s*·\s*/g, " ") : "");

function Cover({ src, name, eager }: { src: string | null; name: string; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={styles.media}>
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.img} src={src} alt="" loading={eager ? "eager" : "lazy"} referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      ) : (
        <span className={styles.letter} aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
      )}
    </div>
  );
}

export function Card({ card, side, kind, revealed, flip = false, result = null, motion = null, eager }: Props) {
  const label = kind === "anime" ? "members" : "fans";
  const cls = [styles.card, motion ? styles[motion] : "", result ? styles[result] : "", styles[`side${side}`]].join(" ");

  if (!card) {
    return (
      <section className={`${cls} ${styles.skeleton}`} aria-label={`Card ${side}, loading`} aria-busy="true">
        <div className={`${styles.media} ${styles.pulse}`} />
        <div className={styles.body}>
          <span className={`${styles.bar} ${styles.pulse}`} />
          <span className={`${styles.bar} ${styles.short} ${styles.pulse}`} />
          <div className={styles.number}>
            <ScoreDigits value={null} label={label} />
            <span className={styles.label} />
          </div>
        </div>
      </section>
    );
  }

  const subtitle = cleanSubtitle(card.subtitle);
  return (
    <section className={cls} aria-label={`Card ${side}, ${card.name}`}>
      <span className={styles.tone} aria-hidden="true" />
      <div className={styles.coverWrap}>
        <Cover key={card.item_id} src={card.image_url} name={card.name} eager={eager} />
      </div>
      {result === "wrong" && <WrongSplat />}
      <div className={styles.body}>
        <h2 className={styles.name} title={card.name}>{card.name}</h2>
        <p className={styles.subtitle} title={subtitle}>{subtitle}</p>
        <div className={styles.number}>
          {!revealed && <span className={styles.sr}>Hidden number</span>}
          <ScoreDigits value={revealed ? card.value : null} label={label} flip={flip} result={result} />
          <span className={styles.label}>
            {result && (
              <span className={styles.badge} data-result={result}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="square" aria-hidden="true">
                  {result === "right" ? <path d="M4 12.5l5 5L20 6.5" /> : <path d="M5 5l14 14M19 5L5 19" />}
                </svg>
                {result === "right" ? "Right" : "Wrong"}
              </span>
            )}
          </span>
        </div>
      </div>
    </section>
  );
}
