import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { searchSpyWithCache } from "@/lib/spyCache";
import { storeFromUrl, mediaStorageConfigured } from "@/lib/mediaStorage";
import type { SpyAd } from "@/lib/spy";
import type { Database, Json } from "@/lib/database.types";

type Admin = SupabaseClient<Database>;

/**
 * Feed commun pré-rempli (pubs gagnantes du jour), partagé par tous et GRATUIT.
 * Le cron (service_role) le rafraîchit : scraping des niches par défaut × marchés
 * principaux, score, anti-doublon, archivage des créatives sur Bunny, puis
 * upsert dans `feed_ads`. Les utilisateurs le parcourent sans consommer de quota.
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

const FEED_SEARCH_CAP = 24; // nb max de scrapes Apify par run (coût maîtrisé)
const FEED_SCORE_MIN = 55; // ne garde que les signaux solides
const FEED_KEEP = 60; // top N conservés dans le feed
const FEED_TTL_DAYS = 4; // purge au-delà
const RUN_BUDGET_MS = 50_000; // garde-fou temps total
const ARCHIVE_VIDEO_TOP = 12; // nb de vidéos archivées en entier (le reste : source)

/** Rafraîchit le feed commun. À appeler via le cron (service_role). */
export async function refreshFeed(
  admin: Admin,
  opts: { cap?: number } = {},
): Promise<{ found: number; searches: number; stored: number }> {
  const cap = opts.cap ?? FEED_SEARCH_CAP;
  const start = Date.now();
  let searches = 0;
  const found = new Map<string, { ad: SpyAd; niche: string }>();

  outer: for (const market of FEED_MARKETS) {
    for (const n of FEED_NICHES) {
      if (searches >= cap || Date.now() - start > RUN_BUDGET_MS) break outer;
      searches++;
      try {
        const { ads } = await searchSpyWithCache(
          { q: n.kw, country: market, statut: "active", ancienneteMin: 20, tri: "score", limit: 40 },
          null, // userId null → aucune facturation, aucun plafond perso
        );
        for (const ad of ads) {
          if (!ad.ad_archive_id || ad.score < FEED_SCORE_MIN) continue;
          const prev = found.get(ad.ad_archive_id);
          if (!prev || ad.score > prev.ad.score) {
            found.set(ad.ad_archive_id, {
              ad: { ...ad, country: ad.country ?? market },
              niche: n.niche,
            });
          }
        }
      } catch {
        /* skip ce couple niche×marché */
      }
    }
  }

  const ranked = [...found.values()]
    .sort((a, b) => b.ad.score - a.ad.score)
    .slice(0, FEED_KEEP);
  if (ranked.length === 0) return { found: 0, searches, stored: 0 };

  const now = new Date().toISOString();
  const canArchive = mediaStorageConfigured();
  let videosArchived = 0;

  const rows = [];
  for (const { ad, niche } of ranked) {
    const payload = { ...ad } as SpyAd;
    let thumbnailCdn: string | null = null;
    let mediaCdn: string | null = null;

    if (canArchive) {
      // Miniature (image) → archivage systématique (léger, affichage persistant).
      if (ad.thumbnail_url) {
        try {
          const s = await storeFromUrl(ad.thumbnail_url, "feed/thumb");
          thumbnailCdn = s.cdnUrl;
          payload.thumbnail_url = s.cdnUrl;
        } catch {
          /* garde la source */
        }
      }
      // Vidéo → archivage complet pour le top (budget temps), source sinon.
      if (
        ad.media_type === "video" &&
        ad.media_url &&
        videosArchived < ARCHIVE_VIDEO_TOP &&
        Date.now() - start < RUN_BUDGET_MS
      ) {
        try {
          const s = await storeFromUrl(ad.media_url, "feed/media");
          mediaCdn = s.cdnUrl;
          payload.media_url = s.cdnUrl;
          videosArchived++;
        } catch {
          /* garde la source (le lecteur transcode à la volée) */
        }
      }
    }

    rows.push({
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
      media_cdn_url: mediaCdn,
      thumbnail_cdn_url: thumbnailCdn,
      ad_library_url: ad.ad_library_url,
      landing_domain: ad.landing_domain,
      payload: payload as unknown as Json,
      refreshed_at: now,
    });
  }

  await admin.from("feed_ads").upsert(rows, { onConflict: "ad_archive_id" });

  // Purge des entrées trop anciennes (feed = le plus frais).
  const cutoff = new Date(Date.now() - FEED_TTL_DAYS * 86_400_000).toISOString();
  await admin.from("feed_ads").delete().lt("refreshed_at", cutoff);

  return { found: ranked.length, searches, stored: rows.length };
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
