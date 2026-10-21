import { useSyncExternalStore } from "react";
import { bestStreakKey, type HigherLowerKind } from "@/config/game";

// Best streak lives in sessionStorage (the home page reads it too). Same-tab writes notify through `listeners`.
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function read(kind: HigherLowerKind) {
  try {
    return Number(sessionStorage.getItem(bestStreakKey(kind))) || 0;
  } catch {
    return 0;
  }
}

// Session fallback when storage is blocked, so "Best" still moves during the visit.
const memory: Record<string, number> = {};

export function saveBest(kind: HigherLowerKind, streak: number) {
  if (streak <= Math.max(read(kind), memory[kind] ?? 0)) return;
  memory[kind] = streak;
  try {
    sessionStorage.setItem(bestStreakKey(kind), String(streak));
  } catch {
    // blocked storage: only the in-memory value moves
  }
  listeners.forEach((l) => l());
}

export function useBestStreak(kind: HigherLowerKind) {
  return useSyncExternalStore(subscribe, () => Math.max(read(kind), memory[kind] ?? 0), () => 0);
}
