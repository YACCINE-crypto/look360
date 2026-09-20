// ============================================================================
// Look360 — Spy Facebook : URL Ad Library, normalisation actor Apify
// (curious_coder/facebook-ads-library-scraper), score gagnant honnête (§4).
// Aucun secret ici (logique pure).
// ============================================================================

/** Plafond de concurrents suivis (garde-fou coût Apify). */
export const MAX_COMPETITORS = 20;

/** Winner Agent : nb max de recherches Apify par exécution du cron (coût). */
export const WINNER_SEARCH_CAP = 5;
/** Valeurs par défaut raisonnables de la config Winner Agent. */
export const WINNER_DEFAULTS = {
  keywords: ["montre", "ceinture", "masseur"],
  countries: ["CI", "FR"],
  anciennete_min: 30,
  reach_min: 0,
  score_min: 60,
  results_max: 10,
};

export type SpyRegion = "africa" | "europe" | "other";
export type SpyCountry = { code: string; label: string; eu: boolean; region: SpyRegion };

export const SPY_REGION_LABELS: Record<SpyRegion, string> = {
  africa: "Afrique",
  europe: "Europe",
  other: "Autres",
};

// eu:true => reach réel dispo (DSA, UE + EEE).
const EU_EEA = new Set([
  "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT",
  "LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE","IS","LI","NO",
]);

function mk(region: SpyRegion, pairs: [string, string][]): SpyCountry[] {
  return pairs.map(([code, label]) => ({ code, label, region, eu: EU_EEA.has(code) }));
}

// --- Afrique (couverture large de la Ad Library) ---
const AFRICA: [string, string][] = [
  ["DZ", "Algérie"], ["AO", "Angola"], ["BJ", "Bénin"], ["BW", "Botswana"],
  ["BF", "Burkina Faso"], ["BI", "Burundi"], ["CM", "Cameroun"], ["CV", "Cap-Vert"],
  ["CF", "Centrafrique"], ["TD", "Tchad"], ["KM", "Comores"], ["CG", "Congo"],
  ["CD", "RD Congo"], ["CI", "Côte d'Ivoire"], ["DJ", "Djibouti"], ["EG", "Égypte"],
  ["GQ", "Guinée équatoriale"], ["ER", "Érythrée"], ["SZ", "Eswatini"], ["ET", "Éthiopie"],
  ["GA", "Gabon"], ["GM", "Gambie"], ["GH", "Ghana"], ["GN", "Guinée"],
  ["GW", "Guinée-Bissau"], ["KE", "Kenya"], ["LS", "Lesotho"], ["LR", "Libéria"],
  ["LY", "Libye"], ["MG", "Madagascar"], ["MW", "Malawi"], ["ML", "Mali"],
  ["MR", "Mauritanie"], ["MU", "Maurice"], ["MA", "Maroc"], ["MZ", "Mozambique"],
  ["NA", "Namibie"], ["NE", "Niger"], ["NG", "Nigéria"], ["RW", "Rwanda"],
  ["ST", "Sao Tomé-et-Príncipe"], ["SN", "Sénégal"], ["SC", "Seychelles"], ["SL", "Sierra Leone"],
  ["SO", "Somalie"], ["ZA", "Afrique du Sud"], ["SS", "Soudan du Sud"], ["SD", "Soudan"],
  ["TZ", "Tanzanie"], ["TG", "Togo"], ["TN", "Tunisie"], ["UG", "Ouganda"],
  ["ZM", "Zambie"], ["ZW", "Zimbabwe"],
];

// --- Europe ---
const EUROPE: [string, string][] = [
  ["AL", "Albanie"], ["AD", "Andorre"], ["AT", "Autriche"], ["BE", "Belgique"],
  ["BA", "Bosnie-Herzégovine"], ["BG", "Bulgarie"], ["HR", "Croatie"], ["CY", "Chypre"],
  ["CZ", "Tchéquie"], ["DK", "Danemark"], ["EE", "Estonie"], ["FI", "Finlande"],
  ["FR", "France"], ["DE", "Allemagne"], ["GR", "Grèce"], ["HU", "Hongrie"],
  ["IS", "Islande"], ["IE", "Irlande"], ["IT", "Italie"], ["LV", "Lettonie"],
  ["LI", "Liechtenstein"], ["LT", "Lituanie"], ["LU", "Luxembourg"], ["MT", "Malte"],
  ["MD", "Moldavie"], ["MC", "Monaco"], ["ME", "Monténégro"], ["NL", "Pays-Bas"],
  ["MK", "Macédoine du Nord"], ["NO", "Norvège"], ["PL", "Pologne"], ["PT", "Portugal"],
  ["RO", "Roumanie"], ["RS", "Serbie"], ["SK", "Slovaquie"], ["SI", "Slovénie"],
  ["ES", "Espagne"], ["SE", "Suède"], ["CH", "Suisse"], ["UA", "Ukraine"],
  ["GB", "Royaume-Uni"],
];

// --- Autres marchés utiles ---
const OTHER: [string, string][] = [
  ["US", "États-Unis"], ["CA", "Canada"], ["AU", "Australie"], ["NZ", "Nouvelle-Zélande"],
  ["BR", "Brésil"], ["MX", "Mexique"], ["AR", "Argentine"], ["AE", "Émirats arabes unis"],
  ["SA", "Arabie saoudite"], ["QA", "Qatar"], ["TR", "Turquie"], ["IN", "Inde"],
  ["ID", "Indonésie"], ["MY", "Malaisie"], ["PH", "Philippines"], ["TH", "Thaïlande"],
  ["VN", "Viêt Nam"], ["JP", "Japon"], ["KR", "Corée du Sud"],
];

