// ============================================================================
// Look360 — Spy Facebook : construction de l'URL Ad Library, normalisation de
// la sortie de l'actor Apify (curious_coder/facebook-ads-library-scraper) et
// score gagnant honnête (§4). Aucun secret ici (logique pure, réutilisable).
// ============================================================================

// --- Pays ciblables. flagEU => reach réel dispo (loi DSA). ---
export type SpyCountry = { code: string; label: string; eu: boolean };
export const SPY_COUNTRIES: SpyCountry[] = [
  // Afrique francophone (pas de reach public)
  { code: "CI", label: "Côte d'Ivoire", eu: false },
  { code: "SN", label: "Sénégal", eu: false },
  { code: "GA", label: "Gabon", eu: false },
  { code: "BF", label: "Burkina Faso", eu: false },
  { code: "ML", label: "Mali", eu: false },
  { code: "TG", label: "Togo", eu: false },
  { code: "BJ", label: "Bénin", eu: false },
  { code: "CM", label: "Cameroun", eu: false },
  // Europe / UE (reach réel dispo)
  { code: "FR", label: "France", eu: true },
  { code: "BE", label: "Belgique", eu: true },
  { code: "DE", label: "Allemagne", eu: true },
  { code: "ES", label: "Espagne", eu: true },
  { code: "IT", label: "Italie", eu: true },
  { code: "NL", label: "Pays-Bas", eu: true },
  { code: "PT", label: "Portugal", eu: true },
];

export function isEUCountry(code: string | null | undefined): boolean {
  return SPY_COUNTRIES.some((c) => c.code === code && c.eu);
}
export function countryLabel(code: string | null | undefined): string {
  return SPY_COUNTRIES.find((c) => c.code === code)?.label ?? (code ?? "—");
}

export type SpyPlatform = "" | "facebook" | "instagram";
export type SpyMediaType = "all" | "image" | "video";
export type SpyStatut = "active" | "all";

export type SpyFilters = {
  q: string;
  country: string;
  platform?: SpyPlatform;
  statut?: SpyStatut;
  mediaType?: SpyMediaType;
  ancienneteMin?: number; // jours
  reachMin?: number; // UE uniquement
  variantsMin?: number;
  tri?: "score" | "reach" | "anciennete" | "variants";
  limit?: number;
};

/**
 * Construit l'URL de recherche Facebook Ad Library à partir des filtres app.
 * C'est CETTE url qui est passée en entrée de l'actor Apify.
 */
export function buildAdLibraryUrl(f: SpyFilters): string {
  const p = new URLSearchParams();
  p.set("active_status", f.statut === "all" ? "all" : "active");
  p.set("ad_type", "all");
  p.set("country", f.country || "FR");
  if (f.q) p.set("q", f.q);
  p.set("search_type", "keyword_unordered");
  p.set("media_type", f.mediaType && f.mediaType !== "all" ? f.mediaType : "all");
  if (f.platform === "facebook") p.set("publisher_platforms[0]", "facebook");
  if (f.platform === "instagram") p.set("publisher_platforms[0]", "instagram");
  return `https://www.facebook.com/ads/library/?${p.toString()}`;
}

// --- Sortie normalisée d'une pub ---
export type SpyAd = {
  ad_archive_id: string;
  page_id: string | null;
  page_name: string | null;
  page_like_count: number | null;
  page_active_ads_count: number | null;
  ad_text: string | null;
  title: string | null;
  cta_text: string | null;
  media_type: "video" | "image" | "none";
  media_url: string | null;
  thumbnail_url: string | null;
  landing_url: string | null;
  ad_library_url: string;
  start_date: string | null; // ISO (yyyy-mm-dd)
  jours_actifs: number | null;
  variants_count: number;
  platforms: string[];
  is_active: boolean;
  statut: "active" | "inactive";
  targets_eu: boolean;
  reach: number | null; // reach total UE (DSA) — null hors UE
  country: string | null;
  score: number;
  score_label: "Fort potentiel" | "Moyen" | "Faible";
  score_detail: string[];
};

