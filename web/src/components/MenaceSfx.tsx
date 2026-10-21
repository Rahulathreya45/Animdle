import styles from "./MenaceSfx.module.css";

// JoJo's "menacing" ゴゴゴ, drawn the way the manga does it: separate bold ゴ, each tilted,
// stepping down a diagonal, filled with a thick outline. Pure decoration.
const GLYPHS = [
  { x: 18, y: 118, size: 118, rotate: "rotate(-14 70 80)" },
  { x: 104, y: 226, size: 100, rotate: "rotate(9 160 190)" },
  { x: 40, y: 338, size: 86, rotate: "rotate(-6 90 300)" },
];

export function MenaceSfx({ className = "" }: { className?: string }) {
  return (
    <svg className={`${styles.sfx} ${className}`} viewBox="0 0 260 360" width="260" height="360" aria-hidden="true">
      {GLYPHS.map((g) => (
        <text key={g.y} x={g.x} y={g.y} fontSize={g.size} transform={g.rotate}>
          ゴ
        </text>
      ))}
    </svg>
  );
}
