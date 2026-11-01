"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { CountryFlag, MeterBar, type Tone } from "@/components/dataviz";
import { AdGrid } from "@/components/AdGrid";
import { AdActivityChart } from "./AdActivityChart";
import { SuivreButton } from "./SuivreButton";
import { AudiencePanels } from "./AudiencePanels";
import { ShopSummary } from "./ShopSummary";
import { ajouterAuxProduits } from "../../spy/actions";
import { activityByMonth, countryLabel, formatReach, cleanField, type SpyAd } from "@/lib/spy";
import { mergeEuAudiences } from "@/lib/euAudience";
import { estimateSpend, formatSpendRange, SPEND_METHOD } from "@/lib/spendEstimate";

const nf = new Intl.NumberFormat("fr-FR");

type Msg =
  | { type: "ads"; ads: SpyAd[] }
  | { type: "progress"; found: number }
  | { type: "done"; cached?: boolean; total?: number; partial?: boolean }
  | { type: "error"; status?: number; message?: string };

type State = "loading" | "done" | "error";

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

const memKey = (pageId: string, country: string) => `look360:analyse:${pageId}:${country}`;

/** Analyse d'un annonceur, chargée progressivement (voir /api/analyse/stream). */
export function AnalyseClient({ pageId, country, name }: { pageId: string; country: string; name: string }) {
  const [ads, setAds] = useState<SpyAd[]>([]);
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState<string | null>(null);
  const [partial, setPartial] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const started = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const t0 = Date.now();
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 1000);
    (async () => {
      const map = new Map<string, SpyAd>();
      // Retour sur une analyse déjà ouverte dans cet onglet → affichage immédiat.
      try {
        const raw = sessionStorage.getItem(memKey(pageId, country));
        const saved = raw ? (JSON.parse(raw) as { ads: SpyAd[]; at: number }) : null;
        if (saved?.ads?.length && Date.now() - saved.at < 12 * 3600_000) {
          setAds(saved.ads);
          setState("done");
          clearInterval(timer);
          return;
        }
      } catch {
        /* stockage indisponible */
      }
      try {
        const res = await fetch("/api/analyse/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageId, country }),
        });
        if (!res.ok || !res.body) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error || "Analyse impossible pour le moment.");
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let gotDone = false;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const ln of lines) {
            if (!ln.trim()) continue;
            let msg: Msg;
            try {
              msg = JSON.parse(ln) as Msg;
            } catch {
              continue;
            }
            if (msg.type === "ads") {
              for (const a of msg.ads) map.set(a.ad_archive_id, a);
              setAds([...map.values()]);
            } else if (msg.type === "done") {
              gotDone = true;
              setPartial(Boolean(msg.partial));
            } else if (msg.type === "error") {
              setError(msg.message || "Analyse impossible pour le moment.");
              setState("error");
              return;
            }
          }
        }
        if (!gotDone && map.size === 0) throw new Error("La connexion a été coupée. Réessaie.");
        setState("done");
        if (map.size > 0) {
          try {
            sessionStorage.setItem(memKey(pageId, country), JSON.stringify({ ads: [...map.values()], at: Date.now() }));
          } catch {
            /* quota de stockage */
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Analyse impossible pour le moment.");
        setState(map.size > 0 ? "done" : "error");
      } finally {
        clearInterval(timer);
      }
    })();
    return () => clearInterval(timer);
  }, [pageId, country]);

  const a = useMemo(() => {
    const sorted = [...ads].sort((x, y) => (y.jours_actifs ?? 0) - (x.jours_actifs ?? 0));
    const top = [...ads].sort((x, y) => y.score - x.score)[0] ?? null;
    const withMedia = ads.filter((x) => x.media_type !== "none");
    const videos = withMedia.filter((x) => x.media_type === "video").length;
    const images = withMedia.filter((x) => x.media_type === "image").length;
    const jours = ads.map((x) => x.jours_actifs).filter((j): j is number => j != null);
    const est = ads.reduce(
      (acc, x) => {
        const e = x.spend ? null : estimateSpend(x.reach, x.country ?? country);
        return e ? { low: acc.low + e.low, high: acc.high + e.high, n: acc.n + 1 } : acc;
      },
      { low: 0, high: 0, n: 0 },
    );
    return {
      sorted,
      top,
      pageName: cleanField(name) ?? cleanField(ads[0]?.page_name) ?? "Annonceur",
      likes: ads.find((x) => x.page_like_count != null)?.page_like_count ?? null,
      domaine: mostFrequent(ads.map((x) => x.landing_domain)),
      platforms: Array.from(new Set(ads.flatMap((x) => x.platforms))),
      firstDate: ads.map((x) => x.start_date).filter(Boolean).sort()[0] ?? null,
      chart: activityByMonth(ads, 12),
      audience: ads.reduce((s, x) => s + (x.reach ?? 0), 0),
      hasAudience: ads.some((x) => x.reach != null),
      videos,
      images,
      withMedia: withMedia.length,
      videosPct: withMedia.length > 0 ? Math.round((videos / withMedia.length) * 100) : null,
      ancienneteMoy: jours.length > 0 ? Math.round(jours.reduce((s, j) => s + j, 0) / jours.length) : null,
      onFacebook: ads.filter((x) => x.platforms.some((p) => /facebook/i.test(p))).length,
      onInstagram: ads.filter((x) => x.platforms.some((p) => /instagram/i.test(p))).length,
      avatar: top?.thumbnail_url ?? ads.find((x) => x.thumbnail_url)?.thumbnail_url ?? null,
      eu: mergeEuAudiences(ads.map((x) => x.eu_audience)),
      est,
    };
  }, [ads, name, country]);

  const loading = state === "loading";
  const libraryUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${encodeURIComponent(country)}&view_all_page_id=${encodeURIComponent(pageId)}`;

  return (
    <div className="space-y-4">
      {/* En-tête annonceur */}
      <div className="border-border bg-surface shadow-card rounded-xl border">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => (history.length > 1 ? router.back() : router.push("/spy"))}
              aria-label="Retour"
              className="text-muted-foreground hover:bg-input hover:text-fg grid h-9 w-9 shrink-0 place-items-center rounded-md"
            >
              <Icon name="chevronRight" size={16} className="rotate-180" />
            </button>
            <span className="border-border bg-input grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg border">
              {a.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-muted-foreground text-sm font-bold">{a.pageName.slice(0, 2).toUpperCase()}</span>
              )}
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold tracking-tight">{a.pageName}</h1>
              {a.domaine && <p className="text-muted-foreground truncate text-sm">{a.domaine}</p>}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <SuivreButton pageId={pageId} pageName={a.pageName} domaine={a.domaine} country={country} />
            <a
              href={libraryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="border-border hover:bg-input inline-flex min-h-10 items-center gap-1.5 rounded-md border px-3 text-sm font-medium"
            >
              <Icon name="external" size={15} /> Ad Library
            </a>
            {a.top && (
              <form action={ajouterAuxProduits}>
                <input type="hidden" name="nom" value={a.pageName} />
                <input type="hidden" name="image_url" value={a.top.thumbnail_url ?? a.top.media_url ?? ""} />
                <input type="hidden" name="landing_url" value={a.top.landing_url ?? ""} />
                <input type="hidden" name="ad_library_url" value={a.top.ad_library_url} />
                <input type="hidden" name="ad_text" value={a.top.ad_text ?? ""} />
                <input type="hidden" name="marche" value={a.top.country ?? ""} />
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
        <div className="border-border-soft text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t px-4 py-2.5 text-xs">
          <span className="flex items-center gap-1.5">
            <CountryFlag code={country} /> {countryLabel(country)}
          </span>
          {a.firstDate && (
            <span className="flex items-center gap-1.5">
              <Icon name="today" size={13} /> Première pub active : {formatDate(a.firstDate)}
            </span>
          )}
          {a.likes != null && (
            <span className="flex items-center gap-1.5">
              <Icon name="users" size={13} /> {nf.format(a.likes)} abonnés
            </span>
          )}
          {a.platforms.length > 0 && <span>{a.platforms.join(" · ")}</span>}
        </div>
      </div>

      {/* Progression */}
      {loading && (
        <div className="bg-secondary text-secondary-foreground flex items-center gap-3 rounded-xl px-4 py-3 text-sm" role="status">
          <span className="border-accent h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-t-transparent" />
          <span>
            Analyse en cours… <b className="tabular-nums">{ads.length}</b> pub{ads.length > 1 ? "s" : ""} récupérée
            {ads.length > 1 ? "s" : ""} ({elapsed} s).
            {elapsed > 20 && "Pour une marque européenne, l'audience détaillée peut prendre 1 à 3 minutes."}
          </span>
        </div>
      )}
      {error && state === "error" && (
        <div className="bg-danger-bg text-danger-fg flex flex-wrap items-center justify-between gap-3 rounded-xl p-4 text-sm">
          <span>{error}</span>
          {/limite|offres payantes/i.test(error) ? (
            <Link href="/offres" className="bg-accent text-accent-on rounded-md px-3 py-1.5 font-semibold">
              Voir les offres
            </Link>
          ) : (
            <button onClick={() => location.reload()} className="border-danger-fg rounded-md border px-3 py-1.5 font-semibold">
              Réessayer
            </button>
          )}
        </div>
      )}
      {partial && state === "done" && (
        <p className="text-muted-foreground text-xs">
          Analyse partielle : Meta a mis trop de temps à répondre, seules les pubs récupérées sont affichées.
        </p>
      )}

      {(ads.length > 0 || loading) && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiTile label="Pubs actives" value={ads.length ? nf.format(ads.length) : "…"} hint="en diffusion aujourd'hui" accent />
            <KpiTile
              label="Audience UE"
              value={a.hasAudience ? formatReach(a.audience) : loading ? "…" : "—"}
              hint={a.hasAudience ? "personnes touchées (Meta, DSA)" : "publiée seulement pour l'UE"}
            />
            <KpiTile
              label="Dépense estimée"
              value={a.est.n > 0 ? formatSpendRange({ low: a.est.low, high: a.est.high, currency: "EUR", cpm: [0, 0] }) : loading ? "…" : "—"}
              hint={a.est.n > 0 ? `estimation sur ${a.est.n} pub${a.est.n > 1 ? "s" : ""} UE` : "non publiée par Meta hors UE"}
              title={SPEND_METHOD}
              badge={a.est.n > 0 ? "estimation" : undefined}
            />
            <KpiTile label="Ancienneté moyenne" value={a.ancienneteMoy == null ? (loading ? "…" : "—") : `${a.ancienneteMoy} j`} hint="de diffusion par pub" />
          </div>

          {ads.length > 0 && (
            <>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <Card className="p-5 lg:col-span-2">
                  <h2 className="text-fg mb-3 text-sm font-semibold">Pubs lancées par mois</h2>
                  <AdActivityChart data={a.chart} />
                </Card>
                <Card className="space-y-4 p-5">
                  <div>
                    <h2 className="text-fg mb-2 text-sm font-semibold">Formats</h2>
                    <BreakRow label="Vidéo" n={a.videos} total={a.withMedia} tone="primary" />
                    <BreakRow label="Image" n={a.images} total={a.withMedia} tone="muted" />
                    {a.videosPct != null && <p className="text-muted-foreground mt-1 text-xs">{a.videosPct} % de créatives vidéo</p>}
                  </div>
                  {(a.onFacebook > 0 || a.onInstagram > 0) && (
                    <div className="border-border-soft border-t pt-3">
                      <h2 className="text-fg mb-2 text-sm font-semibold">Plateformes</h2>
                      <BreakRow label="Facebook" n={a.onFacebook} total={ads.length} tone="primary" />
                      <BreakRow label="Instagram" n={a.onInstagram} total={ads.length} tone="warning" />
                    </div>
                  )}
                </Card>
              </div>

              {!loading && <AudiencePanels audience={a.eu} totalReach={a.hasAudience ? a.audience : null} />}

              {!loading && a.domaine && <ShopSummary domain={a.domaine} />}

              <div className="space-y-3">
                <h2 className="font-semibold">Créatives actives ({ads.length})</h2>
                <AdGrid ads={a.sorted} />
              </div>
            </>
          )}
        </>
      )}

      {state === "done" && ads.length === 0 && !error && (
        <div className="border-border bg-surface rounded-xl border border-dashed p-12 text-center">
          <p className="text-muted-foreground text-sm">
            Aucune pub active trouvée pour cet annonceur sur ce marché (ou Meta limite temporairement les accès). Réessaie un peu plus tard.
          </p>
        </div>
      )}
    </div>
  );
}

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
        {badge && <span className="border-border text-muted-foreground cursor-help rounded border px-1.5 text-xs">{badge}</span>}
      </div>
      <p className={`mt-1 truncate text-2xl font-bold tabular-nums ${accent ? "text-accent" : "text-fg"}`}>{value}</p>
      {hint && <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>}
    </Card>
  );
}

function BreakRow({ label, n, total, tone }: { label: string; n: number; total: number; tone: Tone }) {
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
