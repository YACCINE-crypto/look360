import Link from "next/link";
import { Suspense } from "react";
import { ShopProductCard, UnlockMore } from "@/components/shops/ShopCards";
import { CatalogFilters } from "@/components/shops/CatalogFilters";
import { CatalogHeader } from "@/components/shops/CatalogHeader";
import { currentAccess, FREE_PREVIEW } from "@/lib/access";
import { catalogStats, listNiches, listProducts, type ProductSort, type Zone } from "@/lib/shopQueries";

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
  const [{ paid }, niches, stats] = await Promise.all([currentAccess(), listNiches(), catalogStats()]);
  const niche = sp.niche && niches.includes(sp.niche) ? sp.niche : undefined;
  const limit = paid ? PAGE * page : FREE_PREVIEW;
  const sort: ProductSort = sp.sort === "recent" || sp.sort === "promo" ? sp.sort : "pubs";
  const { items, total } = await listProducts({ zone, q: (sp.q ?? "").slice(0, 80), sort, withAds: sp.ads !== "0", limit, niche });
  const next = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
  next.set("page", String(page + 1));

  return (
    <div className="space-y-4">
      <CatalogHeader
        title="Produits gagnants"
        subtitle="Les produits vers lesquels mènent les pubs repérées, avec leur prix réel et leurs pubs actives. Catalogues mis à jour tous les 7 jours."
        stats={[
          { label: "Produits avec pubs", value: stats.productsWithAds },
          { label: "En promotion", value: stats.promosWithAds },
          { label: "Produits au catalogue", value: stats.catalog },
        ]}
      />
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
            total > FREE_PREVIEW && <UnlockMore what="produits" total={total} />
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
