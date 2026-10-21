// Game rules shared by the UI copy and (later) the game screens.
// The server-side limits live in warehouse/supabase_schema.sql (submit_guess / reveal_hint); keep them in sync.

export const MAX_GUESSES = 15;
export const HINT_AFTER_GUESSES = [5, 10] as const;
export const HIGHER_LOWER_WIN_STREAK = 20;

// Data modes as named in the warehouse (dim_game_items.mode): franchise = normal, anime = hard (every entry).
export type GuessMode = "franchise" | "anime" | "character";
export type PlayType = "daily" | "random";
export type HigherLowerKind = "anime" | "character";

export const guessHref = (mode: GuessMode, play: PlayType) => `/play/${mode}/${play}`;
export const higherLowerHref = (kind: HigherLowerKind) => `/higher-lower/${kind}`;

// sessionStorage key for a Higher or Lower best streak ("Best" on the home page)
export const bestStreakKey = (kind: HigherLowerKind) => `animdle:best:${kind}`;
