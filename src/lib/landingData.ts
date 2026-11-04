import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { SPY_COUNTRIES } from "@/lib/spy";

/** Produit montré sur la landing (bande défilante, étapes). Domaine NON exposé. */
export type LandingProduct = {
  id: string;
  name: string; // nom raccourci (on n'expose pas la fiche complète)
  image: string;
  price: number | null;
  currency: string | null;
  country: string | null;
  niche: string | null;
  adsActive: number;
  days: number | null; // jours depuis la 1re pub repérée
  euReach: number | null; // audience UE cumulée (DSA), si connue
  cod: boolean; // boutique avec paiement à la livraison détecté
};

export type LandingData = {
  products: LandingProduct[];
  stats: { products: number; shops: number; ads30d: number; countries: number };
};

/**
 * Nom court : coupe au premier séparateur (—, -, |, :), retire ™®, garde
 * 3 mots max. Assez pour comprendre le produit, pas pour retrouver la fiche.
 */
export function shortName(title: string): string {
  const base = title.replace(/[™®©]/g, "").split(/\s[—–\-|:]\s|[|:]/)[0].trim();
  const words = base.split(/\s+/).filter(Boolean);
  const out = words.slice(0, 3).join(" ");
  return out.length > 26 ? `${out.slice(0, 25).trimEnd()}…` : out;
}

async function load(): Promise<LandingData> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [prod, prodCount, shopCount, searches] = await Promise.all([
    admin
      .from("shop_products")
      .select("id, title, image_url, price, niche, ads_active, first_ad_date, eu_reach, shops!inner(currency, ad_countries, cod_apps, niche)")
      .gt("ads_active", 0)
      .not("image_url", "is", null)
      .order("ads_active", { ascending: false })
      .limit(40),
    admin.from("shop_products").select("id", { count: "exact", head: true }),
    admin.from("shops").select("id", { count: "exact", head: true }),
    admin.from("spy_searches").select("raw_count").gte("created_at", since),
  ]);

  // Une erreur ne doit pas être mise en cache 24 h : on la propage.
  const err = prod.error ?? prodCount.error ?? shopCount.error ?? searches.error;
  if (err) throw new Error(err.message);

  // Un seul exemplaire par nom (une même boutique duplique souvent ses fiches).
  const seen = new Set<string>();
  const products: LandingProduct[] = [];
  for (const r of prod.data ?? []) {
    const s = (Array.isArray(r.shops) ? r.shops[0] : r.shops) as { currency: string | null; ad_countries: string[] | null; cod_apps: string[] | null; niche: string | null } | null;
    const name = shortName(String(r.title ?? ""));
    if (!name || !r.image_url || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    products.push({
      id: String(r.id),
      name,
      image: String(r.image_url),
      price: r.price == null ? null : Number(r.price),
      currency: s?.currency ?? null,
      country: s?.ad_countries?.[0] ?? null,
      niche: (r.niche as string | null) ?? s?.niche ?? null,
      adsActive: Number(r.ads_active) || 0,
      days: r.first_ad_date ? Math.max(0, Math.floor((Date.now() - Date.parse(String(r.first_ad_date))) / 86_400_000)) : null,
      euReach: r.eu_reach == null ? null : Number(r.eu_reach),
      cod: (s?.cod_apps?.length ?? 0) > 0,
    });
  }

  return {
    products: products.slice(0, 24),
    stats: {
      products: prodCount.count ?? 0,
      shops: shopCount.count ?? 0,
      ads30d: (searches.data ?? []).reduce((n, r) => n + (Number(r.raw_count) || 0), 0),
      countries: SPY_COUNTRIES.length, // pays où le Spy peut chercher
    },
  };
}

const cached = unstable_cache(load, ["landing-nuit-v1"], { revalidate: 86_400 });

const EMPTY: LandingData = { products: [], stats: { products: 0, shops: 0, ads30d: 0, countries: 0 } };

/** Données réelles de la landing, recalculées au plus une fois par 24 h. */
export async function getLandingData(): Promise<LandingData> {
  try {
    return await cached();
  } catch {
    return EMPTY; // base indisponible : la landing s'affiche sans les blocs de données
  }
}
