import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshFeed } from "@/lib/feed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Rafraîchit le FEED COMMUN (pubs gagnantes du jour), partagé par tous.
 * Protégé par CRON_SECRET (en-tête `x-cron-secret`). Appelé une fois par jour
 * par pg_cron (voir docs/RESTE_A_FAIRE.md). Tourne en service_role (admin).
 */
async function run(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const admin = createAdminClient();
    const res = await refreshFeed(admin);
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "feed_refresh_failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return run(request);
}
// Autorise aussi un déclenchement manuel GET (avec le secret) pour tester.
export async function GET(request: Request) {
  return run(request);
}
