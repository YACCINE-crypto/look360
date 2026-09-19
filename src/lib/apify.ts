import "server-only";
import {
  buildAdLibraryUrl,
  normalizeApifyItem,
  applySpyFilters,
  type SpyFilters,
  type SpyAd,
} from "./spy";

// Actor Apify (schéma vérifié) : curious_coder/facebook-ads-library-scraper.
const ACTOR = "curious_coder~facebook-ads-library-scraper";

export type SpyFetchResult = { url: string; raw_count: number; ads: SpyAd[] };

/**
 * Récupère + normalise le dataset Apify pour l'URL construite depuis les
 * filtres "de forme" (q/pays/pageId/plateforme/statut/média). NE filtre PAS
 * les critères numériques (ancienneté/reach/variantes) ni le tri : c'est fait
 * ensuite, ce qui rend le résultat cachable. APIFY_TOKEN = env serveur.
 */
export async function fetchSpyAds(filters: SpyFilters): Promise<SpyFetchResult> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN manquant (variable d'environnement serveur).");

  const url = buildAdLibraryUrl(filters);
  const count = Math.min(Math.max(filters.limit ?? 50, 1), 100); // plafond 100 (§7)
  const input = { urls: [{ url, method: "GET" }], count, scrapeAdDetails: true };

  const endpoint =
    `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items` +
    `?token=${token}&format=json`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Apify ${res.status}: ${t.slice(0, 300)}`);
  }

  const items = (await res.json()) as unknown;
  const arr = Array.isArray(items) ? (items as Record<string, unknown>[]) : [];
  return {
    url,
    raw_count: arr.length,
    ads: arr.map((it) => normalizeApifyItem(it, filters.country)),
  };
}

export type SpySearchResult = {
  url: string;
  raw_count: number;
  count: number;
  ads: SpyAd[];
};

/** Recherche live (sans cache) : fetch + filtres numériques + tri. Utilisée par le cron. */
export async function runSpySearch(filters: SpyFilters): Promise<SpySearchResult> {
  const { url, raw_count, ads } = await fetchSpyAds(filters);
  const filtered = applySpyFilters(ads, filters);
  return { url, raw_count, count: filtered.length, ads: filtered };
}
