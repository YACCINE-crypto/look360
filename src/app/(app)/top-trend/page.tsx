import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { FeatureLock } from "@/components/FeatureLock";
import { AdGrid } from "@/components/AdGrid";
import { ShopCard, ShopProductCard } from "@/components/shops/ShopCards";
import { createAdminClient } from "@/lib/supabase/admin";
import { currentAccess } from "@/lib/access";
import { listNiches, listProducts, listShops, ZONE_CODES, type Zone } from "@/lib/shopQueries";
import { type SpyAd } from "@/lib/spy";

export const dynamic = "force-dynamic";

// Seuils « meilleurs » : seuls les signaux forts entrent dans Top Trend.
const TOP_ADS = 8;
const TOP_PRODUCTS = 8;
const TOP_SHOPS = 6;
const AD_SCORE_MIN = 70;
const PRODUCT_MIN_ACTIVE = 2;
const SHOP_MIN_ACTIVE = 3;

/**
 * Top Trend = sélection courte du MEILLEUR du moment, en un coup d'œil :
 * meilleures pubs, produits les plus poussés, boutiques les plus actives.
 * Les listes complètes restent dans Spy, Produits gagnants et Boutiques.
 * Réservé aux offres payantes.
 */
export default async function TopTrendPage({ searchParams }: { searchParams: Promise<{ zone?: string; niche?: string }> }) {
  const { paid } = await currentAccess();
  if (!paid) {
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

  const [ads, products, shops] = await Promise.all([
    topAds(zone, niche),
    listProducts({ zone, niche, sort: "pubs", withAds: true, minActive: PRODUCT_MIN_ACTIVE, limit: TOP_PRODUCTS }),
    listShops({ zone, niche, sort: "pubs", minActive: SHOP_MIN_ACTIVE, limit: TOP_SHOPS }),
  ]);
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
          subtitle="Le meilleur du moment, en un coup d'œil : uniquement les signaux les plus forts des 30 derniers jours."
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
      </Section>

      <Section
        icon="play"
        title="Meilleures pubs"
        rule={`Score ${AD_SCORE_MIN}+ · toujours actives · une seule pub par annonceur`}
        more={{ href: "/spy", label: "Chercher dans le Spy" }}
        empty={ads.length === 0}
      >
        <AdGrid ads={ads} ranked />
      </Section>

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
      </Section>
    </div>
  );
}

/** Meilleures pubs des 30 derniers jours (recherches + feed), une par annonceur. */
async function topAds(zone: Zone, niche?: string): Promise<SpyAd[]> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [{ data: rows }, { data: feed }, { data: kws }] = await Promise.all([
    admin.from("spy_searches").select("results, filters").gte("created_at", since).order("created_at", { ascending: false }).limit(400),
    admin.from("feed_ads").select("payload, niche, thumbnail_cdn_url, media_cdn_url"),
    niche ? admin.from("discovery_keywords").select("keyword").eq("niche", niche) : Promise.resolve({ data: [] as { keyword: string }[] }),
  ]);
  const nicheWords = new Set((kws ?? []).map((k) => k.keyword.toLowerCase()));
  const FEED_NICHE: Record<string, string> = { "Auto & moto": "Automobile", "Bien-être": "Santé", "Montre & tech": "High-tech" };
  const archived = new Map<string, { thumb: string | null; media: string | null }>();
  const all: SpyAd[] = [];
  for (const f of feed ?? []) {
    const ad = f.payload as unknown as SpyAd;
    if (!ad?.ad_archive_id) continue;
    archived.set(ad.ad_archive_id, { thumb: f.thumbnail_cdn_url, media: f.media_cdn_url });
    if (niche && (FEED_NICHE[f.niche ?? ""] ?? f.niche) !== niche) continue;
    all.push(ad);
  }
  for (const r of rows ?? []) {
    const q = String((r.filters as { q?: string } | null)?.q ?? "").toLowerCase().trim();
    if (niche && !nicheWords.has(q)) continue;
    for (const ad of (r.results as unknown as SpyAd[]) ?? []) if (ad?.ad_archive_id) all.push(ad);
  }

  const codes = zone === "all" ? null : new Set(ZONE_CODES[zone]);
  const inZone = (a: SpyAd) => !codes || codes.has(a.country ?? "");
  // Une pub par annonceur (la meilleure), pour une sélection variée.
  const best = new Map<string, SpyAd>();
  for (const a of all) {
    if (!a.is_active || a.score < AD_SCORE_MIN || !inZone(a)) continue;
    const key = a.page_id ?? a.page_name ?? a.ad_archive_id;
    const prev = best.get(key);
    if (!prev || a.score > prev.score || (a.score === prev.score && (a.reach ?? 0) > (prev.reach ?? 0))) best.set(key, a);
  }
  return [...best.values()]
    .sort((a, b) => b.score - a.score || (b.reach ?? 0) - (a.reach ?? 0) || (b.jours_actifs ?? 0) - (a.jours_actifs ?? 0))
    .slice(0, TOP_ADS)
    .map((ad) => {
      const a = archived.get(ad.ad_archive_id);
      return a
        ? { ...ad, thumbnail_url: a.thumb ?? ad.thumbnail_url, media_hls_url: a.media ?? ad.media_hls_url ?? null, media_source_url: ad.media_source_url ?? ad.media_url }
        : ad;
    });
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
          Rien d&apos;assez fort pour cette zone en ce moment. La sélection se met à jour à chaque collecte.
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