const PLATFORM_LABEL: Record<string, string> = {
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  MESSENGER: "Messenger",
  AUDIENCE_NETWORK: "Audience Network",
  THREADS: "Threads",
};

function joursDepuisTs(tsSeconds: number | null): number | null {
  if (!tsSeconds) return null;
  const j = Math.floor((Date.now() - tsSeconds * 1000) / 86_400_000);
  return j >= 0 ? j : 0;
}

function bodyText(body: unknown): string | null {
  if (!body) return null;
  if (typeof body === "string") return body;
  if (typeof body === "object" && "text" in (body as Record<string, unknown>)) {
    const t = (body as { text?: unknown }).text;
    return typeof t === "string" ? t : null;
  }
  return null;
}

/** raw = un item du dataset Apify. country = pays recherché (fallback). */
export function normalizeApifyItem(raw: Record<string, unknown>, country: string): SpyAd {
  const snap = (raw.snapshot ?? {}) as Record<string, unknown>;
  const aaa = (raw.aaa_info ?? {}) as Record<string, unknown>;
  const euT = (((raw.transparency_by_location ?? {}) as Record<string, unknown>)
    .eu_transparency ?? {}) as Record<string, unknown>;

  const images = (snap.images ?? []) as Record<string, unknown>[];
  const videos = (snap.videos ?? []) as Record<string, unknown>[];
  const video0 = videos[0] ?? null;
  const image0 = images[0] ?? null;

  const media_type: SpyAd["media_type"] = video0 ? "video" : image0 ? "image" : "none";
  const media_url =
    (video0?.video_hd_url as string) ||
    (video0?.video_sd_url as string) ||
    (image0?.original_image_url as string) ||
    (image0?.resized_image_url as string) ||
    null;
  const thumbnail_url =
    (video0?.video_preview_image_url as string) ||
    (image0?.resized_image_url as string) ||
    (image0?.original_image_url as string) ||
    (snap.page_profile_picture_url as string) ||
    null;

  const startTs = typeof raw.start_date === "number" ? (raw.start_date as number) : null;
  const jours_actifs = joursDepuisTs(startTs);
  const start_date = startTs ? new Date(startTs * 1000).toISOString().slice(0, 10) : null;

  const variants_count = Number(raw.collation_count ?? 0) || 1;
  const is_active = raw.is_active === true;
  const targets_eu = aaa.targets_eu === true || euT.targets_eu === true;

  const reachRaw =
    (typeof aaa.eu_total_reach === "number" ? (aaa.eu_total_reach as number) : null) ??
    (typeof euT.eu_total_reach === "number" ? (euT.eu_total_reach as number) : null) ??
    (typeof raw.reach_estimate === "number" ? (raw.reach_estimate as number) : null);
  const reach = targets_eu ? reachRaw : null;

  const platforms = ((raw.publisher_platform ?? []) as string[]).map(
    (p) => PLATFORM_LABEL[p] ?? p,
  );

  const page_active_ads_count =
    typeof raw.ads_count === "number" ? (raw.ads_count as number) : null;

  const adId = String(raw.ad_archive_id ?? raw.ad_id ?? "");
  const ad_library_url =
    (raw.ad_library_url as string) ||
    `https://www.facebook.com/ads/library/?id=${adId}`;

  const partial = {
    jours_actifs,
    variants_count,
    is_active,
    targets_eu,
    reach,
    page_active_ads_count,
  };
  const { score, score_label, score_detail } = computeSpyScore(partial);

  return {
    ad_archive_id: adId,
    page_id: (raw.page_id as string) ?? null,
    page_name: (raw.page_name as string) ?? (snap.page_name as string) ?? null,
    page_like_count:
      typeof snap.page_like_count === "number" ? (snap.page_like_count as number) : null,
    page_active_ads_count,
    ad_text: bodyText(snap.body),
    title: (snap.title as string) ?? null,
    cta_text: (snap.cta_text as string) ?? null,
    media_type,
    media_url,
    thumbnail_url,
    landing_url: (snap.link_url as string) ?? null,
    ad_library_url,
    start_date,
    jours_actifs,
    variants_count,
    platforms,
    is_active,
    statut: is_active ? "active" : "inactive",
    targets_eu,
    reach,
    country: (snap.country_iso_code as string) ?? country ?? null,
    score,
    score_label,
    score_detail,
  };
}

