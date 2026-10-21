import type { GuessMode, HigherLowerKind, PlayType } from "@/config/game";
import { getSupabase } from "@/supabase/client";
import type { ClueDef, Game, Guess, HigherLowerCard, TitleHit } from "./types";

// config = env vars missing, missing = no daily puzzle, duplicate = already guessed, other = anything else
export type GameErrorKind = "config" | "missing" | "duplicate" | "other";

export class GameError extends Error {
  kind: GameErrorKind;
  constructor(kind: GameErrorKind) {
    super(kind);
    this.kind = kind;
  }
}

async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const supabase = getSupabase();
  if (!supabase) throw new GameError("config");
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new GameError(error.code === "23505" ? "duplicate" : error.code === "P0002" ? "missing" : "other");
  return data as T;
}

export const startGame = (mode: GuessMode, play: PlayType, playerId: string, tier: number) =>
  call<Game>("start_game", { p_mode: mode, p_play_type: play, p_player_id: playerId, p_tier: tier });

export const getGame = (sessionId: string) => call<Game>("get_game", { p_session_id: sessionId });

export const submitGuess = (sessionId: string, guessId: string) =>
  call<{ feedback: Guess; game: Game }>("submit_guess", { p_session_id: sessionId, p_guess_id: guessId });

export const revealHint = (sessionId: string, clueKey: string) =>
  call<Game>("reveal_hint", { p_session_id: sessionId, p_clue_key: clueKey });

export const giveUp = (sessionId: string) => call<Game>("give_up", { p_session_id: sessionId });

export const searchTitles = (q: string, mode: GuessMode) =>
  call<TitleHit[]>("search_game_titles", { q, k: mode, max_results: 8 });

export const fetchDeck = (kind: HigherLowerKind, size = 50) =>
  call<HigherLowerCard[]>("higher_lower_deck", { p_kind: kind, p_size: size });

// Column headers and the hint menu. Cached per mode; a failed fetch is not cached.
const clueCache = new Map<GuessMode, Promise<ClueDef[]>>();

export function fetchClues(mode: GuessMode): Promise<ClueDef[]> {
  let cached = clueCache.get(mode);
  if (!cached) {
    const supabase = getSupabase();
    if (!supabase) return Promise.reject(new GameError("config"));
    cached = Promise.resolve(
      supabase.from("game_clues").select("clue_key,label,compare,sort_order").eq("mode", mode).order("sort_order"),
    ).then(({ data, error }) => {
      if (error || !data?.length) throw new GameError("other");
      return data as ClueDef[];
    });
    cached.catch(() => clueCache.delete(mode));
    clueCache.set(mode, cached);
  }
  return cached;
}

// Anonymous player id, kept in localStorage so a daily game resumes after a reload.
const PLAYER_KEY = "animdle:player";
let memoryPlayer: string | null = null;

export function getPlayerId(): string {
  try {
    let id = localStorage.getItem(PLAYER_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(PLAYER_KEY, id);
    }
    return id;
  } catch {
    // blocked storage: the id lives for this visit only
    return (memoryPlayer ??= crypto.randomUUID());
  }
}

// A random round is remembered per mode for this tab, so a reload resumes it.
const randomKey = (mode: GuessMode) => `animdle:random:${mode}`;

export function savedRandomSession(mode: GuessMode): string | null {
  try {
    return sessionStorage.getItem(randomKey(mode));
  } catch {
    return null;
  }
}

export function saveRandomSession(mode: GuessMode, sessionId: string) {
  try {
    sessionStorage.setItem(randomKey(mode), sessionId);
  } catch {
    // resume just won't work
  }
}