export const SPY_COUNTRIES: SpyCountry[] = [
  ...mk("africa", AFRICA),
  ...mk("europe", EUROPE),
  ...mk("other", OTHER),
];

export function isEUCountry(code: string | null | undefined): boolean {
  return !!code && EU_EEA.has(code);
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
  pageId?: string; // recherche "annonceur" (view_all_page_id) — prime sur q
  platform?: SpyPlatform;
  statut?: SpyStatut;
  mediaType?: SpyMediaType;
  ancienneteMin?: number;
  reachMin?: number;
  variantsMin?: number;
  tri?: "score" | "reach" | "anciennete" | "variants";
  limit?: number;
};

/** URL de recherche Facebook Ad Library (entrée de l'actor). */
export function buildAdLibraryUrl(f: SpyFilters): string {
  const p = new URLSearchParams();
  p.set("active_status", f.statut === "all" ? "all" : "active");
  p.set("ad_type", "all");
  p.set("country", f.country || "FR");
  if (f.pageId) {
    // Toutes les pubs d'une page (annonceur).
    p.set("view_all_page_id", f.pageId);
  } else {
    if (f.q) p.set("q", f.q);
    p.set("search_type", "keyword_unordered");
  }
  p.set("media_type", f.mediaType && f.mediaType !== "all" ? f.mediaType : "all");
  if (f.platform === "facebook") p.set("publisher_platforms[0]", "facebook");
  if (f.platform === "instagram") p.set("publisher_platforms[0]", "instagram");
  return `https://www.facebook.com/ads/library/?${p.toString()}`;
}

// --- Destination du landing (§ lien boutique intelligent) ---
export type LandingKind = "whatsapp" | "messenger" | "shop" | "social" | null;

export function domainOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function landingKind(url: string | null | undefined): LandingKind {
  const h = domainOf(url);
  if (!h) return null;
  if (h === "wa.me" || h.endsWith("whatsapp.com")) return "whatsapp";
  if (h === "m.me" || h.endsWith("messenger.com")) return "messenger";
  if (h.endsWith("facebook.com") || h === "fb.com" || h.endsWith("instagram.com"))
    return "social";
  return "shop";
}

export const LANDING_LABEL: Record<Exclude<LandingKind, null>, string> = {
  whatsapp: "Contact WhatsApp",
  messenger: "Messenger",
  social: "Page sociale",
  shop: "Boutique",
};

// --- Sortie normalisée ---
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
  landing_kind: LandingKind;
  landing_domain: string | null;
  ad_library_url: string;
  start_date: string | null;
  jours_actifs: number | null;
  variants_count: number;
  platforms: string[];
  is_active: boolean;
  statut: "active" | "inactive";
  targets_eu: boolean;
  reach: number | null;
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
  const landing_url = (snap.link_url as string) ?? null;

  const { score, score_label, score_detail } = computeSpyScore({
    jours_actifs,
    variants_count,
    is_active,
    targets_eu,
    reach,
    page_active_ads_count,
  });

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
    landing_url,
    landing_kind: landingKind(landing_url),
    landing_domain: domainOf(landing_url),
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
  const anc = Math.min(1, jours / 90);
  const varRatio = Math.min(1, Math.max(0, (a.variants_count - 1) / 9));
  const act = a.is_active ? 1 : 0;
  const hasReach = a.targets_eu && a.reach != null;

  let score = 0;
  if (hasReach) {
    const reachRatio = Math.min(1, (a.reach as number) / 1_000_000);
    score = 40 * anc + 35 * reachRatio + 15 * varRatio + 10 * act;
    detail.push(`Tourne depuis ${jours} j (+${Math.round(40 * anc)})`);
    detail.push(`Reach UE ${formatReach(a.reach)} (+${Math.round(35 * reachRatio)})`);
    detail.push(`${a.variants_count} variante${a.variants_count > 1 ? "s" : ""} (+${Math.round(15 * varRatio)})`);
    detail.push(a.is_active ? "Toujours active (+10)" : "Inactive (+0)");
  } else {
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

/** Histogramme d'activité pub par mois (à partir des start_date). */
export function activityByMonth(
  ads: { start_date: string | null }[],
  months = 12,
): { key: string; label: string; value: number }[] {
  const now = new Date();
  const buckets: { key: string; label: string; value: number }[] = [];
  const idx = new Map<string, number>();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    idx.set(key, buckets.length);
    buckets.push({ key, label: d.toLocaleDateString("fr-FR", { month: "short" }), value: 0 });
  }
  for (const a of ads) {
    if (!a.start_date) continue;
    const j = idx.get(a.start_date.slice(0, 7));
    if (j !== undefined) buckets[j].value++;
  }
  return buckets;
}

export function formatReach(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(".0", "")}M`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}k`;
  return String(v);
}

export function applySpyFilters(ads: SpyAd[], f: SpyFilters): SpyAd[] {
  let out = ads.filter((ad) => {
    if (f.statut !== "all" && !ad.is_active) return false;
    if (f.ancienneteMin && (ad.jours_actifs ?? 0) < f.ancienneteMin) return false;
    if (f.variantsMin && ad.variants_count < f.variantsMin) return false;
    if (f.mediaType && f.mediaType !== "all" && ad.media_type !== f.mediaType) return false;
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
