import type { ClueDirection, ClueStatus } from "@/components/ClueTile";

// Shapes returned by the Supabase game functions (see get_game / submit_guess in warehouse/supabase_schema.sql).

export type ClueDef = { clue_key: string; label: string; compare: string; sort_order: number };

export type ClueValue = string | number | boolean | string[] | null;

export type GuessClue = { key: string; label: string; value: ClueValue; status: ClueStatus; direction: ClueDirection };

export type GuessResult = "correct" | "same_franchise" | "wrong";

export type Guess = {
  guess: { id: string; name: string; image_url: string | null };
  result: GuessResult;
  clues: GuessClue[];
  attempt_no: number;
};

export type Game = {
  session_id: string;
  mode: string;
  play_type: "daily" | "random";
  difficulty_tier: number | null;
  status: "playing" | "won" | "lost";
  gave_up: boolean;
  attempts: number;
  max_attempts: number;
  hints_available: number;
  hints: { key: string; label: string; value: ClueValue }[];
  guesses: Guess[];
  answer: { id: string; name: string; image_url: string | null; clues: Record<string, ClueValue> } | null;
};

export type TitleHit = { target_id: string; display_name: string; matched_title: string; popularity: number | null };

// One row of higher_lower_deck (view higher_lower_cards). value = members (anime) or favourites (character).
export type HigherLowerCard = {
  kind: "anime" | "character";
  item_id: string;
  name: string;
  subtitle: string | null;
  image_url: string | null;
  value: number;
  franchise_id: string | null;
  is_adult: boolean;
};
