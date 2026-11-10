import Link from "next/link";
import { Suspense } from "react";
import { ShopProductCard, UnlockMore } from "@/components/shops/ShopCards";
import { CatalogFilters } from "@/components/shops/CatalogFilters";
import { PageHeader } from "@/components/ui";
import { currentAccess } from "@/lib/access";
import { listNiches, listProducts, WINNER_MIN_SCORE, type ProductSort, type Zone } from "@/lib/shopQueries";

export const dynamic = "force-dynamic";

const PAGE = 48;

/**
 * Produits gagnants : produits du catalogue public des boutiques Shopify,
 * classés par nombre de pubs qui mènent à leur page. Gratuit : 5 éléments.
 */
export default async function ProduitsGagnantsPage({
  searchParams,
}: {
  searchParams: Promise<{ zone?: string; q?: string; sort?: string; ads?: string; page?: string; niche?: string }>;
}) {
  const sp = await searchParams;
  const zone: Zone = sp.zone === "africa" || sp.zone === "europe" || sp.zone === "america" ? sp.zone : "all";
  const page = Math.max(1, Number(sp.page) || 1);
  const [{ paid, pagesLimit }, niches] = await Promise.all([currentAccess(), listNiches()]);
  const niche = sp.niche && niches.includes(sp.niche) ? sp.niche : undefined;
  const limit = pagesLimit ?? PAGE * page;
  const sort: ProductSort = sp.sort === "recent" || sp.sort === "promo" || sp.sort === "pubs" ? sp.sort : "new";
  const winners = sp.ads !== "0";
  const { items, total } = await listProducts({
    zone,
    q: (sp.q ?? "").slice(0, 80),
    sort,
    withAds: winners,
    minScore: winners ? WINNER_MIN_SCORE : undefined,
    limit,
    niche,
  });
  const next = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
  next.set("page", String(page + 1));

  return (
    <div className="space-y-4">
      <PageHeader title="Produits gagnants" subtitle="Les produits vers lesquels mènent les pubs repérées, les derniers arrivés en premier. Ajoutés automatiquement à chaque recherche et à chaque collecte du feed." />
      <Suspense>
        <CatalogFilters basePath="/produits-gagnants" kind="produits" niches={niches} />
      </Suspense>

      {total === 0 ? (
        <div className="border-border bg-surface rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">Aucun produit pour ces filtres.</p>
          <p className="text-muted-foreground mt-1 text-sm">
            {sp.ads !== "0" ? "Essaie « Tout le catalogue » ou une autre zone." : "Élargis la zone, la niche ou la recherche."}
          </p>
        </div>
      ) : (
        <>
          <p className="text-muted-foreground text-sm tabular-nums">
            {Math.min(total, limit)} sur {total} produits
          </p>
          <div className="grid grid-cols-2 items-stretch gap-3 md:grid-cols-3 xl:grid-cols-5">
            {items.map((p) => (
              <ShopProductCard key={p.id} product={p} shop={p.shops} />
            ))}
          </div>
          {!paid ? (
            total > limit && <UnlockMore what="produits" total={total} shown={limit} />
          ) : (
            total > limit && (
              <div className="flex justify-center">
                <Link href={`/produits-gagnants?${next}`} scroll={false} className="border-border bg-surface hover:bg-input rounded-md border px-5 py-2.5 text-sm font-semibold">
                  Voir plus
                </Link>
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}
