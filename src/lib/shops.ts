import { isEUCountry, SPY_COUNTRIES } from "@/lib/spy";

// ============================================================================
// Catalogue boutiques (Shopify public) — appels au collecteur (Edge Function
// shop-crawl) et règles d'affichage partagées par les pages Boutiques,
// Top Trend et Analyser. Données réelles uniquement.
// ============================================================================

export type Shop = {
  id: string;
  domain: string;
  platform: string;
  status: string;
  name: string | null;
  country: string | null;
  currency: string | null;
  theme: string | null;
  product_count: number | null;
  price_min: number | null;
  price_max: number | null;
  catalog_type: string | null;
  niche: string | null;
  cod_apps: string[];
  pixels: string[];
  new_products_30d: number | null;
  discounted_count: number | null;
  ads_count: number;
  ads_active: number;
  ad_countries: string[];
  eu_reach: number | null;
  first_ad_date: string | null;
  last_crawled: string | null;
  next_crawl_at: string;
  last_error: string | null;
  niches: string[];
};

export type ShopProduct = {
  id: string;
  shop_id: string;
  handle: string;
  title: string;
  product_type: string | null;
  price: number | null;
  compare_at_price: number | null;
  image_url: string | null;
  images: string[];
  variants_count: number | null;
  available: boolean | null;
  body_excerpt: string | null;
  created_at_shop: string | null;
  published_at: string | null;
  ads_count: number;
  ads_active: number;
  first_ad_date: string | null;
  eu_reach: number | null;
  niche: string | null;
};

export const SHOP_COLS =
  "id, domain, platform, status, name, country, currency, theme, product_count, price_min, price_max, catalog_type, niche, cod_apps, pixels, new_products_30d, discounted_count, ads_count, ads_active, ad_countries, eu_reach, first_ad_date, last_crawled, next_crawl_at, last_error, niches";
export const PRODUCT_COLS =
  "id, shop_id, handle, title, product_type, price, compare_at_price, image_url, images, variants_count, available, body_excerpt, created_at_shop, published_at, ads_count, ads_active, first_ad_date, eu_reach, niche";

/** Zone d'une boutique d'après les pays où ses pubs sont diffusées. */
export function shopZone(adCountries: string[]): "europe" | "africa" | "unknown" {
  if (!adCountries?.length) return "unknown";
  return adCountries.some((c) => isEUCountry(c)) ? "europe" : "africa";
}

/** Pays d'Amérique (Nord, Centre, Sud, Caraïbes). */
export const AMERICA_CODES = [
  "US", "CA", "MX", "BR", "AR", "CO", "CL", "PE", "EC", "VE", "BO", "PY", "UY", "GT", "HN", "SV", "NI",
  "CR", "PA", "CU", "DO", "HT", "JM", "PR", "TT", "GP", "MQ", "GF",
];
/** Pays d'Afrique (liste du Spy). */
export const AFRICA_CODES = SPY_COUNTRIES.filter((c) => c.region === "africa").map((c) => c.code);

/** Pays européens (UE/EEE) pour filtrer par zone côté base. */
export const EU_CODES = [
  "FR", "BE", "LU", "DE", "AT", "NL", "IE", "DK", "SE", "FI", "IT", "ES", "PT", "GR", "PL", "CZ", "SK",
  "HU", "RO", "BG", "HR", "SI", "EE", "LV", "LT", "CY", "MT", "NO", "IS", "LI",
];

/**
 * Stade d'un produit, déduit UNIQUEMENT de ses pubs repérées :
 * - Nouveau : première pub il y a moins de 14 jours ;
 * - Evergreen : pubs actives depuis plus de 90 jours ;
 * - Scaling : au moins 5 pubs actives ;
 * - En test : 1 à 2 pubs ;
 * - Actif : le reste.
 */
export function productStage(p: { ads_active: number; ads_count: number; first_ad_date: string | null }): {
  label: string;
  tone: "accent" | "success" | "warn" | "muted";
  hint: string;
} | null {
  if (!p.ads_count) return null;
  const age = p.first_ad_date ? Math.floor((Date.now() - Date.parse(p.first_ad_date)) / 86_400_000) : null;
  if (age != null && age < 14) return { label: "Nouveau", tone: "accent", hint: "Première pub repérée il y a moins de 14 jours" };
  if (age != null && age >= 90 && p.ads_active > 0)
    return { label: "Evergreen", tone: "success", hint: `Pubs actives depuis ${age} jours` };
  if (p.ads_active >= 5) return { label: "Scaling", tone: "success", hint: `${p.ads_active} pubs actives en même temps` };
  if (p.ads_count <= 2) return { label: "En test", tone: "warn", hint: "1 à 2 pubs repérées" };
  return { label: "Actif", tone: "muted", hint: `${p.ads_count} pubs repérées` };
}

export function discountPct(price: number | null, compare: number | null): number | null {
  if (price == null || compare == null || compare <= price) return null;
  return Math.round((1 - price / compare) * 100);
}

export function formatPrice(v: number | null, currency: string | null): string {
  if (v == null) return "—";
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency || "EUR",
      maximumFractionDigits: v >= 1000 || ["XOF", "XAF", "GNF"].includes(currency ?? "") ? 0 : 2,
    }).format(v);
  } catch {
    return `${v} ${currency ?? ""}`.trim();
  }
}

/** Le thème Shopify arrive parfois échappé (« main\/v2 »). */
export function cleanTheme(t: string | null): string | null {
  return t ? t.replace(/\\\//g, "/") : null;
}

export function isStale(s: Pick<Shop, "next_crawl_at">): boolean {
  return Date.parse(s.next_crawl_at) <= Date.now();
}

/** Appel au collecteur (Edge Function). La clé publique suffit : il ne fait que des lectures publiques. */
export async function callShopCrawl(body: Record<string, unknown>, timeoutMs = 120_000): Promise<unknown> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${url}/functions/v1/shop-crawl`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
      cache: "no-store",
    });
    return await r.json().catch(() => null);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
