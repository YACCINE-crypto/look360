import Link from "next/link";
import { after } from "next/server";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { CountryFlag } from "@/components/dataviz";
import { AdGrid } from "@/components/AdGrid";
import { ShopProductCard, UnlockMore } from "@/components/shops/ShopCards";
import { currentAccess, FREE_PREVIEW } from "@/lib/access";
import { getShop, shopAds, shopProducts } from "@/lib/shopQueries";
import { callShopCrawl, cleanTheme, formatPrice, isStale } from "@/lib/shops";
import { countryLabel, formatReach } from "@/lib/spy";


const nf = new Intl.NumberFormat("fr-FR");
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "—";

/** Fiche boutique, ouverte depuis Boutiques & produits ou depuis Top Trend (`base`). */
export async function ShopView({
  domain: raw,
  all,
  base,
  backHref,
  backLabel,
}: {
  domain: string;
  all?: boolean;
  base: string;
  backHref: string;
  backLabel: string;
}) {
  const domain = decodeURIComponent(raw).toLowerCase();
  const shop = await getShop(domain);
  if (!shop) notFound();

  // Données de plus de 7 jours → mise à jour en arrière-plan (prochaine visite).
  if (isStale(shop)) after(() => callShopCrawl({ mode: "domain", domain }).then(() => undefined));

  const { paid } = await currentAccess();
  const limit = !paid ? FREE_PREVIEW : all ? 1000 : 60;
  const [{ items, total }, ads] = await Promise.all([
    shop.status === "ok" ? shopProducts(shop.id, limit) : Promise.resolve({ items: [], total: 0 }),
    paid ? shopAds(domain, null, 24) : Promise.resolve({ ads: [], total: shop.ads_count }),
  ]);
  const withAds = items.filter((p) => p.ads_count > 0);
  const others = items.filter((p) => p.ads_count === 0);
  const shopLite = { domain: shop.domain, currency: shop.currency, name: shop.name, ad_countries: shop.ad_countries };
  const theme = cleanTheme(shop.theme);

  return (
    <div className="space-y-4">
      {/* En-tête boutique */}
      <div className="border-border bg-surface shadow-card rounded-xl border">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href={backHref}
              aria-label={backLabel}
              className="text-muted-foreground hover:bg-input hover:text-fg grid h-9 w-9 shrink-0 place-items-center rounded-md"
            >
              <Icon name="chevronRight" size={16} className="rotate-180" />
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold tracking-tight">{shop.name || shop.domain}</h1>
              <p className="text-muted-foreground truncate text-sm">{shop.domain}</p>
            </div>
          </div>
          <a
            href={`https://${shop.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-accent text-accent-on hover:bg-accent-hover inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-md px-4 text-sm font-semibold transition-colors"
          >
            <Icon name="external" size={15} /> Visiter la boutique
          </a>
        </div>
        <div className="border-border-soft text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t px-4 py-2.5 text-xs">
          {shop.ad_countries.length > 0 && (
            <span className="flex items-center gap-1.5">
              Pubs en {shop.ad_countries.slice(0, 4).map((c) => (
                <CountryFlag key={c} code={c} />
              ))}
              {shop.ad_countries.length === 1 && countryLabel(shop.ad_countries[0])}
            </span>
          )}
          {shop.platform === "shopify" && <span>Shopify{theme ? ` · thème ${theme}` : ""}</span>}
          {shop.currency && <span>Devise {shop.currency}</span>}
          {shop.niche && <span>{shop.niche}</span>}
          {shop.catalog_type && <span>{shop.catalog_type === "mono" ? "Mono-produit" : "Multi-produits"}</span>}
          {shop.cod_apps.length > 0 && (
            <span className="bg-success-bg text-success-fg rounded-full px-2 py-0.5 font-semibold">
              COD : {shop.cod_apps.join(", ")}
            </span>
          )}
          {shop.pixels.length > 0 && <span>Pixels : {shop.pixels.join(", ")}</span>}
          <span>Mis à jour le {fmtDate(shop.last_crawled)}</span>
        </div>
      </div>

      {/* Chiffres clés */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Produits" value={shop.product_count != null ? nf.format(shop.product_count) : "—"} hint="au catalogue public" />
        <Kpi
          label="Prix"
          value={shop.price_min != null ? `${formatPrice(shop.price_min, shop.currency)}` : "—"}
          hint={shop.price_max != null && shop.price_max !== shop.price_min ? `jusqu'à ${formatPrice(shop.price_max, shop.currency)}` : "prix unique"}
        />
        <Kpi label="Pubs repérées" value={nf.format(shop.ads_count)} hint={`${nf.format(shop.ads_active)} actives`} accent />
        <Kpi label="Nouveautés" value={shop.new_products_30d != null ? nf.format(shop.new_products_30d) : "—"} hint="produits ajoutés en 30 j" />
        <Kpi
          label={shop.eu_reach ? "Audience UE" : "En promotion"}
          value={shop.eu_reach ? formatReach(shop.eu_reach) : shop.discounted_count != null ? nf.format(shop.discounted_count) : "—"}
          hint={shop.eu_reach ? "personnes touchées (Meta)" : "produits avec prix barré"}
        />
      </div>

      {shop.status !== "ok" ? (
        <Card className="p-5 text-sm">
          <p className="font-semibold">Catalogue indisponible</p>
          <p className="text-muted-foreground mt-1">
            {shop.status === "not_shopify"
              ? "Ce site n'est pas une boutique Shopify (page de vente, autre plateforme…) : son catalogue n'est pas public."
              : shop.status === "blocked"
                ? "La boutique bloque la lecture de son catalogue public."
                : shop.status === "pending"
                  ? "Le catalogue n'a pas encore été lu. Reviens dans quelques minutes."
                  : "La dernière lecture a échoué ; nouvelle tentative prévue."}{" "}
            Les pubs repérées restent affichées ci-dessous.
          </p>
        </Card>
      ) : (
        <>
          {withAds.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-semibold">Produits mis en avant par les pubs</h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                {withAds.map((p) => (
                  <ShopProductCard key={p.id} product={p} shop={shopLite} base={base} />
                ))}
              </div>
            </section>
          )}
          {others.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-semibold">Catalogue</h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                {others.map((p) => (
                  <ShopProductCard key={p.id} product={p} shop={shopLite} base={base} />
                ))}
              </div>
            </section>
          )}
          {!paid ? (
            total > FREE_PREVIEW && <UnlockMore what="produits" total={total} />
          ) : (
            total > items.length && (
              <div className="flex justify-center">
                <Link href={`${base}/${encodeURIComponent(domain)}?all=1`} className="border-border bg-surface hover:bg-input rounded-md border px-5 py-2.5 text-sm font-semibold">
                  Voir tout le catalogue ({nf.format(total)})
                </Link>
              </div>
            )
          )}
        </>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold">Pubs repérées ({nf.format(ads.total)})</h2>
        {paid ? (
          ads.ads.length > 0 ? (
            <AdGrid ads={ads.ads} />
          ) : (
            <p className="text-muted-foreground text-sm">Aucune pub enregistrée pour cette boutique.</p>
          )
        ) : (
          <UnlockMore what="pubs" total={ads.total + FREE_PREVIEW} />
        )}
      </section>
    </div>
  );
}

function Kpi({ label, value, hint, accent = false }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <Card className="p-4">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <p className={`mt-1 truncate text-2xl font-bold tabular-nums ${accent ? "text-accent" : "text-fg"}`}>{value}</p>
      {hint && <p className="text-muted-foreground mt-0.5 truncate text-xs">{hint}</p>}
    </Card>
  );
}
