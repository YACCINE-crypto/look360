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

export type SpySearchResult = {
  url: string;
  raw_count: number;
  count: number;
  ads: SpyAd[];
  sample_raw?: unknown;
};

/**
 * Lance l'actor Apify sur l'URL Ad Library construite depuis les filtres,
 * récupère le dataset et normalise. APIFY_TOKEN = env serveur uniquement.
 */
export async function runSpySearch(
  filters: SpyFilters,
  opts: { includeRaw?: boolean } = {},
): Promise<SpySearchResult> {
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
  const ads = arr.map((it) => normalizeApifyItem(it, filters.country));

  return {
    url,
    raw_count: arr.length,
    count: ads.length,
    ads: applySpyFilters(ads, filters),
    ...(opts.includeRaw ? { sample_raw: arr[0] } : {}),
  };
}
