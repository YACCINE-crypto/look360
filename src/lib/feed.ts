import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { systemAdsLeft } from "@/lib/apifyBudget";
import { searchSpyWithCache } from "@/lib/spyCache";
import { storeFromUrl, mediaStorageConfigured } from "@/lib/mediaStorage";
import {
  ensureStream,
  isStreamUrl,
  streamConfigured,
  streamStatus,
  thumbUrlFor,
  type StreamInfo,
} from "@/lib/bunnyStream";
import type { SpyAd } from "@/lib/spy";
import type { Database, Json } from "@/lib/database.types";

type Admin = SupabaseClient<Database>;

/**
 * Feed commun pré-rempli (pubs gagnantes du jour), partagé par tous et GRATUIT.
 * Le cron (service_role) le rafraîchit : scraping des niches par défaut × marchés
 * principaux, score, anti-doublon, upsert dans `feed_ads`, puis transcodage des
 * vidéos (H.264/HLS) et archivage des miniatures. Les utilisateurs le parcourent sans consommer de quota.
 */

// Niches par défaut (mot-clé FR → libellé niche).
export const FEED_NICHES: { niche: string; kw: string }[] = [
  { niche: "Montre & tech", kw: "montre" },
  { niche: "Beauté", kw: "beauté" },
  { niche: "Maison & cuisine", kw: "cuisine" },
  { niche: "Bien-être", kw: "masseur" },
  { niche: "Mode & accessoires", kw: "ceinture" },
  { niche: "Bébé & enfant", kw: "bébé" },
  { niche: "Auto & moto", kw: "voiture" },
  { niche: "Sport & plein air", kw: "sport" },
];
// Marchés principaux (francophones + FR pour le volume/reach UE).
export const FEED_MARKETS = ["CI", "SN", "GA", "FR"];

const FEED_SEARCH_CAP = 6; // nb max de scrapes Apify par run (formule « Économe »)
const FEED_SEARCH_LIMIT = 30; // pubs demandées par recherche
const FEED_SCORE_MIN = 55; // ne garde que les signaux solides
const FEED_KEEP = 60; // top N conservés dans le feed
const FEED_TTL_DAYS = 4; // purge au-delà
const SEARCH_CONCURRENCY = 3; // scrapes Apify en parallèle (~40-55 s chacun)
const COLLECT_BUDGET_MS = 150_000; // collecte : on ne lance plus de lot au-delà
const MEDIA_BUDGET_MS = 110_000; // transcodage : budget par passage

/**
 * Couples (marché, niche) d'un run, en ALTERNANT les marchés : CI, SN, GA, FR,
 * CI, SN… Avant, les marchés étaient pris l'un après l'autre et le plafond
 * coupait la liste avant la France (jamais cherchée → aucune pub UE dans le
 * feed). Les niches tournent d'un jour à l'autre pour toutes les couvrir.
 */
export function feedPairs(cap: number, day = Math.floor(Date.now() / 86_400_000)) {
  const out: { market: string; n: (typeof FEED_NICHES)[number] }[] = [];
  const total = FEED_MARKETS.length * FEED_NICHES.length;
  for (let k = 0; k < total && out.length < cap; k++) {
    const market = FEED_MARKETS[k % FEED_MARKETS.length];
    const round = Math.floor(k / FEED_MARKETS.length);
    // Décalage par marché pour ne pas chercher la même niche partout le même jour.
    const ni = (round + day + FEED_MARKETS.indexOf(market) * 3) % FEED_NICHES.length;
    out.push({ market, n: FEED_NICHES[ni] });
  }
  return out;
}

type FeedRow = Database["public"]["Tables"]["feed_ads"]["Insert"];
type Payload = SpyAd & {
  media_stream_guid?: string | null;
  media_stream_failed?: boolean;
};

function rowFor(ad: SpyAd, niche: string, now: string): FeedRow {
  return {
    ad_archive_id: ad.ad_archive_id,
    page_name: ad.page_name,
    page_id: ad.page_id,
    score: ad.score,
    score_label: ad.score_label,
    jours_actifs: ad.jours_actifs,
    reach: ad.reach,
    platforms: ad.platforms,
    country: ad.country ?? null,
    variants_count: ad.variants_count,
    niche,
    media_type: ad.media_type,
    media_cdn_url: null,
    thumbnail_cdn_url: null,
    ad_library_url: ad.ad_library_url,
    landing_domain: ad.landing_domain,
    payload: ad as unknown as Json,
    refreshed_at: now,
  };
}

