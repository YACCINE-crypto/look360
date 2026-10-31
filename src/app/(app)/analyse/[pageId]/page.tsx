import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { searchSpyWithCache } from "@/lib/spyCache";
import { Card } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { CountryFlag, MeterBar, type Tone } from "@/components/dataviz";
import { AdGrid } from "@/components/AdGrid";
import { AdActivityChart } from "./AdActivityChart";
import { SuivreButton } from "./SuivreButton";
import { AudiencePanels } from "./AudiencePanels";
import { mergeEuAudiences } from "@/lib/euAudience";
import { estimateSpend, formatSpendRange, SPEND_METHOD } from "@/lib/spendEstimate";
import { ajouterAuxProduits } from "../../spy/actions";
import { activityByMonth, countryLabel, formatReach, cleanField, type SpyAd } from "@/lib/spy";
import { getSubscription } from "@/lib/credits";
import { reserveSearch, releaseUsage, QuotaError } from "@/lib/usage";
import { planLimits } from "@/lib/billing";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const nf = new Intl.NumberFormat("fr-FR");

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = iso.length <= 10 ? new Date(iso + "T00:00:00") : new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}
function mostFrequent(arr: (string | null)[]): string | null {
  const counts = new Map<string, number>();
  for (const v of arr) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: string | null = null;
  let bestN = 0;
  for (const [v, n] of counts) if (n > bestN) { best = v; bestN = n; }
  return best;
}

