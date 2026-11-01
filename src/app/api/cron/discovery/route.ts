import { NextResponse } from "next/server";
import { runDiscovery } from "@/lib/discovery";
import { callShopCrawl } from "@/lib/shops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Cron quotidien de découverte (mots-clés par niche × zone), budget borné
 * par DISCOVERY_DAILY_SEARCHES (15 par défaut). Puis ré-indexation des
 * boutiques/produits trouvés. Vercel Cron envoie `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const budget = Math.max(0, Math.min(60, Number(process.env.DISCOVERY_DAILY_SEARCHES ?? 15) || 0));
  const report = budget > 0 ? await runDiscovery(budget, 220_000) : { planned: 0, reused: 0, searched: 0, ads: 0 };
  const index = await callShopCrawl({ mode: "index" }, 60_000);
  return NextResponse.json({ ok: true, budget, report, index });
}
