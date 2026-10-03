import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshFeed, seedFeedFromCache } from "@/lib/feed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Rafraîchit le FEED COMMUN (pubs gagnantes du jour), partagé par tous.
 * Déclenché par Vercel Cron (voir vercel.json) qui envoie
 * `Authorization: Bearer $CRON_SECRET`. On accepte aussi `x-cron-secret` pour un
 * déclenchement manuel. Tourne en service_role (admin).
 *
 * - par défaut            → refresh complet (scrape niches × marchés + archivage)
 * - `?mode=seed`          → remplissage IMMÉDIAT depuis le cache de recherches
 *   existant (aucun appel Apify/Bunny) : utile pour pré-remplir tout de suite.
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true; // Vercel Cron
  return request.headers.get("x-cron-secret") === secret; // déclenchement manuel
}

async function run(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const mode = new URL(request.url).searchParams.get("mode");
  try {
    const admin = createAdminClient();
    const res =
      mode === "seed" ? await seedFeedFromCache(admin) : await refreshFeed(admin);
    return NextResponse.json({ ok: true, mode: mode ?? "refresh", ...res });
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
