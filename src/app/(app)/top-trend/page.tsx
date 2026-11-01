import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { FeatureLock } from "@/components/FeatureLock";
import { ShopCard, ShopProductCard } from "@/components/shops/ShopCards";
import { currentAccess } from "@/lib/access";
import { listProducts, listShops, type Zone } from "@/lib/shopQueries";

export const dynamic = "force-dynamic";

/**
 * Top Trend = produits et boutiques MIS EN AVANT par les pubs : classement par
 * nombre de pubs actives qui y mènent (données Meta réelles, fenêtre 30 j).
 * Réservé aux offres payantes.
 */
export default async function TopTrendPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; zone?: string }>;
}) {
  const { paid } = await currentAccess();
  if (!paid) {
    return (
      <div className="space-y-4">
        <PageHeader title="Top Trend" subtitle="Les produits et boutiques qui font le plus de pubs en ce moment." />
        <FeatureLock
          title="Top Trend est réservé aux abonnés"
          minPlan="Starter"
          description="Le classement des produits et des boutiques les plus poussés en pub (Afrique et Europe), mis à jour chaque jour."
        />
      </div>
    );
  }

  const sp = await searchParams;
  const tab = sp.tab === "boutiques" ? "boutiques" : "produits";
  const zone: Zone = sp.zone === "africa" || sp.zone === "europe" ? sp.zone : "all";
  const href = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const next = { tab: tab === "produits" ? null : tab, zone: zone === "all" ? null : zone, ...patch };
    for (const [k, v] of Object.entries(next)) if (v) p.set(k, v);
    const qs = p.toString();
    return `/top-trend${qs ? `?${qs}` : ""}`;
  };

  const products = tab === "produits" ? await listProducts({ zone, sort: "pubs", withAds: true, limit: 50 }) : null;
  const shops = tab === "boutiques" ? await listShops({ zone, sort: "pubs", limit: 30 }) : null;
  const empty = (products && products.items.length === 0) || (shops && shops.shops.length === 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Top Trend"
        subtitle="Les produits et boutiques qui font le plus de pubs actives en ce moment (pubs repérées sur 30 jours)."
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="border-border flex gap-1 border-b">
          {(
            [
              ["produits", "Produits"],
              ["boutiques", "Boutiques"],
            ] as const
          ).map(([t, label]) => (
            <Link
              key={t}
              href={href({ tab: t === "produits" ? null : t })}
              aria-current={tab === t ? "page" : undefined}
              className={`-mb-px border-b-2 px-3 pb-2.5 text-sm font-semibold ${
                tab === t ? "border-accent text-fg" : "text-muted-foreground hover:text-fg border-transparent"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="bg-input ml-auto flex gap-0.5 rounded-lg p-0.5">
          {(
            [
              ["all", "Tous"],
              ["africa", "Afrique"],
              ["europe", "Europe"],
            ] as const
          ).map(([z, label]) => (
            <Link
              key={z}
              href={href({ zone: z === "all" ? null : z })}
              aria-current={zone === z ? "true" : undefined}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                zone === z ? "bg-surface text-fg shadow-card font-semibold" : "text-fg-2 hover:text-fg"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {empty ? (
        <div className="border-border bg-surface rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">Pas encore de classement pour cette zone.</p>
          <p className="text-muted-foreground mt-1 text-sm">Il se remplit à chaque collecte de pubs (feed du matin et recherches Spy).</p>
        </div>
      ) : (
        <ol className="grid grid-cols-2 items-stretch gap-3 md:grid-cols-3 xl:grid-cols-5">
          {products?.items.map((p, i) => (
            <li key={p.id} className="relative">
              <Rank n={i + 1} />
              <ShopProductCard product={p} shop={p.shops} />
            </li>
          ))}
          {shops?.shops.map((s, i) => (
            <li key={s.id} className="relative">
              <Rank n={i + 1} />
              <ShopCard shop={s} thumbs={shops.thumbs.get(s.id)} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Rank({ n }: { n: number }) {
  return (
    <span
      className={`absolute -left-1.5 -top-1.5 z-10 grid h-7 min-w-7 place-items-center rounded-full px-1.5 text-xs font-bold tabular-nums shadow-card ${
        n <= 3 ? "bg-accent text-accent-on" : "bg-surface text-fg border-border border"
      }`}
    >
      <span className="sr-only">Classement n° </span>
      {n}
    </span>
  );
}
