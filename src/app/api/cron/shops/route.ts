import { NextResponse } from "next/server";
import { callShopCrawl } from "@/lib/shops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Cron quotidien du catalogue boutiques :
 * 1) ré-indexe les pubs récentes → boutiques / liens pub-produit ;
 * 2) met à jour les boutiques périmées (> 7 j) par lots, dans le temps imparti.
 * Vercel Cron envoie `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const t0 = Date.now();
  const index = await callShopCrawl({ mode: "index" }, 60_000);
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
