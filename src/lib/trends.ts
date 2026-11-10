import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { listProducts, listShops, ZONE_CODES, type Zone } from "@/lib/shopQueries";
import { mirrorAds, type MirroredAd } from "@/lib/mediaMirror";
import type { SpyAd } from "@/lib/spy";

// ============================================================================
// Top Trend = CLASSEMENT recalculé plusieurs fois par jour (/api/cron/trends),
// stocké dans `trend_rankings`, lu par la page. Rien de figé :
//   - produits : ≥ 2 pubs actives, triés par winner_score (calculé en base) ;
//   - boutiques : ≥ 3 pubs actives, triées par winner_score ;
//   - pubs : score 70+, actives, une par annonceur (recherches 30 j + feed),
//     miniatures copiées sur Bunny AVANT d'entrer dans le classement.
// Classement par zone (Tous / Afrique / Europe / Amérique) ; le filtre niche
// s'applique à la lecture.
// ============================================================================

export const TREND_ZONES: Zone[] = ["all", "africa", "europe", "america"];
export const PRODUCT_MIN_ACTIVE = 2;
export const SHOP_MIN_ACTIVE = 3;
export const AD_SCORE_MIN = 70;
const KEEP = 100;
const KEEP_ADS = 60;

type Admin = ReturnType<typeof createAdminClient>;
// Tables récentes absentes des types générés.
const db = (a: Admin) => a as unknown as { from: (t: string) => any; rpc: (f: string, p?: Record<string, unknown>) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

export type RankedAd = SpyAd & { trend_niche?: string | null };
type Row = { position: number; item_id: string; score: number; payload?: unknown };

const FEED_NICHE: Record<string, string> = { "Auto & moto": "Automobile", "Bien-être": "Santé", "Montre & tech": "High-tech" };

/** Toutes les pubs fortes des 30 derniers jours (recherches + feed), avec leur niche. */
async function candidateAds(admin: Admin): Promise<RankedAd[]> {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [{ data: rows }, { data: feed }, { data: kws }] = await Promise.all([
    admin.from("spy_searches").select("results, filters").gte("created_at", since).order("created_at", { ascending: false }).limit(600),
    admin.from("feed_ads").select("payload, niche, thumbnail_cdn_url, media_cdn_url"),
    admin.from("discovery_keywords").select("keyword, niche"),
  ]);
  const nicheOf = new Map((kws ?? []).map((k) => [String(k.keyword).toLowerCase(), (k as { niche?: string }).niche ?? null]));
  const all: RankedAd[] = [];
  for (const f of feed ?? []) {
    const ad = f.payload as unknown as SpyAd;
    if (!ad?.ad_archive_id) continue;
    all.push({
      ...ad,
      thumbnail_url: f.thumbnail_cdn_url ?? ad.thumbnail_url,
      media_hls_url: f.media_cdn_url ?? ad.media_hls_url ?? null,
      media_source_url: ad.media_source_url ?? ad.media_url,
      trend_niche: FEED_NICHE[f.niche ?? ""] ?? f.niche ?? null,
    });
  }
  for (const r of rows ?? []) {
    const q = String((r.filters as { q?: string } | null)?.q ?? "").toLowerCase().trim();
    for (const ad of (r.results as unknown as SpyAd[]) ?? []) if (ad?.ad_archive_id) all.push({ ...ad, trend_niche: nicheOf.get(q) ?? null });
  }
  return all.filter((a) => a.is_active && a.score >= AD_SCORE_MIN && !(a as MirroredAd).media_missing);
}

/** Meilleure pub par annonceur, triée, pour une zone. */
function rankAds(all: RankedAd[], zone: Zone): RankedAd[] {
  const codes = zone === "all" ? null : new Set(ZONE_CODES[zone]);
  const best = new Map<string, RankedAd>();
  for (const a of all) {
    if (codes && !codes.has(a.country ?? "")) continue;
    const key = a.page_id ?? a.page_name ?? a.ad_archive_id;
    const prev = best.get(key);
    if (!prev || a.score > prev.score || (a.score === prev.score && (a.reach ?? 0) > (prev.reach ?? 0))) best.set(key, a);
  }
  return [...best.values()]
    .sort((a, b) => b.score - a.score || (b.reach ?? 0) - (a.reach ?? 0) || (b.jours_actifs ?? 0) - (a.jours_actifs ?? 0))
    .slice(0, KEEP_ADS);
}

/** Recalcule tout le classement. Renvoie le nombre d'éléments par liste. */
export async function recomputeTrends(budgetMs = 90_000): Promise<Record<string, number>> {
  const admin = createAdminClient();
  const report: Record<string, number> = {};
  const save = async (kind: string, zone: Zone, rows: Row[]) => {
    const { data, error } = await db(admin).rpc("replace_trend_rankings", { p_kind: kind, p_zone: zone, p_rows: rows });
    if (error) throw new Error(`replace_trend_rankings ${kind}/${zone}: ${error.message}`);
    report[`${kind}:${zone}`] = Number(data) || 0;
  };

  const deadline = Date.now() + budgetMs;
  const ads = await candidateAds(admin);
  for (const zone of TREND_ZONES) {
    const [products, shops] = await Promise.all([
      listProducts({ zone, sort: "score", withAds: true, minActive: PRODUCT_MIN_ACTIVE, limit: KEEP }),
      listShops({ zone, sort: "score", minActive: SHOP_MIN_ACTIVE, limit: KEEP }),
    ]);
    await save("product", zone, products.items.map((p, i) => ({ position: i + 1, item_id: p.id, score: p.winner_score })));
    await save("shop", zone, shops.shops.map((s, i) => ({ position: i + 1, item_id: s.id, score: s.winner_score })));

    // Pubs : miniatures sur Bunny avant publication (liens Meta = expirent).
    const ranked = rankAds(ads, zone);
    const mirrored = await mirrorAds(ranked as MirroredAd[], { videos: false, budgetMs: Math.max(5_000, (deadline - Date.now()) / 2) });
    const ok = (mirrored.ads as RankedAd[]).filter((a) => !(a as MirroredAd).media_missing);
    await save("ad", zone, ok.map((a, i) => ({ position: i + 1, item_id: a.ad_archive_id, score: a.score, payload: a })));
  }
  return report;
}

/** Lecture d'un classement (ids dans l'ordre) + date du calcul. */
export async function readRanking(kind: "product" | "shop" | "ad", zone: Zone) {
  const admin = createAdminClient();
  const { data } = await db(admin)
    .from("trend_rankings")
    .select("item_id, position, payload, computed_at")
    .eq("kind", kind)
    .eq("zone", zone)
    .order("position");
  const rows = (data ?? []) as { item_id: string; position: number; payload: unknown; computed_at: string }[];
  return { rows, computedAt: rows[0]?.computed_at ?? null };
}
