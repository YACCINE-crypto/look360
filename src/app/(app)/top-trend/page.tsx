import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { FeatureLock } from "@/components/FeatureLock";
import { AdGrid } from "@/components/AdGrid";
import { ShopCard, ShopProductCard, UnlockMore } from "@/components/shops/ShopCards";
import { currentAccess } from "@/lib/access";
import { listNiches, listProducts, listShops, type Zone } from "@/lib/shopQueries";
import { AD_SCORE_MIN, PRODUCT_MIN_ACTIVE, readRanking, SHOP_MIN_ACTIVE, type RankedAd } from "@/lib/trends";
import { type SpyAd } from "@/lib/spy";

export const dynamic = "force-dynamic";

// Nombre d'éléments affichés ; les seuils et le calcul sont dans lib/trends.
const TOP_ADS = 8;
const TOP_PRODUCTS = 8;
const TOP_SHOPS = 6;

/**
 * Top Trend = sélection courte du MEILLEUR du moment, en un coup d'œil :
 * meilleures pubs, produits les plus poussés, boutiques les plus actives.
 * Les listes complètes restent dans Spy, Produits gagnants et Boutiques.
 * Accès (plan EFFECTIF, filtré CÔTÉ SERVEUR) : gratuit = verrouillé ;
 * Starter = aperçu (3 produits + 3 boutiques, pas de pubs) ; Pro+ = complet.
 */
