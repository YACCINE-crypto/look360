import "server-only";
import { createClient } from "@/lib/supabase/server";
import { AFRICA_CODES, AMERICA_CODES, EU_CODES, PRODUCT_COLS, SHOP_COLS, type Shop, type ShopProduct } from "@/lib/shops";

export type Zone = "all" | "africa" | "europe" | "america";
export const ZONE_CODES: Record<Exclude<Zone, "all">, string[]> = { africa: AFRICA_CODES, europe: EU_CODES, america: AMERICA_CODES };
export type ProductSort = "pubs" | "recent" | "promo";
export type ShopSort = "pubs" | "produits" | "cod";
export type ProductWithShop = ShopProduct & {
  shops: Pick<Shop, "domain" | "name" | "currency" | "ad_countries" | "status">;
};

const like = (q: string) => `%${q.replace(/[%_,()]/g, " ").trim()}%`;

/** Produits du catalogue public, joints à leur boutique. */
export async function listProducts(o: {
  zone: Zone;
  q?: string;
  sort: ProductSort;
  withAds: boolean;
  limit: number;
  offset?: number;
  /** Minimum de pubs actives (sélection « meilleurs »). */
  minActive?: number;
  niche?: string;
}): Promise<{ items: ProductWithShop[]; total: number }> {
  const supabase = await createClient();
  let query = supabase
    .from("shop_products")
    .select(`${PRODUCT_COLS}, shops!inner(domain, name, currency, ad_countries, status)`, { count: "exact" })
    .eq("shops.status", "ok");
  if (o.zone !== "all") query = query.overlaps("shops.ad_countries", ZONE_CODES[o.zone]);
  if (o.q) query = query.ilike("title", like(o.q));
  if (o.withAds) query = query.gt("ads_count", 0);
  if (o.minActive) query = query.gte("ads_active", o.minActive);
  if (o.niche) query = query.contains("shops.niches", [o.niche]);
  if (o.sort === "promo") query = query.not("compare_at_price", "is", null);
  query =
    o.sort === "recent"
      ? query.order("created_at_shop", { ascending: false, nullsFirst: false })
      : query.order("ads_active", { ascending: false }).order("ads_count", { ascending: false }).order("position");
  const from = o.offset ?? 0;
  const { data, count } = await query.range(from, from + o.limit - 1);
  return { items: (data ?? []) as unknown as ProductWithShop[], total: count ?? 0 };
}

/** Boutiques Shopify lisibles + 3 miniatures produit chacune. */
export async function listShops(o: {
  zone: Zone;
  q?: string;
  sort: ShopSort;
  limit: number;
  offset?: number;
  minActive?: number;
  niche?: string;
}): Promise<{ shops: Shop[]; total: number; thumbs: Map<string, string[]> }> {
  const supabase = await createClient();
  let query = supabase.from("shops").select(SHOP_COLS, { count: "exact" }).eq("status", "ok");
  if (o.zone !== "all") query = query.overlaps("ad_countries", ZONE_CODES[o.zone]);
  if (o.q) query = query.or(`domain.ilike.${like(o.q)},name.ilike.${like(o.q)}`);
  if (o.sort === "cod") query = query.not("cod_apps", "eq", "{}");
  if (o.minActive) query = query.gte("ads_active", o.minActive);
  if (o.niche) query = query.contains("niches", [o.niche]);
  query =
    o.sort === "produits"
      ? query.order("product_count", { ascending: false, nullsFirst: false })
      : query.order("ads_active", { ascending: false }).order("ads_count", { ascending: false });
  const from = o.offset ?? 0;
  const { data, count } = await query.range(from, from + o.limit - 1);
  const shops = (data ?? []) as unknown as Shop[];
  return { shops, total: count ?? 0, thumbs: await shopThumbs(shops.map((s) => s.id)) };
}

/** Jusqu'à 3 images par boutique (produits avec pubs d'abord). */
export async function shopThumbs(ids: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (ids.length === 0) return map;
  const supabase = await createClient();
  const { data } = await supabase
    .from("shop_products")
    .select("shop_id, image_url")
    .in("shop_id", ids)
    .not("image_url", "is", null)
    .order("ads_count", { ascending: false })
    .order("position")
    .limit(ids.length * 8);
  for (const r of data ?? []) {
    const list = map.get(r.shop_id) ?? [];
    if (list.length < 3 && r.image_url) list.push(r.image_url);
    map.set(r.shop_id, list);
  }
  return map;
}

/** Boutique par domaine (null si inconnue). */
export async function getShop(domain: string): Promise<Shop | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("shops").select(SHOP_COLS).eq("domain", domain.toLowerCase()).maybeSingle();
  return (data as unknown as Shop) ?? null;
}

/** Produits d'une boutique (ceux avec pubs d'abord). */
export async function shopProducts(shopId: string, limit: number): Promise<{ items: ShopProduct[]; total: number }> {
  const supabase = await createClient();
  const { data, count } = await supabase
    .from("shop_products")
    .select(PRODUCT_COLS, { count: "exact" })
    .eq("shop_id", shopId)
    .order("ads_count", { ascending: false })
    .order("position")
    .limit(limit);
  return { items: (data ?? []) as unknown as ShopProduct[], total: count ?? 0 };
}

/** Pubs repérées vers une boutique (ou un produit précis). */
export async function shopAds(domain: string, handle: string | null, limit: number) {
  const supabase = await createClient();
  let q = supabase
    .from("shop_ad_links")
    .select("payload, is_active, start_date", { count: "exact" })
    .eq("domain", domain.toLowerCase());
  if (handle) q = q.eq("handle", handle.toLowerCase());
  const { data, count } = await q
    .order("is_active", { ascending: false })
    .order("start_date", { ascending: true, nullsFirst: false })
    .limit(limit);
  return { ads: (data ?? []).map((r) => r.payload as unknown as import("@/lib/spy").SpyAd), total: count ?? 0 };
}

/** Niches présentes dans le catalogue (pour les filtres), les plus fréquentes d'abord. */
export async function listNiches(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("shops").select("niches").eq("status", "ok").not("niches", "eq", "{}").limit(2000);
  const count = new Map<string, number>();
  for (const r of data ?? []) for (const n of (r.niches as string[]) ?? []) count.set(n, (count.get(n) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
}
