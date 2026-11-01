import { after, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getShop, shopProducts } from "@/lib/shopQueries";
import { callShopCrawl, isStale } from "@/lib/shops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Résumé boutique pour la page Analyser (et mise à jour si > 7 j). */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const domain = (new URL(request.url).searchParams.get("domain") ?? "").toLowerCase().replace(/^www\./, "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return NextResponse.json({ shop: null });
  const shop = await getShop(domain);
  if (!shop) return NextResponse.json({ shop: null });
  if (isStale(shop)) after(() => callShopCrawl({ mode: "domain", domain }).then(() => undefined));
  const { items } = shop.status === "ok" ? await shopProducts(shop.id, 5) : { items: [] };
  return NextResponse.json({ shop, products: items });
}