// --- Score gagnant honnête (§4) : deux profils selon dispo du reach UE. ---
export function computeSpyScore(a: {
  jours_actifs: number | null;
  variants_count: number;
  is_active: boolean;
  targets_eu: boolean;
  reach: number | null;
  page_active_ads_count: number | null;
}): { score: number; score_label: SpyAd["score_label"]; score_detail: string[] } {
  const detail: string[] = [];
  const jours = a.jours_actifs ?? 0;
  const anc = Math.min(1, jours / 90); // 90 j et + = plein
  const varRatio = Math.min(1, Math.max(0, (a.variants_count - 1) / 9)); // 10+ = plein
  const act = a.is_active ? 1 : 0;
  const hasReach = a.targets_eu && a.reach != null;

  let score = 0;
  if (hasReach) {
    // Profil UE : ancienneté 40 · reach 35 · variantes 15 · activité 10
    const reachRatio = Math.min(1, (a.reach as number) / 1_000_000); // 1M = plein
    score = 40 * anc + 35 * reachRatio + 15 * varRatio + 10 * act;
    detail.push(`Tourne depuis ${jours} j (+${Math.round(40 * anc)})`);
    detail.push(`Reach UE ${formatReach(a.reach)} (+${Math.round(35 * reachRatio)})`);
    detail.push(`${a.variants_count} variante${a.variants_count > 1 ? "s" : ""} (+${Math.round(15 * varRatio)})`);
    detail.push(a.is_active ? "Toujours active (+10)" : "Inactive (+0)");
  } else {
    // Profil Afrique/autres : ancienneté 55 · variantes 30 · activité 15
    score = 55 * anc + 30 * varRatio + 15 * act;
    detail.push(`Tourne depuis ${jours} j (+${Math.round(55 * anc)})`);
    detail.push(`${a.variants_count} variante${a.variants_count > 1 ? "s" : ""} (+${Math.round(30 * varRatio)})`);
    detail.push(a.is_active ? "Toujours active (+15)" : "Inactive (+0)");
  }

  const rounded = Math.round(Math.max(0, Math.min(100, score)));
  const label: SpyAd["score_label"] =
    rounded >= 70 ? "Fort potentiel" : rounded >= 40 ? "Moyen" : "Faible";
  return { score: rounded, score_label: label, score_detail: detail };
}

export function formatReach(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(".0", "")}M`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}k`;
  return String(v);
}

/** Filtres numériques + tri appliqués côté serveur après normalisation (§3). */
export function applySpyFilters(ads: SpyAd[], f: SpyFilters): SpyAd[] {
  let out = ads.filter((ad) => {
    if (f.statut !== "all" && !ad.is_active) return false;
    if (f.ancienneteMin && (ad.jours_actifs ?? 0) < f.ancienneteMin) return false;
    if (f.variantsMin && ad.variants_count < f.variantsMin) return false;
    if (f.mediaType && f.mediaType !== "all" && ad.media_type !== f.mediaType) return false;
    // Reach mini : seulement si le pays ciblé est dans l'UE (reach dispo).
    if (f.reachMin && isEUCountry(f.country)) {
      if (ad.reach == null || ad.reach < f.reachMin) return false;
    }
    return true;
  });

  const tri = f.tri ?? "score";
  out = [...out].sort((x, y) => {
    if (tri === "reach") return (y.reach ?? 0) - (x.reach ?? 0);
    if (tri === "anciennete") return (y.jours_actifs ?? 0) - (x.jours_actifs ?? 0);
    if (tri === "variants") return y.variants_count - x.variants_count;
    return y.score - x.score;
  });
  return out;
}
