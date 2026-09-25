import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { searchSpyWithCache } from "@/lib/spyCache";
import { Card } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { CountryFlag, MeterBar, type Tone } from "@/components/dataviz";
import { AdGrid } from "@/components/AdGrid";
import { AdActivityChart } from "./AdActivityChart";
import { SuivreButton } from "./SuivreButton";
import { ajouterAuxProduits } from "../../spy/actions";
import { activityByMonth, countryLabel, formatReach, cleanField, type SpyAd } from "@/lib/spy";
import { getSubscription, InsufficientCreditsError } from "@/lib/credits";
import { ANALYZE_COST, formatCredits } from "@/lib/billing";

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

  // Interstitiel de confirmation du coût (20 crédits) AVANT de payer/analyser.
  // Débit réel uniquement sur cache-miss (rafraîchir une analyse récente = gratuit).
  const sub = userId ? await getSubscription(userId) : null;
  const balance = sub?.credits_balance ?? 0;
  if (sp.confirm !== "1") {
    return (
      <AnalyseGate
        pageId={pageId}
        country={country}
        name={sp.name ?? ""}
        confirmName={confirmName}
        balance={balance}
      />
    );
  }

  let ads: SpyAd[] = [];
  let failed = false;
  let insufficient = false;
  try {
    const res = await searchSpyWithCache(
      { q: "", country, pageId, statut: "active", tri: "anciennete", limit: 100, details: true },
      userId,
      { amount: ANALYZE_COST, reason: "Analyse concurrent" },
    );
    ads = res.ads;
  } catch (e) {
    if (e instanceof InsufficientCreditsError) insufficient = true;
    else failed = true;
  }

  if (insufficient) {
    return (
      <AnalyseGate
        pageId={pageId}
        country={country}
        name={sp.name ?? ""}
        confirmName={confirmName}
        balance={balance}
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

  // Ouvrir la fiche = "j'ai vu" → on remet le badge "nouvelle pub" à zéro.
  if (userId) {
    await supabase
      .from("competitors_watch")
      .update({ new_ads_count: 0 })
      .eq("user_id", userId)
      .eq("page_id", pageId);
  }

  return (
    <div className="space-y-5">
      <Link
        href="/spy"
        className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
      >
        <Icon name="chevronRight" size={14} className="rotate-180" />
        Spy Facebook
      </Link>

      {/* En-tête concurrent — fiche marque */}
      <div className="border-border bg-surface shadow-card rounded-2xl border p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            {/* Avatar = meilleure créative (fallback initiale) */}
            <span className="border-border bg-input relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border">
              {avatarImg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarImg} alt={pageName} className="h-full w-full object-cover" />
              ) : (
                <span className="text-muted-foreground text-lg font-bold">
                  {pageName.slice(0, 2).toUpperCase()}
                </span>
              )}
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-extrabold tracking-tight">{pageName}</h1>
              <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                {domaine && (
                  <span className="flex items-center gap-1">
                    <Icon name="external" size={13} /> {domaine}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <CountryFlag code={country} /> {countryLabel(country)}
                </span>
                <span className="flex items-center gap-1">
                  <Icon name="today" size={13} /> Depuis {formatDate(firstDate)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {likes != null && (
                  <span className="bg-input text-muted-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium">
                    <Icon name="users" size={12} /> {nf.format(likes)} likes
                  </span>
                )}
                {platforms.map((pl) => (
                  <span key={pl} className="bg-secondary text-primary rounded-full px-2 py-0.5 text-xs font-medium">
                    {pl}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <SuivreButton pageId={pageId} pageName={pageName} domaine={domaine} country={country} />
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
                  className="bg-primary text-primary-foreground inline-flex min-h-[40px] items-center gap-1.5 rounded-md px-4 text-sm font-semibold transition-opacity hover:opacity-90"
                >
                  <Icon name="plus" size={16} /> Ajouter à mes produits
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* KPI — uniquement des données réelles issues d'Apify */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Pubs actives" value={nf.format(ads.length)} icon="eye" hint="en diffusion" accent />
        <KpiTile
          label="Audience cumulée"
          value={hasAudience ? formatReach(audience) : "—"}
          icon="users"
          hint={hasAudience ? "portée UE (DSA)" : "hors UE : non publiée"}
        />
        <KpiTile
          label="Créatives vidéo"
          value={videosPct == null ? "—" : `${videosPct}%`}
          icon="play"
          hint={`${videos} vidéo${videos > 1 ? "s" : ""} / ${images} image${images > 1 ? "s" : ""}`}
        />
        <KpiTile
          label="Ancienneté moy."
          value={ancienneteMoy == null ? "—" : `${ancienneteMoy} j`}
          icon="clock"
          hint="de diffusion par pub"
        />
      </div>

      {/* Graphe activité + répartitions */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wide">
            Activité publicitaire (pubs lancées / mois)
          </p>
          <AdActivityChart data={chart} />
        </Card>
        <Card className="space-y-4 p-5">
          <div>
            <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
              Formats
            </p>
            <BreakRow label="Vidéo" n={videos} total={withMedia.length} tone="primary" />
            <BreakRow label="Image" n={images} total={withMedia.length} tone="muted" />
          </div>
          {(onFacebook > 0 || onInstagram > 0) && (
            <div className="border-border border-t pt-3">
              <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Plateformes
              </p>
              <BreakRow label="Facebook" n={onFacebook} total={ads.length} tone="primary" />
              <BreakRow label="Instagram" n={onInstagram} total={ads.length} tone="warning" />
            </div>
          )}
        </Card>
      </div>

      {/* Créatives */}
      {failed ? (
        <div className="bg-danger-bg text-danger rounded-xl p-4 text-sm">
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

/** Tuile KPI compacte (données réelles). */
function KpiTile({
  label,
  value,
  icon,
  hint,
  accent = false,
}: {
  label: string;
  value: string;
  icon: Parameters<typeof Icon>[0]["name"];
  hint?: string;
  accent?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-muted-foreground text-xs font-medium">{label}</span>
        <span className="bg-input text-muted-foreground grid h-8 w-8 shrink-0 place-items-center rounded-lg">
          <Icon name={icon} size={16} />
        </span>
      </div>
      <p className={`mt-1 text-2xl font-extrabold tabular-nums ${accent ? "text-primary" : "text-foreground"}`}>
        {value}
      </p>
      {hint && <p className="text-muted-foreground mt-0.5 text-[11px]">{hint}</p>}
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
        <span className="text-foreground font-medium">{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {n} · {pct}%
        </span>
      </div>
      <MeterBar value={pct} tone={tone} height={6} />
    </div>
  );
}

/** Interstitiel : confirme le coût (20 crédits) avant d'analyser un concurrent. */
function AnalyseGate({
  pageId,
  country,
  name,
  confirmName,
  balance,
  insufficient = false,
}: {
  pageId: string;
  country: string;
  name: string;
  confirmName: string;
  balance: number;
  insufficient?: boolean;
}) {
  const go = `/analyse/${encodeURIComponent(pageId)}?confirm=1&country=${encodeURIComponent(country)}&name=${encodeURIComponent(name)}`;
  const enough = balance >= ANALYZE_COST && !insufficient;

  return (
    <div className="mx-auto max-w-md space-y-4 py-8">
      <Link href="/spy" className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm">
        <Icon name="chevronRight" size={14} className="rotate-180" />
        Spy Facebook
      </Link>
      <Card className="space-y-4 p-6">
        <div className="flex items-center gap-3">
          <span className="bg-secondary text-secondary-foreground grid h-11 w-11 place-items-center rounded-full">
            <Icon name="search" size={20} />
          </span>
          <div>
            <h1 className="text-lg font-bold">Analyser un concurrent</h1>
            <p className="text-muted-foreground text-sm">{confirmName}</p>
          </div>
        </div>

        <p className="text-sm">
          Cette analyse coûtera <b>{formatCredits(ANALYZE_COST)} crédits</b> — toutes ses pubs actives,
          son activité et son audience cumulée.
        </p>
        <p className="text-muted-foreground text-xs">
          Solde actuel : {formatCredits(balance)} crédits. Gratuit si tu l&apos;as déjà analysé récemment.
        </p>

        {enough ? (
          <Link
            href={go}
            className="bg-primary text-primary-foreground inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-md px-4 text-sm font-semibold transition-opacity hover:opacity-90"
          >
            <Icon name="search" size={16} /> Analyser ({formatCredits(ANALYZE_COST)} crédits)
          </Link>
        ) : (
          <div className="space-y-3">
            <div className="bg-danger-bg text-danger rounded-md p-3 text-sm">
              Crédits insuffisants — recharge des crédits ou passe à une offre supérieure.
            </div>
            <Link
              href="/offres"
              className="bg-primary text-primary-foreground inline-flex min-h-[44px] w-full items-center justify-center rounded-md px-4 text-sm font-semibold"
            >
              Recharger
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}