/**
 * Upsert en GARDANT le travail média déjà fait (flux HLS, miniature archivée) :
 * une pub re-scrapée ne repart pas de zéro.
 */
async function upsertKeepingMedia(admin: Admin, rows: FeedRow[]): Promise<void> {
  if (rows.length === 0) return;
  const ids = rows.map((r) => r.ad_archive_id);
  const { data: prev } = await admin
    .from("feed_ads")
    .select("ad_archive_id, media_cdn_url, thumbnail_cdn_url, payload")
    .in("ad_archive_id", ids);
  const byId = new Map((prev ?? []).map((p) => [p.ad_archive_id, p]));
  const merged = rows.map((r) => {
    const old = byId.get(r.ad_archive_id);
    if (!old) return r;
    const op = (old.payload ?? {}) as unknown as Payload;
    const np = { ...(r.payload as unknown as Payload) };
    // Source d'origine : la plus récente (liens signés frais), le reste conservé.
    np.media_source_url = np.media_url && !isStreamUrl(np.media_url) ? np.media_url : op.media_source_url;
    np.media_hls_url = op.media_hls_url ?? null;
    np.media_stream_guid = op.media_stream_guid ?? null;
    np.media_stream_failed = op.media_stream_failed;
    if (old.thumbnail_cdn_url) np.thumbnail_url = old.thumbnail_cdn_url;
    return {
      ...r,
      media_cdn_url: old.media_cdn_url,
      thumbnail_cdn_url: old.thumbnail_cdn_url,
      payload: np as unknown as Json,
    };
  });
  const { error } = await admin.from("feed_ads").upsert(merged, { onConflict: "ad_archive_id" });
  if (error) console.error("[feed] upsert KO", error.message);
}

/**
 * Rafraîchit le feed commun (cron, service_role). Tient dans la durée max d'une
 * fonction : scrapes en parallèle par lots, ENREGISTREMENT APRÈS CHAQUE LOT
 * (un run coupé garde ce qu'il a trouvé), purge des pubs périmées seulement si
 * le run a ramené du neuf, puis un passage de transcodage vidéo.
 */
export async function refreshFeed(
  admin: Admin,
  opts: { cap?: number } = {},
): Promise<{ found: number; searches: number; stored: number; purged: number; media: MediaPass }> {
  const cap = opts.cap ?? FEED_SEARCH_CAP;
  const start = Date.now();
  // Plafond mensuel du système : on ne lance pas plus de recherches que le budget restant.
  const adsLeft = await systemAdsLeft();
  const pairs = feedPairs(Math.min(cap, Math.floor(adsLeft / FEED_SEARCH_LIMIT)));
  const found = new Map<string, { ad: SpyAd; niche: string }>();
  let searches = 0;
  let stored = 0;

  for (let i = 0; i < pairs.length; i += SEARCH_CONCURRENCY) {
    if (Date.now() - start > COLLECT_BUDGET_MS) break;
    const batch = pairs.slice(i, i + SEARCH_CONCURRENCY);
    searches += batch.length;
    const results = await Promise.allSettled(
      batch.map(({ market, n }) =>
        searchSpyWithCache(
          { q: n.kw, country: market, statut: "active", ancienneteMin: 20, tri: "score", limit: FEED_SEARCH_LIMIT },
          null, // userId null → aucune facturation, aucun plafond perso
        ).then((r) => ({ market, niche: n.niche, ads: r.ads })),
      ),
    );
    const fresh: FeedRow[] = [];
    const now = new Date().toISOString();
    for (const res of results) {
      if (res.status !== "fulfilled") continue;
      for (const ad of res.value.ads) {
        if (!ad.ad_archive_id || ad.score < FEED_SCORE_MIN) continue;
        const prev = found.get(ad.ad_archive_id);
        if (!prev || ad.score > prev.ad.score) {
          const entry = { ad: { ...ad, country: ad.country ?? res.value.market }, niche: res.value.niche };
          found.set(ad.ad_archive_id, entry);
          fresh.push(rowFor(entry.ad, entry.niche, now));
        }
      }
    }
    // Dédoublonne le lot (même pub trouvée sur 2 marchés) puis enregistre.
    const uniq = [...new Map(fresh.map((r) => [r.ad_archive_id, r])).values()];
    await upsertKeepingMedia(admin, uniq);
    stored += uniq.length;
  }

  // Purge : pubs non revues depuis FEED_TTL_DAYS, puis on garde le top FEED_KEEP.
  // Seulement si ce run a ramené du neuf (jamais de feed vidé par un run raté).
  let purged = 0;
  if (stored >= 10) {
    const cutoff = new Date(Date.now() - FEED_TTL_DAYS * 86_400_000).toISOString();
    const { count } = await admin.from("feed_ads").delete({ count: "exact" }).lt("refreshed_at", cutoff);
    purged += count ?? 0;
    const { data: keep } = await admin
      .from("feed_ads")
      .select("id")
      .order("score", { ascending: false })
      .order("refreshed_at", { ascending: false })
      .range(FEED_KEEP, FEED_KEEP + 500);
    if (keep && keep.length > 0) {
      const { count: c2 } = await admin
        .from("feed_ads")
        .delete({ count: "exact" })
        .in("id", keep.map((k) => k.id));
      purged += c2 ?? 0;
    }
  }

  const media = await processFeedMedia(admin, { budgetMs: Math.max(20_000, 270_000 - (Date.now() - start)) });
  return { found: found.size, searches, stored, purged, media };
}

