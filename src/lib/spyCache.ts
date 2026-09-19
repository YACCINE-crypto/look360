import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchSpyAds } from "@/lib/apify";
import { applySpyFilters, type SpyFilters, type SpyAd } from "@/lib/spy";
import type { Json } from "@/lib/database.types";

/** Durée de validité d'une recherche en cache (§7 — éviter de re-payer Apify). */
const TTL_MS = 12 * 60 * 60 * 1000; // 12 h
/** Plafond d'appels Apify réels par utilisateur et par jour (garde-fou coût). */
const DAILY_CAP = 40;

/** Clé de cache : uniquement les paramètres qui façonnent l'appel Apify. */
function cacheKey(f: SpyFilters): string {
  return JSON.stringify({
    q: (f.q || "").toLowerCase().trim(),
    country: f.country,
    pageId: f.pageId || "",
    platform: f.platform || "",
    statut: f.statut || "active",
    mediaType: f.mediaType || "all",
    limit: f.limit || 50,
  });
}

export type SpyCacheResult = {
  url: string;
  raw_count: number;
  count: number;
  ads: SpyAd[];
  cached: boolean;
  capped?: boolean;
};

/**
 * Recherche Spy avec cache + plafond. Les critères numériques (ancienneté,
 * reach, variantes) et le tri sont appliqués APRÈS le cache, donc les changer
 * ne relance pas Apify.
 */
export async function searchSpyWithCache(
  filters: SpyFilters,
  userId: string | null,
): Promise<SpyCacheResult> {
  const admin = createAdminClient();
  const key = cacheKey(filters);
  const since = new Date(Date.now() - TTL_MS).toISOString();

  // 1) Cache récent pour cette clé (partagé entre utilisateurs — données Meta publiques).
  const { data: hit } = await admin
    .from("spy_searches")
    .select("results, url, raw_count")
    .eq("cache_key", key)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (hit) {
    const ads = applySpyFilters((hit.results as SpyAd[]) ?? [], filters);
    return { url: hit.url ?? "", raw_count: hit.raw_count ?? 0, count: ads.length, ads, cached: true };
  }

  // 2) Plafond journalier d'appels réels par utilisateur.
  if (userId) {
    const startDay = new Date();
    startDay.setHours(0, 0, 0, 0);
    const { count } = await admin
      .from("spy_searches")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", startDay.toISOString());
    if ((count ?? 0) >= DAILY_CAP) {
      return { url: "", raw_count: 0, count: 0, ads: [], cached: false, capped: true };
    }
  }

  // 3) Appel réel + mise en cache.
  const res = await fetchSpyAds(filters);
  await admin.from("spy_searches").insert({
    user_id: userId,
    cache_key: key,
    filters: filters as unknown as Json,
    url: res.url,
    results: res.ads as unknown as Json,
    raw_count: res.raw_count,
  });

  const ads = applySpyFilters(res.ads, filters);
  return { url: res.url, raw_count: res.raw_count, count: ads.length, ads, cached: false };
}
