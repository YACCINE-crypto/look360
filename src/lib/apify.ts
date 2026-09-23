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
const API = "https://api.apify.com/v2";

function token(): string {
  const t = process.env.APIFY_TOKEN;
  if (!t) throw new Error("APIFY_TOKEN manquant (variable d'environnement serveur).");
  return t;
}

/**
 * IMPORTANT perfs : `scrapeAdDetails=false` pour la LISTE. Le détail complet
 * de chaque pub (visite de la fiche annonce) est ce qui coûte le plus de temps
 * (~45 s). La grille se contente des champs de la carte (créative, page, date,
 * variantes, reach, lien) ; le détail complet est chargé à la demande à
 * l'ouverture d'une pub (voir fetchAdDetail). Plafond de résultats abaissé.
 */
function actorInput(url: string, count: number, withDetails: boolean) {
  return {
    urls: [{ url, method: "GET" }],
    count: Math.min(Math.max(count, 1), 100),
    scrapeAdDetails: withDetails,
  };
}

export type SpyFetchResult = { url: string; raw_count: number; ads: SpyAd[] };

/**
 * Récupère + normalise le dataset Apify pour l'URL construite depuis les
 * filtres "de forme" (q/pays/pageId/plateforme/statut/média). NE filtre PAS
 * les critères numériques (ancienneté/reach/variantes) ni le tri : c'est fait
 * ensuite, ce qui rend le résultat cachable. APIFY_TOKEN = env serveur.
 * Liste = sans détails (rapide).
 */
export async function fetchSpyAds(filters: SpyFilters): Promise<SpyFetchResult> {
  const url = buildAdLibraryUrl(filters);
  const input = actorInput(url, filters.limit ?? 40, filters.details ?? false);

  const endpoint =
    `${API}/acts/${ACTOR}/run-sync-get-dataset-items?token=${token()}&format=json`;

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

// --- Run asynchrone + lecture du dataset par lots (affichage progressif) -----

export type SpyRun = { runId: string; datasetId: string; url: string };
const TERMINAL = new Set(["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"]);

/** Démarre un run (sans attendre) et renvoie les identifiants pour poller. */
export async function startSpyRun(filters: SpyFilters): Promise<SpyRun> {
  const url = buildAdLibraryUrl(filters);
  const input = actorInput(url, filters.limit ?? 40, false);
  const res = await fetch(`${API}/acts/${ACTOR}/runs?token=${token()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Apify run ${res.status}: ${t.slice(0, 200)}`);
  }
  const j = (await res.json()) as { data?: { id?: string; defaultDatasetId?: string } };
  const runId = j.data?.id;
  const datasetId = j.data?.defaultDatasetId;
  if (!runId || !datasetId) throw new Error("Apify run: réponse inattendue");
  return { runId, datasetId, url };
}

/** État courant du run (SUCCEEDED / FAILED / RUNNING…). */
export async function getRunStatus(runId: string): Promise<string> {
  const res = await fetch(`${API}/acts/${ACTOR}/runs/${runId}?token=${token()}`);
  if (!res.ok) return "RUNNING";
  const j = (await res.json()) as { data?: { status?: string } };
  return j.data?.status ?? "RUNNING";
}

export function isTerminal(status: string): boolean {
  return TERMINAL.has(status);
}

/** Lit un lot d'items déjà produits dans le dataset (offset/limit). */
export async function fetchDatasetItems(
  datasetId: string,
  offset: number,
  limit: number,
): Promise<Record<string, unknown>[]> {
  const res = await fetch(
    `${API}/datasets/${datasetId}/items?token=${token()}&offset=${offset}&limit=${limit}&clean=true&format=json`,
  );
  if (!res.ok) return [];
  const j = (await res.json()) as unknown;
  return Array.isArray(j) ? (j as Record<string, unknown>[]) : [];
}

/**
 * Détail complet d'UNE pub, à la demande (ouverture d'une pub) :
 * scrapeAdDetails=true sur l'URL `?id=<ad_archive_id>`. Renvoie la pub
 * normalisée enrichie, ou null si introuvable.
 */
export async function fetchAdDetail(adArchiveId: string, country: string): Promise<SpyAd | null> {
  const url = `https://www.facebook.com/ads/library/?id=${encodeURIComponent(adArchiveId)}`;
  const input = actorInput(url, 1, true);
  const res = await fetch(
    `${API}/acts/${ACTOR}/run-sync-get-dataset-items?token=${token()}&format=json`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  if (!res.ok) throw new Error(`Apify detail ${res.status}`);
  const items = (await res.json()) as unknown;
  const arr = Array.isArray(items) ? (items as Record<string, unknown>[]) : [];
  const raw = arr.find((it) => String(it.ad_archive_id ?? it.ad_id ?? "") === adArchiveId) ?? arr[0];
  return raw ? normalizeApifyItem(raw, country) : null;
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