export type MediaPass = { uploaded: number; ready: number; thumbs: number; failed: number; pending: number };

/**
 * Passage média du feed (cron) :
 *  1. vidéos déjà envoyées au transcodage → statut ; prêtes → media_cdn_url = HLS ;
 *  2. vidéos pas encore envoyées → upload vers le service de streaming
 *     (idempotent : une créative déjà transcodée n'est jamais renvoyée) ;
 *  3. miniatures → archivées sur le CDN (affichage persistant).
 * Les meilleurs scores d'abord ; s'arrête au budget, reprend au passage suivant.
 */
export async function processFeedMedia(
  admin: Admin,
  opts: { budgetMs?: number } = {},
): Promise<MediaPass> {
  const start = Date.now();
  const budget = opts.budgetMs ?? MEDIA_BUDGET_MS;
  const out: MediaPass = { uploaded: 0, ready: 0, thumbs: 0, failed: 0, pending: 0 };

  const { data: rows } = await admin
    .from("feed_ads")
    .select("id, media_type, media_cdn_url, thumbnail_cdn_url, payload")
    .order("score", { ascending: false })
    .limit(FEED_KEEP + 20);

  for (const row of rows ?? []) {
    if (Date.now() - start > budget) break;
    const p = { ...((row.payload ?? {}) as unknown as Payload) };
    const patch: Partial<FeedRow> = {};

    // Miniature persistante (image légère, sur le CDN d'archive).
    if (!row.thumbnail_cdn_url && p.thumbnail_url && mediaStorageConfigured() && !p.thumbnail_url.includes("/feed/thumb/")) {
      try {
        const t = await storeFromUrl(p.thumbnail_url, "feed/thumb");
        patch.thumbnail_cdn_url = t.cdnUrl;
        p.thumbnail_url = t.cdnUrl;
        out.thumbs++;
      } catch {
        /* lien source conservé */
      }
    }

    // Vidéo déjà prête mais sans miniature : celle du service de streaming.
    if (row.media_type === "video" && row.media_cdn_url && !row.thumbnail_cdn_url && !patch.thumbnail_cdn_url && p.media_stream_guid) {
      patch.thumbnail_cdn_url = thumbUrlFor(p.media_stream_guid);
      p.thumbnail_url = patch.thumbnail_cdn_url;
      out.thumbs++;
    }

    if (row.media_type === "video" && !row.media_cdn_url && !p.media_stream_failed && streamConfigured()) {
      const source = p.media_source_url ?? (p.media_url && !isStreamUrl(p.media_url) ? p.media_url : null);
      if (source) {
        p.media_source_url = source;
        let info: StreamInfo | null = null;
        if (p.media_stream_guid) {
          info = await streamStatus(p.media_stream_guid);
        } else {
          info = await ensureStream(source); // retrouve ou crée + upload
          if (info) out.uploaded++;
        }
        if (info) {
          p.media_stream_guid = info.guid;
          if (info.ready && info.hls) {
            patch.media_cdn_url = info.hls;
            p.media_hls_url = info.hls;
            // Miniature : celle générée par le service si l'archivage a échoué.
            if (!row.thumbnail_cdn_url && !patch.thumbnail_cdn_url && info.thumb) {
              patch.thumbnail_cdn_url = info.thumb;
              p.thumbnail_url = info.thumb;
              out.thumbs++;
            }
            out.ready++;
          } else if (info.failed) {
            p.media_stream_failed = true;
            out.failed++;
          } else {
            out.pending++;
          }
        }
      }
    }

    if (Object.keys(patch).length > 0 || JSON.stringify(p) !== JSON.stringify(row.payload)) {
      await admin
        .from("feed_ads")
        .update({ ...patch, payload: p as unknown as Json })
        .eq("id", row.id);
    }
  }
  return out;
}

