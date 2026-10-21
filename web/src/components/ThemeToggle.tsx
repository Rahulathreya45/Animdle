"use client";

import { useSyncExternalStore } from "react";
import styles from "./ThemeToggle.module.css";

const STORAGE_KEY = "animdle:theme";

// The theme lives on <html data-theme> (set before paint in layout.tsx); this reads it as an external store.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

const isNightNow = () => document.documentElement.dataset.theme !== "day";

export function ThemeToggle() {
  const night = useSyncExternalStore(subscribe, isNightNow, () => true);

  function toggle() {
    const next = night ? "day" : "night";
    if (next === "day") document.documentElement.dataset.theme = "day";
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // private mode or blocked storage: the toggle still works for this visit
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={night}
      aria-label="Night mode"
      onClick={toggle}
      className={styles.toggle}
      data-night={night}
    >
      <span className={styles.knob} aria-hidden="true" />
      <span className={`${styles.icon} ${styles.sun}`} aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      </span>
      <span className={`${styles.icon} ${styles.moon}`} aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      </span>
    </button>
  );
}
