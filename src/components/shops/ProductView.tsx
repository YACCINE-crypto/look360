import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { CountryFlag } from "@/components/dataviz";
import { AdGrid } from "@/components/AdGrid";
import { ShopProductCard, StageBadge, UnlockMore } from "@/components/shops/ShopCards";
import { createClient } from "@/lib/supabase/server";
import { currentAccess } from "@/lib/access";
import { getShop, shopAds, shopProducts } from "@/lib/shopQueries";
import { discountPct, formatPrice, PRODUCT_COLS, type ShopProduct } from "@/lib/shops";
import { countryLabel, formatReach } from "@/lib/spy";
import { estimateSpend, formatSpendRange, SPEND_METHOD } from "@/lib/spendEstimate";


const nf = new Intl.NumberFormat("fr-FR");
function daysSince(d: string | null): number | null {
  return d ? Math.floor((Date.now() - Date.parse(d)) / 86_400_000) : null;
}
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "—";

/** Fiche produit, ouverte depuis Boutiques & produits ou depuis Top Trend (`base`). */
export async function ProductView({ domain: rawD, handle: rawH, base }: { domain: string; handle: string; base: string }) {
  const domain = decodeURIComponent(rawD).toLowerCase();
  const handle = decodeURIComponent(rawH).toLowerCase();
  const shop = await getShop(domain);
  if (!shop) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("shop_products").select(PRODUCT_COLS).eq("shop_id", shop.id).eq("handle", handle).maybeSingle();
  const p = data as unknown as ShopProduct | null;
  if (!p) notFound();

  const { paid } = await currentAccess();
  const [ads, others] = await Promise.all([shopAds(domain, handle, paid ? 60 : 0), shopProducts(shop.id, 7)]);
  const disc = discountPct(p.price, p.compare_at_price);
  const days = daysSince(p.first_ad_date);

  // Pages Facebook qui font tourner le produit + pays (données réelles des pubs).
  const pages = new Map<string, { name: string; n: number; pageId: string | null; country: string | null }>();
  const countries = new Map<string, number>();
  let est = { low: 0, high: 0, n: 0 };
  for (const a of ads.ads) {
    const key = a.page_id ?? a.page_name ?? "?";
    const cur = pages.get(key) ?? { name: a.page_name ?? "Page inconnue", n: 0, pageId: a.page_id, country: a.country };
    cur.n++;
    pages.set(key, cur);
    if (a.country) countries.set(a.country, (countries.get(a.country) ?? 0) + 1);
    const e = a.spend ? null : estimateSpend(a.reach, a.country);
    if (e) est = { low: est.low + e.low, high: est.high + e.high, n: est.n + 1 };
  }
  const shopLite = { domain: shop.domain, currency: shop.currency, name: shop.name, ad_countries: shop.ad_countries };

  return (
    <div className="space-y-4">
      {/* En-tête produit */}
      <div className="border-border bg-surface shadow-card rounded-xl border">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href={`${base}/${encodeURIComponent(domain)}`}
              aria-label="Retour à la boutique"
              className="text-muted-foreground hover:bg-input hover:text-fg grid h-9 w-9 shrink-0 place-items-center rounded-md"
            >
              <Icon name="chevronRight" size={16} className="rotate-180" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-xl font-bold tracking-tight">{p.title}</h1>
                <StageBadge p={p} />
              </div>
              <Link href={`${base}/${encodeURIComponent(domain)}`} className="text-muted-foreground hover:text-accent truncate text-sm">
                {shop.name || shop.domain}
              </Link>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <a
              href={`https://${shop.domain}/products/${encodeURIComponent(p.handle)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-accent text-accent-on hover:bg-accent-hover inline-flex min-h-10 items-center gap-1.5 rounded-md px-4 text-sm font-semibold transition-colors"
            >
              <Icon name="external" size={15} /> Voir le produit
            </a>
          </div>
        </div>
        <div className="border-border-soft text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t px-4 py-2.5 text-xs">
          <span>{shop.domain}</span>
          {p.product_type && <span>{p.product_type}</span>}
          {p.published_at && <span>En ligne depuis le {fmtDate(p.published_at)}</span>}
          {p.variants_count != null && <span>{p.variants_count} variante{p.variants_count > 1 ? "s" : ""}</span>}
          {p.available === false && <span className="text-danger-fg font-semibold">En rupture</span>}
          {shop.cod_apps.length > 0 && <span className="bg-success-bg text-success-fg rounded-full px-2 py-0.5 font-semibold">COD</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* Images */}
        <Card className="overflow-hidden">
          <div className="bg-input aspect-square">
            {p.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image_url.replace(/width=\d+/, "width=900")} alt={p.title} className="h-full w-full object-cover" />
            ) : (
              <span className="text-muted-foreground grid h-full place-items-center text-sm">Image indisponible</span>
            )}
          </div>
          {p.images.length > 1 && (
            <div className="grid grid-cols-5 gap-1 p-2">
              {p.images.slice(1, 6).map((src) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={src} src={src.replace(/width=\d+/, "width=200")} alt="" loading="lazy" className="aspect-square rounded-md object-cover" />
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-4">
          {/* Prix + chiffres clés */}
          <Card className="p-5">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-3xl font-bold tabular-nums">{formatPrice(p.price, shop.currency)}</span>
              {disc != null && (
                <>
                  <span className="text-muted-foreground tabular-nums line-through">{formatPrice(p.compare_at_price, shop.currency)}</span>
                  <span className="bg-danger-bg text-danger-fg rounded-full px-2 py-0.5 text-sm font-bold">−{disc} %</span>
                </>
              )}
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Pubs actives" value={p.ads_count ? nf.format(p.ads_active) : "—"} hint={p.ads_count ? `${nf.format(p.ads_count)} repérées` : "aucune pub repérée"} accent />
              <Stat label="Première pub" value={days != null ? `${days} j` : "—"} hint={p.first_ad_date ? fmtDate(p.first_ad_date) : undefined} />
              <Stat label="Audience UE" value={p.eu_reach ? formatReach(p.eu_reach) : "—"} hint={p.eu_reach ? "Meta, transparence UE" : "publiée seulement pour l'UE"} />
              <Stat
                label="Dépense estimée"
                value={est.n > 0 ? formatSpendRange({ low: est.low, high: est.high, currency: "EUR", cpm: [0, 0] }) : "—"}
                hint={est.n > 0 ? "estimation" : "pas de base de calcul"}
                title={SPEND_METHOD}
              />
            </dl>
          </Card>

          {/* Pages + pays */}
          {paid && pages.size > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Card className="p-5">
                <h2 className="mb-3 text-sm font-semibold">Pages qui font tourner ce produit</h2>
                <ul className="space-y-2 text-sm">
                  {[...pages.values()]
                    .sort((a, b) => b.n - a.n)
                    .slice(0, 6)
                    .map((pg) => (
                      <li key={pg.name} className="flex items-center justify-between gap-2">
                        {pg.pageId ? (
                          <Link
                            href={`/analyse/${pg.pageId}?country=${encodeURIComponent(pg.country ?? "FR")}&name=${encodeURIComponent(pg.name)}`}
                            className="hover:text-accent truncate font-medium"
                          >
                            {pg.name}
                          </Link>
                        ) : (
                          <span className="truncate font-medium">{pg.name}</span>
                        )}
                        <span className="text-muted-foreground shrink-0 tabular-nums">{pg.n} pub{pg.n > 1 ? "s" : ""}</span>
                      </li>
                    ))}
                </ul>
              </Card>
              <Card className="p-5">
                <h2 className="mb-3 text-sm font-semibold">Pays de diffusion</h2>
                <ul className="space-y-2 text-sm">
                  {[...countries.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 6)
                    .map(([c, n]) => (
                      <li key={c} className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5">
                          <CountryFlag code={c} /> {countryLabel(c)}
                        </span>
                        <span className="text-muted-foreground tabular-nums">{n}</span>
                      </li>
                    ))}
                </ul>
              </Card>
            </div>
          )}

          {p.body_excerpt && (
            <Card className="p-5">
              <h2 className="mb-2 text-sm font-semibold">Description (boutique)</h2>
              <p className="text-fg-2 text-sm leading-6">{p.body_excerpt}</p>
            </Card>
          )}
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold">Pubs qui mènent à ce produit ({nf.format(ads.total)})</h2>
        {!paid ? (
          <UnlockMore what="pubs et analyses" />
        ) : ads.ads.length > 0 ? (
          <AdGrid ads={ads.ads} />
        ) : (
          <p className="text-muted-foreground text-sm">Aucune pub repérée qui mène directement à cette page produit.</p>
        )}
      </section>

      {others.items.filter((o) => o.id !== p.id).length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">Autres produits de la boutique</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {others.items
              .filter((o) => o.id !== p.id)
              .slice(0, 6)
              .map((o) => (
                <ShopProductCard key={o.id} product={o} shop={shopLite} base={base} />
              ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, hint, accent = false, title }: { label: string; value: string; hint?: string; accent?: boolean; title?: string }) {
  return (
    <div title={title}>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className={`text-xl font-bold leading-tight tabular-nums ${accent ? "text-accent" : "text-fg"}`}>{value}</dd>
      {hint && <p className="text-muted-foreground truncate text-xs">{hint}</p>}
    </div>
  );
}