// Associe un mot-clé de recherche à un libellé de niche (best-effort, pour le
// seeding depuis le cache où la niche n'est pas stockée telle quelle).
function nicheFromKeyword(q: string): string {
  const s = (q || "").toLowerCase();
  const hit = FEED_NICHES.find((n) => s.includes(n.kw));
  return hit?.niche ?? "Tendances";
}

/**
 * Remplit le feed commun À PARTIR DU CACHE de recherches existant (`spy_searches`)
 * — sans appeler Apify ni Bunny. Sert à afficher immédiatement un feed réel
 * (pré-rempli par les recherches déjà faites) en attendant le 1er run complet du
 * cron. Déduplique par ad_archive_id (meilleur score, le plus récent gagne les
 * égalités), garde le top FEED_KEEP au-dessus de FEED_SCORE_MIN.
 */
export async function seedFeedFromCache(
  admin: Admin,
): Promise<{ found: number; stored: number; scanned: number }> {
  // Recherches récentes d'abord → les créatives les plus fraîches gagnent.
  const { data: searches } = await admin
    .from("spy_searches")
    .select("filters, results, created_at")
    .order("created_at", { ascending: false })
    .limit(400);

  if (!searches || searches.length === 0) return { found: 0, stored: 0, scanned: 0 };

  const best = new Map<string, { ad: SpyAd; niche: string }>();
  for (const s of searches) {
    const ads = Array.isArray(s.results) ? (s.results as unknown as SpyAd[]) : [];
    const kw = ((s.filters as { q?: string } | null)?.q ?? "") as string;
    const niche = nicheFromKeyword(kw);
    for (const ad of ads) {
      if (!ad?.ad_archive_id || (ad.score ?? 0) < FEED_SCORE_MIN) continue;
      const prev = best.get(ad.ad_archive_id);
      if (!prev || ad.score > prev.ad.score) best.set(ad.ad_archive_id, { ad, niche });
    }
  }

  const ranked = [...best.values()].sort((a, b) => b.ad.score - a.ad.score).slice(0, FEED_KEEP);
  if (ranked.length === 0) return { found: 0, stored: 0, scanned: searches.length };

  const now = new Date().toISOString();
  const rows = ranked.map(({ ad, niche }) => ({
    ad_archive_id: ad.ad_archive_id,
    page_name: ad.page_name,
    page_id: ad.page_id,
    score: ad.score,
    score_label: ad.score_label,
    jours_actifs: ad.jours_actifs,
    reach: ad.reach,
    platforms: ad.platforms,
    country: ad.country ?? null,
    variants_count: ad.variants_count,
    niche,
    media_type: ad.media_type,
    media_cdn_url: null,
    thumbnail_cdn_url: null,
    ad_library_url: ad.ad_library_url,
    landing_domain: ad.landing_domain,
    payload: ad as unknown as Json,
    refreshed_at: now,
  }));

  await admin.from("feed_ads").upsert(rows, { onConflict: "ad_archive_id" });
  return { found: ranked.length, stored: rows.length, scanned: searches.length };
}

/** Lit le feed commun (pour affichage). Renvoie des SpyAd prêts pour la carte. */
export async function getFeed(
  admin: Admin,
  opts: { niche?: string; limit?: number } = {},
): Promise<SpyAd[]> {
  const limit = opts.limit ?? 48;
  let q = admin
    .from("feed_ads")
    .select("payload")
    .order("score", { ascending: false })
    .order("refreshed_at", { ascending: false })
    .limit(limit);
  if (opts.niche) q = q.eq("niche", opts.niche);
  const { data } = await q;
  return (data ?? [])
    .map((r) => (r as { payload: unknown }).payload as SpyAd)
    .filter((a): a is SpyAd => Boolean(a && a.ad_archive_id));
}
