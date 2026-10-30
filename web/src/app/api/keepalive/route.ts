import { NextResponse } from "next/server";
import { getSupabase } from "@/supabase/client";

// Called once a day by Vercel Cron (vercel.json). One cheap read keeps the free Supabase project from being paused
// for inactivity. Vercel sends `Authorization: Bearer $CRON_SECRET`, so nobody else can trigger it.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase is not configured" }, { status: 500 });

  const { error } = await supabase.from("game_clues").select("clue_key").limit(1);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 502 });

  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
