import { NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/adminGuard";
import { createAdminClient } from "@/lib/supabase/admin";
import { callShopCrawl } from "@/lib/shops";
import { recomputeTrends } from "@/lib/trends";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Job « catalogue vivant », plusieurs fois par jour :
 * 1) lit les boutiques nouvellement repérées (ajoutées par les déclencheurs
 *    sur les recherches et le feed) → leurs produits arrivent dans le catalogue ;
 * 2) recalcule compteurs et winner_score (pubs vieilles de plus de 30 j retirées) ;
 * 3) recalcule le classement Top Trend (produits, boutiques, pubs).
 * Vercel Cron (`Authorization: Bearer $CRON_SECRET`), `x-cron-secret`, ou
 * superadmin connecté (ouvrir l'URL dans le navigateur).
 */
async function authorized(request: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret && (request.headers.get("authorization") === `Bearer ${secret}` || request.headers.get("x-cron-secret") === secret)) return true;
  try {
    await requireSuperadmin();
    return true;
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  if (!(await authorized(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const t0 = Date.now();

  // 1) Nouvelles boutiques (et boutiques périmées) : lecture du catalogue, ~120 s max.
  let crawled = 0;
  while (Date.now() - t0 < 120_000) {
    const r = (await callShopCrawl({ mode: "crawl", limit: 40 }, 110_000)) as { crawled?: number } | null;
    const n = r?.crawled ?? 0;
    crawled += n;
    if (n === 0) break;
  }

  // 2) Compteurs + scores (rapide : ~0,2 s).
  const admin = createAdminClient() as unknown as { rpc: (f: string, p?: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }> };
  const { error } = await admin.rpc("catalog_reaggregate", { p_domains: null });

  // 3) Classement Top Trend.
  let ranking: Record<string, number> | { error: string };
  try {
    ranking = await recomputeTrends(Math.max(20_000, 270_000 - (Date.now() - t0)));
  } catch (e) {
    ranking = { error: e instanceof Error ? e.message : String(e) };
  }
  return NextResponse.json({ ok: !error && !("error" in ranking), crawled, reaggregate: error?.message ?? "ok", ranking, took_ms: Date.now() - t0 });
}
