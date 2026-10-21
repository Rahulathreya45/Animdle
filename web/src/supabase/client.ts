import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// The browser only ever uses the publishable key; the database exposes the game through RPC functions and
// read-only tables (warehouse/supabase_schema.sql). Returns null when the env vars are missing.
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  client ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
