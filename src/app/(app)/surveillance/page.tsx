import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { CountryFlag } from "@/components/dataviz";
import { EmptyState } from "@/components/EmptyState";
import { AdGrid } from "@/components/AdGrid";
import { ShopProductCard } from "@/components/shops/ShopCards";
import { BellRing } from "lucide-react";
import { countryLabel, cleanField, type SpyAd } from "@/lib/spy";
import { getSubscription } from "@/lib/credits";
import { planConfig } from "@/lib/billing";
import { PRODUCT_COLS, type ShopProduct } from "@/lib/shops";
import { FeatureLock } from "@/components/FeatureLock";
import { retirerConcurrent } from "./actions";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;
/** Heure du rendu (page dynamique, recalculée à chaque requête). */
function nowMs(): number {
  return Date.now();
}
const nf = new Intl.NumberFormat("fr-FR");

function initials(name: string | null): string {
  const n = (name ?? "").trim();
  if (!n) return "FB";
  return n
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
function ago(iso: string | null, now: number): string {
  if (!iso) return "jamais";
  const d = Math.floor((now - Date.parse(iso)) / DAY);
  return d <= 0 ? "aujourd'hui" : d === 1 ? "hier" : `il y a ${d} j`;
}

type CompAd = {
  page_id: string;
  ad_archive_id: string;
  payload: SpyAd;
  start_date: string | null;
  first_seen: string;
  last_seen: string;
  baseline: boolean;
};

/**
 * Surveillance = tour de contrôle des concurrents suivis :
 * 1) nouvelles pubs (depuis 7 j), 2) gagnantes probables (actives 30 j+) et
 * flops (coupées en moins de 7 j), 3) nouveaux produits dans leur boutique.
 * Données issues de la vérification quotidienne existante (aucun appel en plus).
 */
export default async function SurveillancePage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  const sub = userId ? await getSubscription(userId) : null;
  const slots = planConfig(sub?.plan).competitorSlots;

  if (slots === 0) {
    return (
      <div className="space-y-4">
        <PageHeader title="Surveillance" subtitle="Sois alerté dès qu'un concurrent lance une nouvelle pub." />
        <FeatureLock
          title="Surveillance des concurrents"
          minPlan="Starter"
          description="Suis les pages de tes concurrents : nouvelles pubs, pubs gagnantes, flops et nouveaux produits de leur boutique. Disponible à partir de l'offre Starter (1 concurrent), Pro (3) et Business (10)."
        />
      </div>
    );
  }

  const { data } = await supabase
    .from("competitors_watch")
    .select("*")
    .order("new_ads_count", { ascending: false })
    .order("created_at", { ascending: false });
  const rows = data ?? [];

  if (rows.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader title="Surveillance" subtitle={`Concurrents suivis (0/${slots}).`} />
        <EmptyState
          icon={BellRing}
          title="Aucun concurrent suivi"
          description="Depuis le Spy, une analyse ou une carte pub, clique « Surveiller la page » : tu verras ici ses nouvelles pubs, ses gagnantes, ses flops et les nouveaux produits de sa boutique."
          ctaHref="/spy"
          ctaLabel="Explorer le Spy"
        />
      </div>
    );
  }

  const pageIds = rows.map((r) => r.page_id);
  const domains = rows.map((r) => (r.domaine ?? "").toLowerCase().replace(/^www\./, "")).filter(Boolean);
  const [{ data: adRows }, { data: shopRows }] = await Promise.all([
    supabase
      .from("competitor_ads")
      .select("page_id, ad_archive_id, payload, start_date, first_seen, last_seen, baseline")
      .in("page_id", pageIds)
      .limit(3000),
    domains.length
      ? supabase.from("shops").select("id, domain, name, currency, ad_countries").in("domain", domains)
      : Promise.resolve({ data: [] as { id: string; domain: string; name: string | null; currency: string | null; ad_countries: string[] }[] }),
  ]);
  const ads = (adRows ?? []) as unknown as CompAd[];
  const shops = shopRows ?? [];

  const now = nowMs();
  // « Encore active » = vue lors de la dernière vérification de cette page.
  const latest = new Map<string, number>();
  for (const a of ads) latest.set(a.page_id, Math.max(latest.get(a.page_id) ?? 0, Date.parse(a.last_seen)));
  const isActive = (a: CompAd) => Date.parse(a.last_seen) >= (latest.get(a.page_id) ?? 0) - 6 * 3600_000;
  const daysLive = (a: CompAd) => {
    const from = a.start_date ? Date.parse(a.start_date) : Date.parse(a.first_seen);
    return Math.max(0, Math.floor(((isActive(a) ? now : Date.parse(a.last_seen)) - from) / DAY));
  };

  const fresh = ads
    .filter((a) => !a.baseline && now - Date.parse(a.first_seen) < 7 * DAY)
    .sort((x, y) => Date.parse(y.first_seen) - Date.parse(x.first_seen));
  const winners = ads.filter((a) => isActive(a) && daysLive(a) >= 30).sort((x, y) => daysLive(y) - daysLive(x));
  const flops = ads
    .filter((a) => !isActive(a) && daysLive(a) < 7 && now - Date.parse(a.last_seen) < 30 * DAY)
    .sort((x, y) => Date.parse(y.last_seen) - Date.parse(x.last_seen));

  // Nouveaux produits (14 j) dans les boutiques des concurrents — catalogue public.
  const shopById = new Map(shops.map((s) => [s.id, s]));
  let newProducts: ShopProduct[] = [];
  if (shops.length) {
    const { data: prods } = await supabase
      .from("shop_products")
      .select(PRODUCT_COLS)
      .in("shop_id", shops.map((s) => s.id))
      .gte("created_at_shop", new Date(now - 14 * DAY).toISOString())
      .order("created_at_shop", { ascending: false })
      .limit(10);
    newProducts = (prods ?? []) as unknown as ShopProduct[];
  }

  const byPage = (pid: string) => {
    const list = ads.filter((a) => a.page_id === pid);
    return {
      active: list.filter(isActive).length,
      fresh: list.filter((a) => !a.baseline && now - Date.parse(a.first_seen) < 7 * DAY).length,
      winners: list.filter((a) => isActive(a) && daysLive(a) >= 30).length,
      flops: list.filter((a) => !isActive(a) && daysLive(a) < 7 && now - Date.parse(a.last_seen) < 30 * DAY).length,
    };
  };
  const neverChecked = rows.every((r) => !r.last_checked_at);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Surveillance"
        subtitle={`${rows.length}/${slots} concurrents suivis · vérifiés chaque matin. Ce qui a changé chez eux, en un coup d'œil.`}
      >
        <Link
          href="/spy"
          className="border-border bg-surface hover:bg-input inline-flex min-h-10 items-center gap-1.5 rounded-md border px-4 text-sm font-semibold"
        >
          <Icon name="plus" size={16} /> Suivre un concurrent
        </Link>
      </PageHeader>

      {/* Résumé */}
      <dl className="border-border bg-surface shadow-card grid grid-cols-2 divide-border overflow-hidden rounded-xl border sm:grid-cols-4 sm:divide-x">
        <Stat label="Nouvelles pubs (7 j)" value={fresh.length} accent />
        <Stat label="Nouveaux produits (14 j)" value={newProducts.length} />
        <Stat label="Gagnantes probables" value={winners.length} hint="actives depuis 30 j et plus" />
        <Stat label="Flops récents" value={flops.length} hint="coupées en moins de 7 j" />
      </dl>

      {neverChecked && (
        <p className="bg-secondary text-secondary-foreground rounded-xl px-4 py-3 text-sm">
          Le suivi démarre à la prochaine vérification du matin : les nouvelles pubs et les flops apparaîtront à partir de là.
        </p>
      )}

      {/* 1. Nouvelles pubs */}
      <Section title="Nouvelles pubs" hint="Lancées par tes concurrents ces 7 derniers jours" icon="sparkles">
        {fresh.length > 0 ? (
          <AdGrid ads={fresh.slice(0, 8).map((a) => a.payload)} />
        ) : (
          <Empty text="Aucune nouvelle pub détectée cette semaine." />
        )}
      </Section>

      {/* 2. Gagnantes et flops */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Gagnantes probables" hint="Toujours actives après 30 jours : elles rapportent sûrement" icon="trophy">
          <AdList ads={winners.slice(0, 6)} days={daysLive} tone="success" label={(d) => `${d} j en ligne`} empty="Aucune pub active depuis plus de 30 jours." />
        </Section>
        <Section title="Flops récents" hint="Coupées en moins de 7 jours : tests ratés à ne pas copier" icon="x">
          <AdList ads={flops.slice(0, 6)} days={daysLive} tone="danger" label={(d) => `coupée après ${d} j`} empty="Aucun flop repéré sur les 30 derniers jours." />
        </Section>
      </div>

      {/* 3. Nouveaux produits */}
      <Section title="Nouveaux produits dans leurs boutiques" hint="Ajoutés à leur catalogue ces 14 derniers jours" icon="store">
        {newProducts.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {newProducts.map((p) => {
              const s = shopById.get(p.shop_id)!;
              return <ShopProductCard key={p.id} product={p} shop={{ domain: s.domain, name: s.name, currency: s.currency, ad_countries: s.ad_countries }} />;
            })}
          </div>
        ) : (
          <Empty
            text={
              shops.length === 0
                ? "Les boutiques de tes concurrents ne sont pas encore lues (ou ne sont pas sur Shopify)."
                : "Aucun nouveau produit dans leurs boutiques ces 14 derniers jours."
            }
          />
        )}
      </Section>

      {/* Concurrents */}
      <Section title="Tes concurrents" hint="Analyse complète, boutique ou retrait" icon="users">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {rows.map((c) => {
            const st = byPage(c.page_id);
            const pageName = cleanField(c.page_name) ?? "Page Facebook";
            const shop = shops.find((s) => s.domain === (c.domaine ?? "").toLowerCase().replace(/^www\./, ""));
            return (
              <Card key={c.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start gap-3">
                  <span className="bg-secondary text-accent grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-bold">
                    {initials(pageName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold leading-snug">{pageName}</p>
                    <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 truncate text-xs">
                      {c.domaine && <span className="truncate">{c.domaine}</span>}
                      {c.country && (
                        <span className="flex items-center gap-1">
                          <CountryFlag code={c.country} /> {countryLabel(c.country)}
                        </span>
                      )}
                    </p>
                    <p className="text-muted-foreground text-xs">Vérifié {ago(c.last_checked_at, now)}</p>
                  </div>
                  {st.fresh > 0 && (
                    <span className="bg-accent text-accent-on shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold">
                      +{st.fresh} nouvelle{st.fresh > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <dl className="bg-bg grid grid-cols-4 overflow-hidden rounded-md text-xs">
                  <Mini label="Actives" value={st.active} />
                  <Mini label="Nouvelles" value={st.fresh} accent />
                  <Mini label="Gagnantes" value={st.winners} />
                  <Mini label="Flops" value={st.flops} />
                </dl>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/analyse/${encodeURIComponent(c.page_id)}?country=${encodeURIComponent(c.country ?? "FR")}&name=${encodeURIComponent(c.page_name ?? "")}`}
                    className="bg-accent text-accent-on hover:bg-accent-hover inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-semibold transition-colors"
                  >
                    <Icon name="chart" size={14} /> Analyser
                  </Link>
                  {shop && (
                    <Link
                      href={`/boutiques/${encodeURIComponent(shop.domain)}`}
                      className="border-border hover:bg-input inline-flex min-h-10 items-center gap-1.5 rounded-md border px-3 text-sm font-medium"
                    >
                      <Icon name="store" size={14} /> Boutique
                    </Link>
                  )}
                  <form action={retirerConcurrent}>
                    <input type="hidden" name="id" value={c.id} />
                    <button
                      type="submit"
                      aria-label="Retirer de la surveillance"
                      title="Retirer de la surveillance"
                      className="text-muted-foreground hover:text-danger-fg hover:bg-danger-bg border-border grid h-10 w-10 place-items-center rounded-md border transition-colors"
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </form>
                </div>
              </Card>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

function Stat({ label, value, hint, accent = false }: { label: string; value: number; hint?: string; accent?: boolean }) {
  return (
    <div className="px-4 py-3" title={hint}>
      <dt className="text-muted-foreground truncate text-xs">{label}</dt>
      <dd className={`text-2xl font-bold tabular-nums ${accent ? "text-accent" : "text-fg"}`}>{nf.format(value)}</dd>
    </div>
  );
}
function Mini({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="border-border px-2.5 py-2 [&+&]:border-l">
      <dt className="text-muted-foreground truncate">{label}</dt>
      <dd className={`text-base font-semibold tabular-nums ${accent && value > 0 ? "text-accent" : "text-fg"}`}>{value}</dd>
    </div>
  );
}
function Section({
  title,
  hint,
  icon,
  children,
}: {
  title: string;
  hint: string;
  icon: "sparkles" | "trophy" | "x" | "store" | "users";
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="flex items-center gap-2 text-base font-bold">
          <Icon name={icon} size={17} className="text-accent" /> {title}
        </h2>
        <p className="text-muted-foreground text-xs">{hint}</p>
      </div>
      {children}
    </section>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="border-border bg-surface text-muted-foreground rounded-xl border border-dashed p-5 text-center text-sm">{text}</p>;
}

/** Liste compacte de pubs (miniature, page, texte, durée). */
function AdList({
  ads,
  days,
  tone,
  label,
  empty,
}: {
  ads: CompAd[];
  days: (a: CompAd) => number;
  tone: "success" | "danger";
  label: (d: number) => string;
  empty: string;
}) {
  if (ads.length === 0) return <Empty text={empty} />;
  return (
    <ul className="border-border bg-surface shadow-card divide-border-soft divide-y overflow-hidden rounded-xl border">
      {ads.map((a) => (
        <li key={a.ad_archive_id}>
          <a
            href={a.payload.ad_library_url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:bg-input flex items-center gap-3 px-3 py-2.5"
          >
            <span className="bg-input h-12 w-12 shrink-0 overflow-hidden rounded-md">
              {a.payload.thumbnail_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.payload.thumbnail_url} alt="" loading="lazy" className="h-full w-full object-cover" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{cleanField(a.payload.page_name) ?? "Page"}</span>
              <span className="text-muted-foreground block truncate text-xs">{cleanField(a.payload.ad_text) ?? a.payload.landing_domain ?? "—"}</span>
            </span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                tone === "success" ? "bg-success-bg text-success-fg" : "bg-danger-bg text-danger-fg"
              }`}
            >
              {label(days(a))}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
