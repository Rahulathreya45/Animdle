import styles from "./Thumb.module.css";

// Cover image, or an ink-framed initial when there is none. Decorative: the name always sits next to it.
export function Thumb({ src, name, size }: { src: string | null; name: string; size: number }) {
  const box = { width: size, height: size };
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={styles.thumb} src={src} alt="" width={size} height={size} loading="lazy" referrerPolicy="no-referrer" style={box} />
  ) : (
    <span className={styles.placeholder} aria-hidden="true" style={{ ...box, fontSize: size / 2.4 }}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
