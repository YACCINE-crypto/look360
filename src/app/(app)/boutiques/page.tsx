import Link from "next/link";
import { Suspense } from "react";
import { ShopCard, UnlockMore } from "@/components/shops/ShopCards";
import { CatalogFilters } from "@/components/shops/CatalogFilters";
import { PageHeader } from "@/components/ui";
import { currentAccess } from "@/lib/access";
import { listNiches, listShops, type ShopSort, type Zone } from "@/lib/shopQueries";

export const dynamic = "force-dynamic";

const PAGE = 48;

/**
 * Boutiques : boutiques Shopify derrière les pubs repérées (catalogue, prix,
 * COD, pubs actives). Gratuit : aperçu limité CÔTÉ SERVEUR (plan_limits.pages_limit).
 */
export default async function BoutiquesPage({
  searchParams,
}: {
  searchParams: Promise<{ zone?: string; q?: string; sort?: string; page?: string; niche?: string }>;
}) {
  const sp = await searchParams;
  const zone: Zone = sp.zone === "africa" || sp.zone === "europe" || sp.zone === "america" ? sp.zone : "all";
  const page = Math.max(1, Number(sp.page) || 1);
  const [{ paid, pagesLimit }, niches] = await Promise.all([currentAccess(), listNiches()]);
  const niche = sp.niche && niches.includes(sp.niche) ? sp.niche : undefined;
  const limit = pagesLimit ?? PAGE * page;
  const sort: ShopSort = sp.sort === "produits" || sp.sort === "cod" ? sp.sort : "pubs";
  const { shops, total, thumbs } = await listShops({ zone, q: (sp.q ?? "").slice(0, 80), sort, limit, niche });
  const next = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
  next.set("page", String(page + 1));

  return (
    <div className="space-y-4">
      <PageHeader title="Boutiques" subtitle="Les boutiques Shopify derrière les pubs repérées : catalogue, prix, paiement à la livraison et pubs actives." />
      <Suspense>
        <CatalogFilters basePath="/boutiques" kind="boutiques" niches={niches} />
      </Suspense>

      {total === 0 ? (
        <div className="border-border bg-surface rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">Aucune boutique pour ces filtres.</p>
          <p className="text-muted-foreground mt-1 text-sm">Élargis la zone, la niche ou la recherche.</p>
        </div>
      ) : (
        <>
          <p className="text-muted-foreground text-sm tabular-nums">
            {Math.min(total, limit)} sur {total} boutiques
          </p>
          <div className="grid grid-cols-2 items-stretch gap-3 md:grid-cols-3 xl:grid-cols-5">
            {shops.map((s) => (
              <ShopCard key={s.id} shop={s} thumbs={thumbs.get(s.id)} />
            ))}
          </div>
          {!paid ? (
            total > limit && <UnlockMore what="boutiques" total={total} shown={limit} />
          ) : (
            total > limit && (
              <div className="flex justify-center">
                <Link href={`/boutiques?${next}`} scroll={false} className="border-border bg-surface hover:bg-input rounded-md border px-5 py-2.5 text-sm font-semibold">
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
