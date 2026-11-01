import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui";
import { ShopCard, ShopProductCard, UnlockMore } from "@/components/shops/ShopCards";
import { currentAccess, FREE_PREVIEW } from "@/lib/access";
import { listNiches, listProducts, listShops, type ProductSort, type ShopSort, type Zone } from "@/lib/shopQueries";
import { BoutiquesFilters } from "./BoutiquesFilters";

export const dynamic = "force-dynamic";

const PAGE = 48;

/**
 * Boutiques & produits : catalogue PUBLIC des boutiques Shopify repérées dans
 * les pubs (mis à jour tous les 7 jours), relié aux pubs Meta qui y mènent.
 * Offre gratuite : aperçu de 5 éléments.
 */
export default async function BoutiquesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; zone?: string; q?: string; sort?: string; ads?: string; page?: string; niche?: string }>;
}) {
  const sp = await searchParams;
  const tab = sp.tab === "boutiques" ? "boutiques" : "produits";
  const zone: Zone = sp.zone === "africa" || sp.zone === "europe" || sp.zone === "america" ? sp.zone : "all";
  const q = (sp.q ?? "").slice(0, 80);
  const page = Math.max(1, Number(sp.page) || 1);
  const [{ paid }, niches] = await Promise.all([currentAccess(), listNiches()]);
  const niche = sp.niche && niches.includes(sp.niche) ? sp.niche : undefined;
  const limit = paid ? PAGE * page : FREE_PREVIEW;

  let grid: React.ReactNode;
  let total = 0;
  if (tab === "produits") {
    const sort: ProductSort = sp.sort === "recent" || sp.sort === "promo" ? sp.sort : "pubs";
    const res = await listProducts({ zone, q, sort, withAds: sp.ads !== "0", limit, niche });
    total = res.total;
    grid = res.items.map((p) => <ShopProductCard key={p.id} product={p} shop={p.shops} />);
  } else {
    const sort: ShopSort = sp.sort === "produits" || sp.sort === "cod" ? sp.sort : "pubs";
    const res = await listShops({ zone, q, sort, limit, niche });
    total = res.total;
    grid = res.shops.map((s) => <ShopCard key={s.id} shop={s} thumbs={res.thumbs.get(s.id)} />);
  }
  const shown = Math.min(total, limit);
  const nextHref = (() => {
    const p = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
    p.set("page", String(page + 1));
    return `/boutiques?${p.toString()}`;
  })();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Boutiques & produits"
        subtitle="Les boutiques Shopify derrière les pubs repérées : catalogue, prix et pubs qui mènent à chaque produit. Mis à jour tous les 7 jours."
      />
      <Suspense>
        <BoutiquesFilters tab={tab} niches={niches} />
      </Suspense>

      {total === 0 ? (
        <div className="border-border bg-surface rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">Aucun résultat pour ces filtres.</p>
          <p className="text-muted-foreground mt-1 text-sm">
            {tab === "produits" && sp.ads !== "0"
              ? "Essaie « Tout le catalogue » pour voir aussi les produits sans pub repérée."
              : "Élargis la zone ou la recherche."}
          </p>
        </div>
      ) : (
        <>
          <p className="text-muted-foreground text-sm tabular-nums">
            {shown} sur {total} {tab === "produits" ? "produits" : "boutiques"}
          </p>
          <div className="grid grid-cols-2 items-stretch gap-3 md:grid-cols-3 xl:grid-cols-5">{grid}</div>
          {!paid ? (
            total > FREE_PREVIEW && <UnlockMore what={tab === "produits" ? "produits" : "boutiques"} total={total} />
          ) : (
            total > shown && (
              <div className="flex justify-center">
                <Link
                  href={nextHref}
                  scroll={false}
                  className="border-border bg-surface hover:bg-input rounded-md border px-5 py-2.5 text-sm font-semibold"
                >
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
