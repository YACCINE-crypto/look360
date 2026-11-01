import { after, NextResponse } from "next/server";
import { discoveryUsedThisWeek, runDiscovery } from "@/lib/discovery";
import { callShopCrawl } from "@/lib/shops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Recherches par passage (≈ ce qui tient en 5 min, 3 en parallèle). */
const PER_PASS = 12;

/**
 * Découverte HEBDOMADAIRE (cron du lundi) : recherche des mots-clés de
 * discovery_keywords, dans un budget par semaine DISCOVERY_WEEKLY_SEARCHES
 * (100 par défaut). Une fonction ne dure que 5 min : chaque passage traite
 * PER_PASS recherches puis relance le passage suivant, jusqu'à épuisement du
 * budget, de la liste ou du crédit Apify. Ré-indexe les boutiques à la fin.
 * Vercel Cron envoie `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const weekly = Math.max(0, Math.min(600, Number(process.env.DISCOVERY_WEEKLY_SEARCHES ?? 100) || 0));
  const remaining = Math.max(0, weekly - (await discoveryUsedThisWeek()));
  const budget = Math.min(PER_PASS, remaining);
  const report = budget > 0 ? await runDiscovery(budget, 220_000) : { planned: 0, reused: 0, searched: 0, ads: 0 };
  const index = await callShopCrawl({ mode: "index" }, 60_000);

  // Passage suivant si budget restant, travail restant et pas d'arrêt Apify.
  const pass = Number(new URL(request.url).searchParams.get("pass") ?? 1);
  const more =
    !("stoppedReason" in report && report.stoppedReason) &&
    report.planned > 0 &&
    (report.searched > 0 || report.reused > 0) &&
    remaining - report.searched > 0 &&
    pass < 60;
  if (more) {
    const next = new URL(request.url);
    next.searchParams.set("pass", String(pass + 1));
    after(() =>
      fetch(next, { headers: { authorization: auth } })
        .then(() => undefined)
        .catch((e) => console.error("[discovery] relance", e)),
    );
  }
  return NextResponse.json({ ok: true, weekly, remaining, report, index, pass, next: more });
}