export default async function AnalysePage({
  params,
  searchParams,
}: {
  params: Promise<{ pageId: string }>;
  searchParams: Promise<{ country?: string; name?: string; confirm?: string }>;
}) {
  const { pageId } = await params;
  const sp = await searchParams;
  const country = (sp.country || "FR").toUpperCase();
  const confirmName = cleanField(sp.name) ?? "cet annonceur";

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = (claims?.claims?.sub as string | undefined) ?? null;

  // Interstitiel de confirmation AVANT d'analyser (= 1 recherche du mois).
  // Conso réelle seulement sur cache-miss (ré-analyse récente = gratuit).
  const sub = userId ? await getSubscription(userId) : null;
  const plan = sub?.plan ?? "free";
  const canAnalyse = planLimits(plan).monthlySearches > 0;
  if (sp.confirm !== "1") {
    return (
      <AnalyseGate
        pageId={pageId}
        country={country}
        name={sp.name ?? ""}
        confirmName={confirmName}
        canAnalyse={canAnalyse}
      />
    );
  }

  let ads: SpyAd[] = [];
  let failed = false;
  let insufficient = false;
  // Quota v2 : l'analyse = 1 recherche sur 1 marché (la source : pubs actives de
  // l'annonceur). Réservation atomique avant Apify, puis on rend l'unit si le
  // résultat venait du cache.
  try {
    if (userId) await reserveSearch(userId, plan, 1);
    else insufficient = true;
  } catch (e) {
    if (e instanceof QuotaError) insufficient = true;
    else failed = true;
  }
  if (!insufficient && !failed) {
    try {
      const res = await searchSpyWithCache(
        { q: "", country, pageId, statut: "active", tri: "anciennete", limit: 100, details: true },
        userId,
      );
      ads = res.ads;
      if (userId) await releaseUsage(userId, 0, 1 - Math.min(1, res.units));
    } catch {
      failed = true;
      if (userId) await releaseUsage(userId, 1, 1);
    }
  }

  if (insufficient) {
    return (
      <AnalyseGate
        pageId={pageId}
        country={country}
        name={sp.name ?? ""}
        confirmName={confirmName}
        canAnalyse={canAnalyse}
        insufficient
      />
    );
  }

  const pageName = cleanField(sp.name) ?? cleanField(ads[0]?.page_name) ?? "Annonceur";
  const likes = ads.find((a) => a.page_like_count != null)?.page_like_count ?? null;
  const domaine = mostFrequent(ads.map((a) => a.landing_domain));
  const platforms = Array.from(new Set(ads.flatMap((a) => a.platforms)));
  const firstDate = ads.map((a) => a.start_date).filter(Boolean).sort()[0] ?? null;
  const chart = activityByMonth(ads, 12);
  const top = [...ads].sort((a, b) => b.score - a.score)[0] ?? null;

  // Audience cumulée = somme des reach (portée UE réelle, via DSA) de toutes
  // ses pubs. Donnée réelle Apify — null hors UE, donc on n'affiche un chiffre
  // que s'il existe au moins une pub avec un reach.
  const audience = ads.reduce((s, a) => s + (a.reach ?? 0), 0);
  const hasAudience = ads.some((a) => a.reach != null);

  // Agrégats supplémentaires — 100 % données réelles Apify.
  const withMedia = ads.filter((a) => a.media_type !== "none");
  const videos = withMedia.filter((a) => a.media_type === "video").length;
  const images = withMedia.filter((a) => a.media_type === "image").length;
  const videosPct = withMedia.length > 0 ? Math.round((videos / withMedia.length) * 100) : null;
  const joursList = ads.map((a) => a.jours_actifs).filter((j): j is number => j != null);
  const ancienneteMoy =
    joursList.length > 0 ? Math.round(joursList.reduce((s, j) => s + j, 0) / joursList.length) : null;
  const onFacebook = ads.filter((a) => a.platforms.some((p) => /facebook/i.test(p))).length;
  const onInstagram = ads.filter((a) => a.platforms.some((p) => /instagram/i.test(p))).length;
  const avatarImg = top?.thumbnail_url ?? ads.find((a) => a.thumbnail_url)?.thumbnail_url ?? null;

  // Audience UE détaillée (âge, sexe, pays) — somme des pubs de l'annonceur.
  const euAudience = mergeEuAudiences(ads.map((a) => a.eu_audience));
  // Dépense : chiffre Meta s'il existe (rare), sinon fourchette ESTIMÉE (UE).
  const realSpend = ads.filter((a) => a.spend).length;
  const est = ads.reduce(
    (acc, a) => {
      const e = a.spend ? null : estimateSpend(a.reach, a.country ?? country);
      return e ? { low: acc.low + e.low, high: acc.high + e.high, n: acc.n + 1 } : acc;
    },
    { low: 0, high: 0, n: 0 },
  );
  const libraryUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${encodeURIComponent(country)}&view_all_page_id=${encodeURIComponent(pageId)}`;

  // Ouvrir la fiche = "j'ai vu" → on remet le badge "nouvelle pub" à zéro.
  if (userId) {
    await supabase
      .from("competitors_watch")
      .update({ new_ads_count: 0 })
      .eq("user_id", userId)
      .eq("page_id", pageId);
  }

  return (
    <div className="space-y-4">
      {/* En-tête annonceur */}
      <div className="border-border bg-surface shadow-card rounded-xl border">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/spy"
              aria-label="Retour au Spy"
              className="text-muted-foreground hover:bg-input hover:text-fg grid h-9 w-9 shrink-0 place-items-center rounded-md"
            >
              <Icon name="chevronRight" size={16} className="rotate-180" />
            </Link>
            <span className="border-border bg-input grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg border">
              {avatarImg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarImg} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-muted-foreground text-sm font-bold">{pageName.slice(0, 2).toUpperCase()}</span>
              )}
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold tracking-tight">{pageName}</h1>
              {domaine && <p className="text-muted-foreground truncate text-sm">{domaine}</p>}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <SuivreButton pageId={pageId} pageName={pageName} domaine={domaine} country={country} />
            <a
              href={libraryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="border-border hover:bg-input inline-flex min-h-10 items-center gap-1.5 rounded-md border px-3 text-sm font-medium"
            >
              <Icon name="external" size={15} /> Ad Library
            </a>
            {top && (
              <form action={ajouterAuxProduits}>
                <input type="hidden" name="nom" value={pageName} />
                <input type="hidden" name="image_url" value={top.thumbnail_url ?? top.media_url ?? ""} />
                <input type="hidden" name="landing_url" value={top.landing_url ?? ""} />
                <input type="hidden" name="ad_library_url" value={top.ad_library_url} />
                <input type="hidden" name="ad_text" value={top.ad_text ?? ""} />
                <input type="hidden" name="marche" value={top.country ?? ""} />
                <button
                  type="submit"
                  className="bg-accent text-accent-on hover:bg-accent-hover inline-flex min-h-10 items-center gap-1.5 rounded-md px-4 text-sm font-semibold transition-colors"
                >
                  <Icon name="plus" size={16} /> Ajouter à mes produits
                </button>
              </form>
            )}
          </div>
        </div>
        {/* Méta-données (données réelles) */}
        <div className="border-border-soft text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t px-4 py-2.5 text-xs">
          <span className="flex items-center gap-1.5">
            <CountryFlag code={country} /> {countryLabel(country)}
          </span>
          <span className="flex items-center gap-1.5">
            <Icon name="today" size={13} /> Première pub active : {formatDate(firstDate)}
          </span>
          {likes != null && (
            <span className="flex items-center gap-1.5">
              <Icon name="users" size={13} /> {nf.format(likes)} abonnés
            </span>
          )}
          {platforms.length > 0 && <span>{platforms.join(" · ")}</span>}
        </div>
      </div>

      {/* Chiffres clés */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Pubs actives" value={nf.format(ads.length)} hint="en diffusion aujourd'hui" accent />
        <KpiTile
          label="Audience UE"
          value={hasAudience ? formatReach(audience) : "—"}
          hint={hasAudience ? "personnes touchées (Meta, DSA)" : "publiée seulement pour l'UE"}
        />
        <KpiTile
          label={realSpend > 0 && est.n === 0 ? "Dépense (Meta)" : "Dépense estimée"}
          value={est.n > 0 ? formatSpendRange({ low: est.low, high: est.high, currency: "EUR", cpm: [0, 0] }) : "—"}
          hint={est.n > 0 ? `estimation sur ${est.n} pub${est.n > 1 ? "s" : ""} UE` : "non publiée par Meta hors UE"}
          title={SPEND_METHOD}
          badge={est.n > 0 ? "estimation" : undefined}
        />
        <KpiTile
          label="Ancienneté moyenne"
          value={ancienneteMoy == null ? "—" : `${ancienneteMoy} j`}
          hint="de diffusion par pub"
        />
      </div>

      {/* Activité + formats */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="text-fg mb-3 text-sm font-semibold">Pubs lancées par mois</h2>
          <AdActivityChart data={chart} />
        </Card>
        <Card className="space-y-4 p-5">
          <div>
            <h2 className="text-fg mb-2 text-sm font-semibold">Formats</h2>
            <BreakRow label="Vidéo" n={videos} total={withMedia.length} tone="primary" />
            <BreakRow label="Image" n={images} total={withMedia.length} tone="muted" />
            {videosPct != null && (
              <p className="text-muted-foreground mt-1 text-xs">{videosPct} % de créatives vidéo</p>
            )}
          </div>
          {(onFacebook > 0 || onInstagram > 0) && (
            <div className="border-border-soft border-t pt-3">
              <h2 className="text-fg mb-2 text-sm font-semibold">Plateformes</h2>
              <BreakRow label="Facebook" n={onFacebook} total={ads.length} tone="primary" />
              <BreakRow label="Instagram" n={onInstagram} total={ads.length} tone="warning" />
            </div>
          )}
        </Card>
      </div>

      {/* Audience UE réelle */}
      {!failed && ads.length > 0 && <AudiencePanels audience={euAudience} totalReach={hasAudience ? audience : null} />}

      {/* Créatives */}
      {failed ? (
        <div className="bg-danger-bg text-danger-fg rounded-xl p-4 text-sm">
          Impossible de récupérer les pubs de cette page pour le moment. Réessaie
          dans un instant.
        </div>
      ) : ads.length === 0 ? (
        <div className="border-border bg-surface rounded-xl border border-dashed p-12 text-center">
          <p className="text-muted-foreground text-sm">
            Aucune pub active trouvée pour cette page (ou throttling Meta temporaire).
            Réessaie un peu plus tard.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="font-semibold">Créatives actives ({ads.length})</h2>
          <AdGrid ads={ads} />
        </div>
      )}
    </div>
  );
}

/** Tuile KPI compacte. */
function KpiTile({
  label,
  value,
  hint,
  accent = false,
  title,
  badge,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
  title?: string;
  badge?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2" title={title}>
        <span className="text-muted-foreground text-xs font-medium">{label}</span>
        {badge && (
          <span className="border-border text-muted-foreground cursor-help rounded border px-1.5 text-xs">{badge}</span>
        )}
      </div>
      <p className={`mt-1 truncate text-2xl font-bold tabular-nums ${accent ? "text-accent" : "text-fg"}`}>{value}</p>
      {hint && <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>}
    </Card>
  );
}

/** Ligne de répartition : libellé + compteur + jauge de proportion. */
function BreakRow({
  label,
  n,
  total,
  tone,
}: {
  label: string;
  n: number;
  total: number;
  tone: Tone;
}) {
  const pct = total > 0 ? Math.round((n / total) * 100) : 0;
  return (
    <div className="mb-2 last:mb-0">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-fg font-medium">{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {n} · {pct}%
        </span>
      </div>
      <MeterBar value={pct} tone={tone} height={6} />
    </div>
  );
}

/** Interstitiel : confirme l'analyse d'un concurrent (= 1 recherche du mois). */
function AnalyseGate({
  pageId,
  country,
  name,
  confirmName,
  canAnalyse,
  insufficient = false,
}: {
  pageId: string;
  country: string;
  name: string;
  confirmName: string;
  canAnalyse: boolean;
  insufficient?: boolean;
}) {
  const go = `/analyse/${encodeURIComponent(pageId)}?confirm=1&country=${encodeURIComponent(country)}&name=${encodeURIComponent(name)}`;
  const allowed = canAnalyse && !insufficient;

  return (
    <div className="mx-auto max-w-md space-y-4 py-8">
      <Link href="/spy" className="text-muted-foreground hover:text-fg flex items-center gap-1 text-sm">
        <Icon name="chevronRight" size={14} className="rotate-180" />
        Spy Facebook
      </Link>
      <Card className="space-y-4 p-6">
        <div className="flex items-center gap-3">
          <span className="bg-secondary text-accent grid h-11 w-11 place-items-center rounded-full">
            <Icon name="search" size={20} />
          </span>
          <div>
            <h1 className="text-lg font-bold">Analyser un concurrent</h1>
            <p className="text-muted-foreground text-sm">{confirmName}</p>
          </div>
        </div>

        <p className="text-sm">
          Cette analyse utilise <b>1 de tes recherches du mois</b> — toutes ses pubs actives,
          son activité et son audience cumulée.
        </p>
        <p className="text-muted-foreground text-xs">
          Gratuit si tu l&apos;as déjà analysé récemment (cache).
        </p>

        {allowed ? (
          <Link
            href={go}
            className="bg-accent text-accent-on inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-md px-4 text-sm font-semibold transition-opacity hover:opacity-90"
          >
            <Icon name="search" size={16} /> Analyser ce concurrent
          </Link>
        ) : (
          <div className="space-y-3">
            <div className="bg-danger-bg text-danger-fg rounded-md p-3 text-sm">
              {!canAnalyse
                ? "L'analyse de concurrent est réservée aux offres payantes. Passe en Starter pour l'utiliser."
                : "Tu as atteint ta limite de recherches ce mois-ci. Passe à une offre supérieure pour continuer."}
            </div>
            <Link
              href="/offres"
              className="bg-accent text-accent-on inline-flex min-h-[44px] w-full items-center justify-center rounded-md px-4 text-sm font-semibold"
            >
              Voir les offres
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}
