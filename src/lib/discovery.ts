import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { searchSpyWithCache } from "@/lib/spyCache";
import type { SpyFilters } from "@/lib/spy";

// ============================================================================
// Découverte HEBDOMADAIRE : une fois tous les 7 jours, le système cherche
// lui-même les mots-clés de discovery_keywords (niche × zone), dans un BUDGET
// par semaine. (Chaque matin, on s'enrichit seulement des recherches déjà
// faites par les utilisateurs — cron /api/cron/shops, sans appel Apify.)
// Économie Apify :
//  1) une recherche faite récemment sur ce mot-clé et cette zone (par un
//     utilisateur ou le système) est réutilisée — aucun appel ;
//  2) le cache exact (12 h) de searchSpyWithCache s'applique ensuite ;
//  3) une combinaison mot-clé × zone n'est recherchée qu'une fois par semaine ;
//  4) arrêt immédiat si Apify refuse (crédit épuisé).
// ============================================================================

export const ZONE_COUNTRIES: Record<string, string[]> = {
  africa: ["CI", "SN", "CM", "GA", "BJ"],
  europe: ["FR", "BE"],
  america: ["CA", "US"],
};

const REFRESH_DAYS = 7;
const REUSE_DAYS = 7;
const CONCURRENCY = 3;

type Due = { id: number; keyword: string; zone: string; runs: number };

export type DiscoveryReport = {
  planned: number;
  reused: number;
  searched: number;
  ads: number;
  stoppedReason?: string;
};

/** Lance un passage de découverte (cron). `budget` = nb max d'appels Apify. */
export async function runDiscovery(budget: number, deadlineMs: number): Promise<DiscoveryReport> {
  const admin = createAdminClient();
  const t0 = Date.now();
  const dueBefore = new Date(Date.now() - REFRESH_DAYS * 86_400_000).toISOString();
  const { data } = await admin
    .from("discovery_keywords")
    .select("id, keyword, zone, runs")
    .eq("enabled", true)
    .or(`last_run_at.is.null,last_run_at.lt.${dueBefore}`)
    .order("last_run_at", { ascending: true, nullsFirst: true })
    .order("id")
    .limit(budget * 3);
  const queue = (data ?? []) as Due[];
  const report: DiscoveryReport = { planned: queue.length, reused: 0, searched: 0, ads: 0 };
  let stop: string | null = null;

  async function done(d: Due, country: string, count: number, source: string) {
    await admin
      .from("discovery_keywords")
      .update({ last_run_at: new Date().toISOString(), last_country: country, last_count: count, last_source: source, runs: d.runs + 1 })
      .eq("id", d.id);
  }

  async function handle(d: Due) {
    const countries = ZONE_COUNTRIES[d.zone] ?? ["FR"];
    // 1) Réutilisation : même mot-clé déjà cherché récemment dans la zone.
    const since = new Date(Date.now() - REUSE_DAYS * 86_400_000).toISOString();
    const { data: prev } = await admin
      .from("spy_searches")
      .select("raw_count, filters")
      .ilike("filters->>q", d.keyword)
      .in("filters->>country", countries)
      .gte("created_at", since)
      .limit(1)
      .maybeSingle();
    if (prev) {
      report.reused++;
      const c = (prev.filters as { country?: string } | null)?.country ?? countries[0];
      await done(d, c, prev.raw_count ?? 0, "réutilisée");
      return;
    }
    if (report.searched >= budget) return;
    report.searched++;
    // 2) Pays en rotation dans la zone.
    const country = countries[d.runs % countries.length];
    const filters: SpyFilters = { q: d.keyword, country, statut: "active", tri: "score", limit: 30 };
    try {
      const r = await searchSpyWithCache(filters, null);
      report.ads += r.ads.length;
      await done(d, country, r.raw_count, r.cached ? "cache" : "apify");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/hard limit|platform-feature-disabled|403|402/i.test(msg)) stop = "Apify : limite de crédit atteinte";
      else console.error("[discovery]", d.keyword, d.zone, msg.slice(0, 200));
    }
  }

  const worker = async () => {
    while (queue.length && !stop && Date.now() - t0 < deadlineMs && report.searched < budget) {
      await handle(queue.shift()!);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  if (stop) report.stoppedReason = stop;
  return report;
}

/** Recherches Apify déjà faites par la découverte cette semaine. */
export async function discoveryUsedThisWeek(): Promise<number> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - 6 * 86_400_000).toISOString();
  const { count } = await admin
    .from("discovery_keywords")
    .select("id", { count: "exact", head: true })
    .eq("last_source", "apify")
    .gte("last_run_at", since);
  return count ?? 0;
}
