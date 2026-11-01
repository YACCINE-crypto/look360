import Link from "next/link";
import { Icon } from "@/components/Icon";
import { CountryFlag } from "@/components/dataviz";
import {
  discountPct,
  formatPrice,
  productStage,
  type Shop,
  type ShopProduct,
} from "@/lib/shops";

const nf = new Intl.NumberFormat("fr-FR");

function ago(date: string | null): string | null {
  if (!date) return null;
  const d = Math.floor((Date.now() - Date.parse(date)) / 86_400_000);
  return d <= 0 ? "aujourd'hui" : `${d} j`;
}

export function StageBadge({ p }: { p: Pick<ShopProduct, "ads_active" | "ads_count" | "first_ad_date"> }) {
  const s = productStage(p);
  if (!s) return null;
  const cls =
    s.tone === "success"
      ? "bg-success-bg text-success-fg"
      : s.tone === "warn"
        ? "bg-warn-bg text-warn-fg"
        : s.tone === "accent"
          ? "bg-secondary text-accent"
          : "bg-input text-fg-2";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`} title={s.hint}>
      {s.label}
    </span>
  );
}

/** Carte produit (catalogue Shopify public + pubs repérées). */
export function ShopProductCard({
  product: p,
  shop,
}: {
  product: ShopProduct;
  shop: Pick<Shop, "domain" | "currency" | "name" | "ad_countries">;
}) {
  const disc = discountPct(p.price, p.compare_at_price);
  const href = `/boutiques/${encodeURIComponent(shop.domain)}/${encodeURIComponent(p.handle)}`;
  return (
    <Link
      href={href}
      className="group bg-surface border-border shadow-card card-lift flex h-full flex-col overflow-hidden rounded-xl border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      <div className="bg-input relative aspect-square overflow-hidden">
        {p.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image_url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
        ) : (
          <span className="text-muted-foreground grid h-full place-items-center text-xs">Image indisponible</span>
        )}
        <span className="absolute left-2 top-2 flex gap-1">
          <StageBadge p={p} />
        </span>
        {disc != null && (
          <span className="bg-danger-fg text-accent-on absolute right-2 top-2 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums">
            −{disc} %
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5" title={p.title}>
          {p.title}
        </h3>
        <p className="text-muted-foreground mt-0.5 flex items-center gap-1.5 truncate text-xs">
          {shop.ad_countries[0] && <CountryFlag code={shop.ad_countries[0]} />}
          {shop.domain}
        </p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-fg text-lg font-bold tabular-nums">{formatPrice(p.price, shop.currency)}</span>
          {disc != null && (
            <span className="text-muted-foreground text-xs tabular-nums line-through">
              {formatPrice(p.compare_at_price, shop.currency)}
            </span>
          )}
        </div>
        <dl className="bg-bg mt-auto grid grid-cols-2 overflow-hidden rounded-md text-xs">
          <div className="px-2.5 py-2">
            <dt className="text-muted-foreground">Pubs actives</dt>
            <dd className={`text-base font-semibold tabular-nums ${p.ads_active ? "text-accent" : "text-fg"}`}>
              {p.ads_count ? nf.format(p.ads_active) : "—"}
            </dd>
          </div>
          <div className="border-border border-l px-2.5 py-2">
            <dt className="text-muted-foreground">Première pub</dt>
            <dd className="text-fg text-base font-semibold tabular-nums">{ago(p.first_ad_date) ?? "—"}</dd>
          </div>
        </dl>
      </div>
    </Link>
  );
}

/** Carte boutique (agrégats du catalogue + pubs repérées). */
export function ShopCard({ shop, thumbs = [] }: { shop: Shop; thumbs?: string[] }) {
  const ok = shop.status === "ok";
  return (
    <Link
      href={`/boutiques/${encodeURIComponent(shop.domain)}`}
      className="bg-surface border-border shadow-card card-lift flex h-full flex-col overflow-hidden rounded-xl border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      <div className="bg-input grid aspect-[3/2] grid-cols-3 gap-px overflow-hidden">
        {thumbs.length > 0 ? (
          thumbs.slice(0, 3).map((t, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={t} alt="" loading="lazy" className={`h-full w-full object-cover ${thumbs.length === 1 ? "col-span-3" : thumbs.length === 2 && i === 1 ? "col-span-2" : ""}`} />
          ))
        ) : (
          <span className="text-muted-foreground col-span-3 grid place-items-center text-xs">
            {ok ? "Aucune image" : "Catalogue indisponible"}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">{shop.name || shop.domain}</h3>
            <p className="text-muted-foreground flex items-center gap-1.5 truncate text-xs">
              {shop.ad_countries[0] && <CountryFlag code={shop.ad_countries[0]} />}
              {shop.domain}
            </p>
          </div>
          {shop.cod_apps.length > 0 && (
            <span className="bg-success-bg text-success-fg shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold" title={shop.cod_apps.join(", ")}>
              COD
            </span>
          )}
        </div>
        <div className="text-muted-foreground mt-1.5 flex flex-wrap gap-1.5 text-xs">
          {shop.niche && <span className="bg-input rounded-full px-2 py-0.5">{shop.niche}</span>}
          {shop.catalog_type && (
            <span className="bg-input rounded-full px-2 py-0.5">
              {shop.catalog_type === "mono" ? "Mono-produit" : "Multi-produits"}
            </span>
          )}
        </div>
        <dl className="bg-bg mt-auto grid grid-cols-[1fr_1.7fr_1fr] overflow-hidden rounded-md pt-0 text-xs">
          <div className="px-2 py-2">
            <dt className="text-muted-foreground truncate">Produits</dt>
            <dd className="text-fg text-base font-semibold tabular-nums">{shop.product_count != null ? nf.format(shop.product_count) : "—"}</dd>
          </div>
          <div className="border-border border-l px-2 py-2">
            <dt className="text-muted-foreground truncate">Prix</dt>
            <dd className="text-fg text-sm font-semibold tabular-nums whitespace-nowrap" title={shop.price_max != null ? `jusqu'à ${formatPrice(shop.price_max, shop.currency)}` : undefined}>
              {shop.price_min != null ? formatPrice(shop.price_min, shop.currency) : "—"}
            </dd>
          </div>
          <div className="border-border border-l px-2 py-2">
            <dt className="text-muted-foreground truncate">Pubs</dt>
            <dd className="text-accent text-base font-semibold tabular-nums">{nf.format(shop.ads_count)}</dd>
          </div>
        </dl>
      </div>
    </Link>
  );
}

/** Encart « débloquer » affiché après l'aperçu gratuit. */
export function UnlockMore({ what, total }: { what: string; total?: number }) {
  return (
    <div className="border-border bg-surface flex flex-col items-center gap-3 rounded-xl border border-dashed p-6 text-center sm:flex-row sm:text-left">
      <span className="bg-secondary text-accent grid h-11 w-11 shrink-0 place-items-center rounded-full">
        <Icon name="lock" size={20} />
      </span>
      <div className="flex-1">
        <p className="font-semibold">
          {total && total > 5 ? `${nf.format(total - 5)} ${what} de plus avec un abonnement` : `Débloque tous les ${what}`}
        </p>
        <p className="text-muted-foreground text-sm">L&apos;offre gratuite affiche un aperçu de 5 éléments.</p>
      </div>
      <Link
        href="/offres"
        className="bg-accent text-accent-on hover:bg-accent-hover inline-flex min-h-10 shrink-0 items-center rounded-md px-4 text-sm font-semibold transition-colors"
      >
        Voir les offres
      </Link>
    </div>
  );
}
