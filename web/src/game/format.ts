import type { ClueValue } from "./types";

const COUNTRY: Record<string, string> = { JP: "Japan", CN: "China", KR: "Korea", TW: "Taiwan" };
const KEEP_UPPER = new Set(["TV", "OVA", "ONA"]);
const GROUPED = new Set(["favourites", "popularity"]);

// MANGA -> Manga, LIGHT_NOVEL -> Light novel, TV_SHORT -> TV short
function humanise(text: string): string {
  if (!/^[A-Z0-9_]+$/.test(text)) return text;
  const words = text.split("_").map((w) => (KEEP_UPPER.has(w) ? w : w.toLowerCase()));
  const joined = words.join(" ");
  return KEEP_UPPER.has(words[0]) ? joined : joined.charAt(0).toUpperCase() + joined.slice(1);
}

// One display string per clue value. Unknown or missing values show as "?".
export function formatValue(key: string, value: ClueValue | undefined): string {
  if (key === "episodes" && value === null) return "Ongoing";
  if (value === null || value === undefined || value === "") return "?";
  if (Array.isArray(value)) return value.length ? value.map((v) => humanise(String(v))).join(", ") : "?";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    if (key === "score") return value.toFixed(1);
    return GROUPED.has(key) ? value.toLocaleString("en-US") : String(value);
  }
  if (key === "country") return COUNTRY[value] ?? value;
  if (key === "age_rating") return value;
  return humanise(value);
}