export default async function TopTrendPage({ searchParams }: { searchParams: Promise<{ zone?: string; niche?: string }> }) {
  const { topTrend, topTrendPreview } = await currentAccess();
  if (topTrend === "locked") {
    return (
      <div className="space-y-4">
        <PageHeader title="Top Trend" subtitle="Le meilleur du moment : pubs, produits et boutiques." />
        <FeatureLock
          title="Top Trend est réservé aux abonnés"
          minPlan="Starter"
          description="Chaque jour, la sélection des meilleures pubs, des produits les plus poussés et des boutiques les plus actives (Afrique et Europe)."
        />
      </div>
    );
  }

  const sp = await searchParams;
  const zone: Zone = sp.zone === "africa" || sp.zone === "europe" || sp.zone === "america" ? sp.zone : "all";
  const niches = await listNiches();
  const niche = sp.niche && niches.includes(sp.niche) ? sp.niche : undefined;

  const preview = topTrend === "preview";
  const nProducts = preview ? topTrendPreview : TOP_PRODUCTS;
  const nShops = preview ? topTrendPreview : TOP_SHOPS;
  // Classement recalculé par le job (/api/cron/trends). Aperçu : le serveur ne
  // lit que les N premiers et jamais les pubs.
  const [rp, rs, ra] = await Promise.all([
    readRanking("product", zone),
    readRanking("shop", zone),
    preview ? Promise.resolve(null) : readRanking("ad", zone),
  ]);
  const order = (ids: string[]) => (a: { id: string }, b: { id: string }) => ids.indexOf(a.id) - ids.indexOf(b.id);
  const pIds = rp.rows.map((r) => r.item_id);
  const sIds = rs.rows.map((r) => r.item_id);
  const [products, shops] = await Promise.all([
    pIds.length
      ? listProducts({ zone: "all", niche, ids: pIds, sort: "score", withAds: true, limit: pIds.length }).then((r) => ({
          ...r,
          items: r.items.sort(order(pIds)).slice(0, nProducts),
        }))
      : listProducts({ zone, niche, sort: "score", withAds: true, minActive: PRODUCT_MIN_ACTIVE, limit: nProducts }),
    sIds.length
      ? listShops({ zone: "all", niche, ids: sIds, sort: "score", limit: sIds.length }).then((r) => ({
          ...r,
          shops: r.shops.sort(order(sIds)).slice(0, nShops),
        }))
      : listShops({ zone, niche, sort: "score", minActive: SHOP_MIN_ACTIVE, limit: nShops }),
  ]);
  const ads: SpyAd[] = (ra?.rows ?? [])
    .map((r) => r.payload as RankedAd)
    .filter((a) => a && (!niche || a.trend_niche === niche))
    .slice(0, TOP_ADS);
  const computedAt = rp.computedAt ?? rs.computedAt;
  const link = (patch: { zone?: Zone; niche?: string | null }) => {
    const z = patch.zone ?? zone;
    const n = patch.niche === undefined ? niche : patch.niche;
    const p = new URLSearchParams();
    if (z !== "all") p.set("zone", z);
    if (n) p.set("niche", n);
    const q = p.toString();
    return `/top-trend${q ? `?${q}` : ""}`;
  };
  const qs = `${zone === "all" ? "" : `&zone=${zone}`}${niche ? `&niche=${encodeURIComponent(niche)}` : ""}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          title="Top Trend"
          subtitle={`Le meilleur du moment : classement recalculé automatiquement plusieurs fois par jour${
            computedAt ? ` (dernier calcul ${since(computedAt)})` : ""
          }.`}
        />
        <div className="bg-input flex shrink-0 gap-0.5 self-start rounded-lg p-0.5 sm:self-auto">
          {(
            [
              ["all", "Tous"],
              ["africa", "Afrique"],
              ["europe", "Europe"],
              ["america", "Amérique"],
            ] as const
          ).map(([z, label]) => (
            <Link
              key={z}
              href={link({ zone: z })}
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

      {niches.length > 0 && (
        <nav aria-label="Niches" className="-mx-1 -mt-2 flex gap-2 overflow-x-auto px-1 pb-1">
          {[null, ...niches].map((n) => (
            <Link
              key={n ?? "all"}
              href={link({ niche: n })}
              aria-current={(n ?? undefined) === niche ? "true" : undefined}
              className={`h-8 shrink-0 rounded-full border px-3 text-sm font-medium leading-[30px] ${
                (n ?? undefined) === niche ? "border-accent bg-secondary text-accent" : "border-border bg-surface text-fg-2 hover:bg-input"
              }`}
            >
              {n ?? "Toutes les niches"}
            </Link>
          ))}
        </nav>
      )}

      <Section
        icon="trending"
        title="Produits les plus poussés"
        rule={`Au moins ${PRODUCT_MIN_ACTIVE} pubs actives qui mènent à la page produit`}
        more={{ href: `/produits-gagnants?sort=pubs${qs}`, label: "Tous les produits" }}
        empty={products.items.length === 0}
      >
        <ol className="grid grid-cols-2 items-stretch gap-3 md:grid-cols-4">
          {products.items.map((p, i) => (
            <li key={p.id} className="relative">
              <Rank n={i + 1} />
              <ShopProductCard product={p} shop={p.shops} base="/top-trend" />
            </li>
          ))}
        </ol>
        {preview && <UnlockMore what="produits du top" total={TOP_PRODUCTS} shown={topTrendPreview} minPlan="Pro" />}
      </Section>

      {preview ? (
        <FeatureLock
          title="Meilleures pubs du moment"
          minPlan="Pro"
          description="Les pubs les plus fortes des 30 derniers jours (score 70+, toujours actives, une par annonceur) sont réservées à l'offre Pro."
        />
      ) : (
        <Section
          icon="play"
          title="Meilleures pubs"
          rule={`Score ${AD_SCORE_MIN}+ · toujours actives · une seule pub par annonceur`}
          more={{ href: "/spy", label: "Chercher dans le Spy" }}
          empty={ads.length === 0}
        >
          <AdGrid ads={ads} ranked />
        </Section>
      )}

      <Section
        icon="store"
        title="Boutiques les plus actives"
        rule={`Au moins ${SHOP_MIN_ACTIVE} pubs actives vers la boutique`}
        more={{ href: `/boutiques?sort=pubs${qs}`, label: "Toutes les boutiques" }}
        empty={shops.shops.length === 0}
      >
        <ol className="grid grid-cols-2 items-stretch gap-3 md:grid-cols-3">
          {shops.shops.map((s, i) => (
            <li key={s.id} className="relative">
              <Rank n={i + 1} />
              <ShopCard shop={s} thumbs={shops.thumbs.get(s.id)} base="/top-trend" />
            </li>
          ))}
        </ol>
        {preview && <UnlockMore what="boutiques du top" total={TOP_SHOPS} shown={topTrendPreview} minPlan="Pro" />}
      </Section>
    </div>
  );
}

/** « il y a 2 h » (calcul serveur, au moment du rendu). */
function since(iso: string): string {
  const min = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `il y a ${h} h` : `il y a ${Math.round(h / 24)} j`;
}

function Section({
  icon,
  title,
  rule,
  more,
  empty,
  children,
}: {
  icon: "trending" | "play" | "store";
  title: string;
  rule: string;
  more: { href: string; label: string };
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Icon name={icon} size={18} className="text-accent" /> {title}
          </h2>
          <p className="text-muted-foreground text-xs">{rule}</p>
        </div>
        <Link href={more.href} className="text-accent inline-flex items-center gap-1 text-sm font-semibold hover:underline">
          {more.label} <Icon name="chevronRight" size={14} />
        </Link>
      </div>
      {empty ? (
        <p className="border-border bg-surface text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
          Rien d&apos;assez fort pour cette zone en ce moment. Le classement est recalculé plusieurs fois par jour.
        </p>
      ) : (
        children
      )}
    </section>
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
