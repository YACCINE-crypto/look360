import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchSpyAds } from "@/lib/apify";
import { applySpyFilters, SPY_COUNTRIES_HARD, type SpyFilters, type SpyAd } from "@/lib/spy";
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
    d: f.details ? 1 : 0,
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

/** Résultat en cache pour ces filtres (ou null). Partagé (données Meta publiques). */
export async function getCachedSearch(
  filters: SpyFilters,
): Promise<{ ads: SpyAd[]; url: string; raw_count: number } | null> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - TTL_MS).toISOString();
  const { data: hit } = await admin
    .from("spy_searches")
    .select("results, url, raw_count")
    .eq("cache_key", cacheKey(filters))
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!hit) return null;
  return {
    ads: applySpyFilters((hit.results as SpyAd[]) ?? [], filters),
    url: hit.url ?? "",
    raw_count: hit.raw_count ?? 0,
  };
}

/** true si l'utilisateur a atteint son plafond d'appels réels du jour. */
export async function dailyCapReached(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const admin = createAdminClient();
  const startDay = new Date();
  startDay.setHours(0, 0, 0, 0);
  const { count } = await admin
    .from("spy_searches")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startDay.toISOString());
  return (count ?? 0) >= DAILY_CAP;
}

/** Enregistre un résultat en cache (après un appel réel). */
export async function persistSearch(
  filters: SpyFilters,
  userId: string | null,
  url: string,
  ads: SpyAd[],
  raw_count: number,
): Promise<void> {
  const admin = createAdminClient();
  await admin.from("spy_searches").insert({
    user_id: userId,
    cache_key: cacheKey(filters),
    filters: filters as unknown as Json,
    url,
    results: ads as unknown as Json,
    raw_count,
  });
}

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

export type SpyMultiResult = SpyCacheResult & {
  countries: string[];
  countries_ok: string[];
};

/** Comparateur de tri (identique à applySpyFilters, réutilisé après fusion). */
function sortAds(ads: SpyAd[], tri: SpyFilters["tri"]): SpyAd[] {
  const t = tri ?? "score";
  return [...ads].sort((x, y) => {
    if (t === "reach") return (y.reach ?? 0) - (x.reach ?? 0);
    if (t === "anciennete") return (y.jours_actifs ?? 0) - (x.jours_actifs ?? 0);
    if (t === "variants") return y.variants_count - x.variants_count;
    return y.score - x.score;
  });
}

/**
 * Recherche multi-pays : l'actor Apify ne prend qu'UN pays par appel, donc on
 * lance une recherche par pays (en parallèle, chacune passant par le cache et
 * le plafond journalier) puis on FUSIONNE en dédupliquant par ad_archive_id.
 * Plafonné à SPY_COUNTRIES_HARD pour maîtriser le coût et tenir dans le temps
 * serverless. Chaque pays déjà connu de l'actor est instantané (cache 12 h).
 */
export async function searchSpyManyCountries(
  base: SpyFilters,
  countries: string[],
  userId: string | null,
): Promise<SpyMultiResult> {
  const uniq = Array.from(
    new Set(countries.map((c) => c.trim().toUpperCase()).filter(Boolean)),
  ).slice(0, SPY_COUNTRIES_HARD);

  if (uniq.length === 0) {
    return {
      url: "", raw_count: 0, count: 0, ads: [], cached: false,
      countries: [], countries_ok: [],
    };
  }

  const settled = await Promise.allSettled(
    uniq.map((country) => searchSpyWithCache({ ...base, country }, userId)),
  );

  const ok: SpyCacheResult[] = [];
  for (const s of settled) if (s.status === "fulfilled") ok.push(s.value);

  const capped = ok.length > 0 && ok.every((r) => r.capped);
  const cached = ok.length > 0 && ok.every((r) => r.cached);
  const countries_ok = uniq.filter((_, i) => settled[i].status === "fulfilled");

  // Fusion + déduplication par ad_archive_id (on garde la 1re occurrence).
  const seen = new Set<string>();
  const merged: SpyAd[] = [];
  let raw_count = 0;
  for (const r of ok) {
    raw_count += r.raw_count;
    for (const ad of r.ads) {
      const id = ad.ad_archive_id;
      if (id && seen.has(id)) continue;
      if (id) seen.add(id);
      merged.push(ad);
    }
  }

  const ads = sortAds(merged, base.tri).slice(0, base.limit ?? 50);
  return {
    url: ok[0]?.url ?? "",
    raw_count,
    count: ads.length,
    ads,
    cached,
    capped: capped || undefined,
    countries: uniq,
    countries_ok,
  };
}
