import { NextResponse } from "next/server";
import { callShopCrawl } from "@/lib/shops";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Cron quotidien du catalogue boutiques :
 * 1) recalcule compteurs et scores (l'indexation des pubs est continue) ;
 * 2) met à jour les boutiques périmées (> 7 j) par lots, dans le temps imparti.
 * Vercel Cron envoie `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const t0 = Date.now();
  // L'indexation pubs → boutiques se fait en continu (déclencheurs 0043) ; ici,
  // simple recalcul des compteurs (l'ancien index complet dépassait 8 s).
  const admin = createAdminClient() as unknown as { rpc: (f: string, p?: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }> };
  const { error: reaggError } = await admin.rpc("catalog_reaggregate", { p_domains: null });
  const index = reaggError ? { error: reaggError.message } : "ok";
  let crawled = 0;
  let batches = 0;
  while (Date.now() - t0 < 230_000) {
    const r = (await callShopCrawl({ mode: "crawl", limit: 40 }, 130_000)) as { crawled?: number } | null;
    batches++;
    const n = r?.crawled ?? 0;
    crawled += n;
    if (n === 0) break;
  }
  return NextResponse.json({ ok: true, index, crawled, batches, took_ms: Date.now() - t0 });
}
