"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { FilterPill, FilterToggle, OptionList, PanelHead, type PillOption } from "@/components/FilterPill";
import { CountryMultiSelect } from "@/components/CountryMultiSelect";
import { CreativeMedia } from "@/components/CreativeMedia";
import { VideoLightbox, type PlayRequest } from "@/components/VideoLightbox";
import { EmptyState } from "@/components/EmptyState";
import { Search } from "lucide-react";
import { ajouterAuxProduits } from "./actions";
import { suivreConcurrent } from "../surveillance/actions";
import {
  isEUCountry,
  formatReach,
  countryLabel,
  landingKind,
  LANDING_LABEL,
  cleanField,
  type SpyAd,
} from "@/lib/spy";
import { useCanDownload } from "@/components/PlanProvider";
import { estimateSpend, formatSpendRange, SPEND_METHOD } from "@/lib/spendEstimate";

const nf = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

const PLATFORM_OPTS: PillOption[] = [
  { value: "", label: "Toutes" },
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
];
const MEDIA_OPTS: PillOption[] = [
  { value: "all", label: "Tout" },
  { value: "video", label: "Vidéo", icon: "play" },
  { value: "image", label: "Image", icon: "image" },
];
const REACH_OPTS: PillOption[] = [
  { value: "0", label: "Tous" },
  { value: "50000", label: "+ 50 000" },
  { value: "100000", label: "+ 100 000" },
  { value: "500000", label: "+ 500 000" },
  { value: "1000000", label: "+ 1 000 000" },
];
const VARIANTS_OPTS: PillOption[] = [
  { value: "0", label: "Toutes" },
  { value: "2", label: "2 et plus", hint: "Le vendeur décline déjà sa pub" },
  { value: "3", label: "3 et plus" },
  { value: "5", label: "5 et plus", hint: "Produit travaillé en profondeur" },
];
const ADVERTISER_OPTS: PillOption[] = [
  { value: "0", label: "Tous les annonceurs" },
  { value: "5", label: "5+ pubs actives", hint: "Le vendeur teste plusieurs pubs", icon: "flask" },
  { value: "10", label: "10+ pubs actives", hint: "Il met du budget : il scale", icon: "trending" },
  { value: "20", label: "20+ pubs actives", hint: "Gros annonceur, produit rodé", icon: "crown" },
];

/** Durée de diffusion : sélection rapide (jours depuis le lancement). */
type Duration = { min: number; max: number | null };
const DURATION_PRESETS: { key: string; label: string; hint: string; icon: "flask" | "check" | "trophy"; d: Duration }[] = [
  { key: "debutant", label: "Débutant", hint: "Nouvelles pubs en phase de test", icon: "flask", d: { min: 0, max: 7 } },
  { key: "valide", label: "Validé", hint: "Pubs qui ont prouvé leur rentabilité", icon: "check", d: { min: 7, max: 30 } },
  { key: "evergreen", label: "Evergreen", hint: "Gagnantes actives depuis longtemps", icon: "trophy", d: { min: 30, max: null } },
];
const NO_DURATION: Duration = { min: 0, max: null };
const durationOn = (d: Duration) => d.min > 0 || d.max != null;
function durationLabel(d: Duration): string {
  const p = DURATION_PRESETS.find((x) => x.d.min === d.min && x.d.max === d.max);
  if (p) return p.label;
  if (d.max == null) return `${d.min}+ j`;
  return `${d.min}–${d.max} j`;
}

const DEFAULT_LIMIT = 36;

type StreamMsg =
  | { type: "ads"; ads: SpyAd[] }
  | { type: "progress"; found: number }
  | { type: "done"; cached?: boolean; total?: number; took_ms?: number }
  | { type: "error"; status?: number; message?: string };

/** Tri client (identique au serveur) pour la fusion progressive des lots. */
function sortAds(list: SpyAd[], t: string): SpyAd[] {
  return [...list].sort((x, y) => {
    if (t === "reach") return (y.reach ?? 0) - (x.reach ?? 0);
    if (t === "anciennete") return (y.jours_actifs ?? 0) - (x.jours_actifs ?? 0);
    if (t === "variants") return y.variants_count - x.variants_count;
    return y.score - x.score;
  });
}

type Status = "idle" | "loading" | "done" | "error";

/** Dernière recherche Spy de l'onglet : restaurée au retour d'une analyse. */
const SPY_STORE = "look360:spy:last";
const SPY_SCROLL = "look360:spy:scroll";
function scroller(): HTMLElement | null {
  return document.querySelector("main");
}

export function SpyClient({
  searchesUsed = 0,
  searchesLimit = 0,
  maxMarkets = 0,
  initialFeed = [],
}: {
  searchesUsed?: number;
  searchesLimit?: number;
  maxMarkets?: number;
  plan?: string;
  initialFeed?: SpyAd[];
}) {
  const params = useSearchParams();
  const [used, setUsed] = useState(searchesUsed);
  const [q, setQ] = useState("");
  const [countries, setCountries] = useState<string[]>(() => {
    const c = (params.get("country") || "FR").toUpperCase();
    return [c];
  });
  const [platform, setPlatform] = useState("");
  const [statut, setStatut] = useState("active");
  const [mediaType, setMediaType] = useState("all");
  const [duration, setDuration] = useState<Duration>(NO_DURATION);
  const [advMin, setAdvMin] = useState("0");
  const [cod, setCod] = useState(false);
  /** Domaines déjà vérifiés → COD ou non (filtre « Paiement à la livraison »). */
  const [codMap, setCodMap] = useState<Record<string, boolean>>({});
  const [reachMin, setReachMin] = useState("0");
  const [variantsMin, setVariantsMin] = useState("0");
  const [tri, setTri] = useState("score");

  const [status, setStatus] = useState<Status>("idle");
  const [ads, setAds] = useState<SpyAd[]>([]);
  const [cached, setCached] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<PlayRequest | null>(null);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [progress, setProgress] = useState(0);
  const router = useRouter();

  const jsonHeaders = { "Content-Type": "application/json" };

  // Restaure la dernière recherche (et la position) au retour sur le Spy.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try {
        const raw = sessionStorage.getItem(SPY_STORE);
        if (!raw) return;
        const v = JSON.parse(raw) as Record<string, unknown> & { ads?: SpyAd[] };
        if (!Array.isArray(v.ads) || v.ads.length === 0) return;
        setQ(String(v.q ?? ""));
        if (Array.isArray(v.countries) && v.countries.length) setCountries(v.countries as string[]);
        setPlatform(String(v.platform ?? ""));
        setStatut(String(v.statut ?? "active"));
        setMediaType(String(v.mediaType ?? "all"));
        if (v.duration && typeof v.duration === "object") setDuration(v.duration as Duration);
        setAdvMin(String(v.advMin ?? "0"));
        setCod(Boolean(v.cod));
        setReachMin(String(v.reachMin ?? "0"));
        setVariantsMin(String(v.variantsMin ?? "0"));
        setTri(String(v.tri ?? "score"));
        setLimit(Number(v.limit) || DEFAULT_LIMIT);
        setAds(v.ads);
        setCached(Boolean(v.cached));
        setStatus("done");
        const y = Number(sessionStorage.getItem(SPY_SCROLL) || 0);
        if (y > 0) {
          // Après le rendu des cartes restaurées.
          setTimeout(() => scroller()?.scrollTo({ top: y }), 50);
        }
      } catch {
        /* stockage indisponible */
      }
    });
    return () => cancelAnimationFrame(id);
  }, []);

  // Mémorise la recherche terminée (onglet courant uniquement).
  useEffect(() => {
    if (status !== "done" || ads.length === 0) return;
    try {
      sessionStorage.setItem(
        SPY_STORE,
        JSON.stringify({ q, countries, platform, statut, mediaType, duration, advMin, cod, reachMin, variantsMin, tri, limit, ads, cached }),
      );
    } catch {
      /* quota de stockage */
    }
  }, [status, ads, q, countries, platform, statut, mediaType, duration, advMin, cod, reachMin, variantsMin, tri, limit, cached]);

  // Paiement à la livraison : vérifie les boutiques des pubs (catalogue Look360).
  const shopDomains = useMemo(
    () => [...new Set(ads.filter((a) => a.landing_kind === "shop" && a.landing_domain).map((a) => a.landing_domain as string))],
    [ads],
  );
  const [codLoading, setCodLoading] = useState(false);
  useEffect(() => {
    if (!cod) return;
    const todo = shopDomains.filter((d) => !(d in codMap));
    if (todo.length === 0) return;
    let alive = true;
    const id = requestAnimationFrame(() => setCodLoading(true));
    fetch("/api/shops/cod", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domains: todo }) })
      .then((r) => (r.ok ? r.json() : { cod: [] }))
      .then((d: { cod?: string[] }) => {
        if (!alive) return;
        const yes = new Set(d.cod ?? []);
        setCodMap((m) => ({ ...m, ...Object.fromEntries(todo.map((x) => [x, yes.has(x)])) }));
      })
      .catch(() => undefined)
      .finally(() => alive && setCodLoading(false));
    return () => {
      alive = false;
      cancelAnimationFrame(id);
    };
  }, [cod, shopDomains, codMap]);

  // Filtres d'affinage : appliqués instantanément aux résultats (sans nouvelle recherche).
  const advN = Number(advMin) || 0;
  const visible = useMemo(
    () =>
      ads.filter((a) => {
        const j = a.jours_actifs ?? 0;
        if (j < duration.min) return false;
        if (duration.max != null && j > duration.max) return false;
        if (advN && (a.page_active_ads_count ?? 0) < advN) return false;
        if (cod && !(a.landing_domain && codMap[a.landing_domain])) return false;
        return true;
      }),
    [ads, duration, advN, cod, codMap],
  );
  const hidden = ads.length - visible.length;
  const refineOn = durationOn(duration) || advN > 0 || cod;
  const anyFilter = refineOn || platform !== "" || mediaType !== "all" || reachMin !== "0" || variantsMin !== "0" || statut === "all";
  function resetFilters() {
    setDuration(NO_DURATION);
    setAdvMin("0");
    setCod(false);
    setPlatform("");
    setMediaType("all");
    setReachMin("0");
    setVariantsMin("0");
    setStatut("active");
  }

  const euDispo = countries.some(isEUCountry);
  const moreCount = [platform !== "", variantsMin !== "0", euDispo && reachMin !== "0", statut === "all"].filter(Boolean).length;
  const markets = Math.max(1, countries.length);

  const triOpts: PillOption[] = useMemo(
    () => [
      { value: "score", label: "Score gagnant" },
      ...(euDispo ? [{ value: "reach", label: "Reach" }] : []),
      { value: "anciennete", label: "Ancienneté" },
      { value: "variants", label: "Nb variantes" },
    ],
    [euDispo],
  );

  function payloadFor(searchLimit: number) {
    return {
      q,
      platform,
      statut,
      mediaType,
      // Durée appliquée côté écran (affinage instantané, cache partagé).
      ancienneteMin: 0,
      reachMin: euDispo ? Number(reachMin) || 0 : 0,
      variantsMin: Number(variantsMin) || 0,
      tri,
      limit: searchLimit,
    };
  }

  // Repli sans streaming (multi-pays ou si le flux échoue) : JSON classique.
  async function runSearchJson(searchLimit: number) {
    try {
      const res = await fetch("/api/spy/search", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ ...payloadFor(searchLimit), countries }),
      });
      const data = await res.json();
      if (res.status === 402) {
        setError(data?.error || "Limite atteinte pour ton offre.");
        setStatus("error");
        return;
      }
      if (!res.ok) throw new Error(data?.error || "Recherche impossible.");
      setAds(sortAds(data.ads ?? [], tri));
      setCached(Boolean(data.cached));
      if (data.usage?.searches_used != null) setUsed(data.usage.searches_used);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue.");
      setStatus("error");
    }
  }

  async function runSearch(searchLimit = limit) {
    try {
      sessionStorage.removeItem(SPY_SCROLL);
    } catch {
      /* ignore */
    }
    setStatus("loading");
    setError(null);
    setProgress(0);
    setAds([]);
    setCached(false);

    // Multi-pays → fan-out JSON (pas de streaming).
    if (countries.length > 1) {
      await runSearchJson(searchLimit);
      return;
    }

    // Un pays → streaming progressif (cartes affichées au fur et à mesure).
    try {
      const res = await fetch("/api/spy/search/stream", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ ...payloadFor(searchLimit), country: countries[0] }),
      });
      if (!res.ok || !res.body) {
        await runSearchJson(searchLimit);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const map = new Map<string, SpyAd>();
      let buf = "";
      let errored = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const ln of lines) {
          if (!ln.trim()) continue;
          let msg: StreamMsg;
          try {
            msg = JSON.parse(ln) as StreamMsg;
          } catch {
            continue;
          }
          if (msg.type === "ads") {
            for (const a of msg.ads) map.set(a.ad_archive_id, a);
            setAds(sortAds([...map.values()], tri));
          } else if (msg.type === "progress") {
            setProgress(msg.found ?? map.size);
          } else if (msg.type === "done") {
            setCached(Boolean(msg.cached));
            if (!msg.cached) setUsed((u) => u + 1);
          } else if (msg.type === "error") {
            errored = true;
            // Plafond (429) ou crédits insuffisants (402) → on s'arrête, pas de repli.
            if (msg.status === 429 || msg.status === 402) {
              setError(msg.message || "Recherche indisponible.");
              setStatus("error");
              return;
            }
          }
        }
      }

      // Flux terminé sans rien renvoyer → repli JSON (robustesse).
      if (errored && map.size === 0) {
        await runSearchJson(searchLimit);
        return;
      }
      setStatus("done");
    } catch {
      await runSearchJson(searchLimit);
    }
  }

  function chargerPlus() {
    const next = limit < 72 ? 72 : 100;
    setLimit(next);
    runSearch(next);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (countries.length === 0) {
      setError("Choisis au moins un pays.");
      setStatus("error");
      return;
    }
    // Recherche lancée immédiatement (le quota restant reste visible en haut).
    runSearch();
  }

  function analyze(ad: SpyAd) {
    if (!ad.page_id) return;
    try {
      sessionStorage.setItem(SPY_SCROLL, String(scroller()?.scrollTop ?? 0));
    } catch {
      /* ignore */
    }
    router.push(
      `/analyse/${ad.page_id}?country=${encodeURIComponent(ad.country ?? "FR")}&name=${encodeURIComponent(ad.page_name ?? "")}`,
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Spy Facebook"
        subtitle="Trouve des pubs qui tournent déjà — signaux réels de la bibliothèque Meta."
      />

      <form onSubmit={submit} className="border-border bg-surface space-y-3 rounded-xl border p-3 shadow-card sm:p-4">
        {/* Recherche */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="border-border bg-input focus-within:border-accent focus-within:shadow-focus flex min-h-11 flex-1 items-center gap-2 rounded-lg border px-3 transition-colors">
            <Icon name="search" size={16} className="text-muted-foreground shrink-0" />
            <span className="sr-only">Mot-clé (facultatif)</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Mot-clé facultatif : gaine, montre… (vide = toutes les pubs)"
              className="w-full bg-transparent text-sm outline-none focus-visible:shadow-none"
            />
          </label>
          <button
            type="submit"
            disabled={status === "loading"}
            className="bg-accent text-accent-on hover:bg-accent-hover inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-5 text-sm font-semibold transition-colors disabled:opacity-60"
          >
            <Icon name="search" size={16} />
            {status === "loading" ? "Recherche…" : "Rechercher"}
          </button>
        </div>

        {/* Filtres en pastilles */}
        <div className="flex flex-wrap items-center gap-2">
          <CountryMultiSelect selected={countries} onChange={setCountries} variant="pill" />

          <FilterPill
            label="Durée"
            icon="clock"
            active={durationOn(duration)}
            value={durationLabel(duration)}
          >
            {(close) => (
              <DurationPanel
                value={duration}
                onApply={(d) => {
                  setDuration(d);
                  close();
                }}
              />
            )}
          </FilterPill>

          <FilterPill label="Annonceur actif" icon="users" active={advN > 0} value={`${advN}+ pubs`}>
            {(close) => (
              <>
                <PanelHead title="Annonceur actif" hint="Nombre de pubs actives de l'annonceur en ce moment." />
                <OptionList
                  options={ADVERTISER_OPTS}
                  value={advMin}
                  onPick={(v) => {
                    setAdvMin(v);
                    close();
                  }}
                />
              </>
            )}
          </FilterPill>

          <FilterToggle
            label="Paiement à la livraison"
            icon="store"
            on={cod}
            onChange={setCod}
            title="Boutiques où Look360 a détecté une app de paiement à la livraison (COD)"
          />

          <FilterPill label="Format" active={mediaType !== "all"} value={MEDIA_OPTS.find((o) => o.value === mediaType)?.label}>
            {(close) => (
              <>
                <PanelHead title="Format de la créative" />
                <OptionList
                  options={MEDIA_OPTS}
                  value={mediaType}
                  onPick={(v) => {
                    setMediaType(v);
                    close();
                  }}
                />
              </>
            )}
          </FilterPill>

          <FilterPill label="Plus de filtres" icon="settings" count={moreCount} active={moreCount > 0}>
            {() => (
              <div className="space-y-3">
                <Segment label="Plateforme" options={PLATFORM_OPTS} value={platform} onChange={setPlatform} />
                <Segment label="Variantes minimum" options={VARIANTS_OPTS} value={variantsMin} onChange={setVariantsMin} />
                {euDispo ? (
                  <Segment label="Reach UE minimum" options={REACH_OPTS} value={reachMin} onChange={setReachMin} />
                ) : (
                  <p className="text-muted-foreground text-xs">Reach : disponible seulement pour les pays de l&apos;UE.</p>
                )}
                <label className="border-border flex cursor-pointer items-center gap-2 border-t pt-3 text-sm">
                  <input
                    type="checkbox"
                    checked={statut === "all"}
                    onChange={(e) => setStatut(e.target.checked ? "all" : "active")}
                    className="accent-primary h-4 w-4"
                  />
                  Inclure les pubs inactives
                </label>
              </div>
            )}
          </FilterPill>

          {anyFilter && (
            <button type="button" onClick={resetFilters} className="text-accent h-9 px-1 text-sm font-semibold hover:underline">
              Effacer tout
            </button>
          )}

          <div className="ml-auto">
            <FilterPill label="Trier" align="right" active value={triOpts.find((o) => o.value === tri)?.label}>
              {(close) => (
                <>
                  <PanelHead title="Trier les résultats" />
                  <OptionList
                    options={triOpts}
                    value={tri}
                    onPick={(v) => {
                      setTri(v);
                      setAds((a) => sortAds(a, v));
                      close();
                    }}
                  />
                </>
              )}
            </FilterPill>
          </div>
        </div>

        <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className={maxMarkets > 0 && markets > maxMarkets ? "text-warn-fg font-semibold" : ""}>
            {markets} marché{markets > 1 ? "s" : ""} / {maxMarkets} max par recherche
          </span>
          {searchesLimit > 0 && (
            <span className="tabular-nums">
              · {nf(used)}/{nf(searchesLimit)} recherches ce mois
            </span>
          )}
          {!euDispo && <span>· Reach disponible seulement pour les pays de l&apos;UE</span>}
        </div>
      </form>

      {/* Bandeau de progression (streaming) */}
      {status === "loading" && (
        <div className="border-border bg-surface flex items-center gap-3 rounded-xl border p-3 text-sm shadow-card">
          <span className="border-accent/30 border-t-primary h-4 w-4 shrink-0 animate-spin rounded-full border-2" />
          <span className="text-muted-foreground">
            {ads.length > 0
              ? `Recherche en cours — ${ads.length} pub${ads.length > 1 ? "s" : ""} déjà affichée${ads.length > 1 ? "s" : ""}…`
              : progress > 0
                ? `Recherche en cours — ${progress} pub${progress > 1 ? "s" : ""} trouvée${progress > 1 ? "s" : ""}…`
                : "Recherche en cours — premiers résultats dans un instant…"}
          </span>
        </div>
      )}

      {/* Squelettes tant qu'aucune carte n'est encore arrivée */}
      {status === "loading" && ads.length === 0 && <SkeletonGrid />}

      {status === "error" && (
        <div className="bg-danger-bg text-danger-fg rounded-xl p-4 text-sm">
          {error} — réessaie dans un instant. (Le reste de Look360 fonctionne
          indépendamment de Spy.)
        </div>
      )}

      {status === "idle" &&
        (initialFeed.length > 0 ? (
          <div className="space-y-3">
            <div className="border-border bg-surface shadow-card flex flex-wrap items-center justify-between gap-2 rounded-xl border p-4">
              <div className="flex items-center gap-2.5">
                <span className="bg-secondary text-accent grid h-9 w-9 shrink-0 place-items-center rounded-xl">
                  <Icon name="sparkles" size={18} />
                </span>
                <div>
                  <p className="text-fg text-sm font-bold">Feed du jour</p>
                  <p className="text-muted-foreground text-xs">
                    Les pubs gagnantes repérées automatiquement — mises à jour chaque jour.
                  </p>
                </div>
              </div>
              <span className="bg-success-bg text-success-fg inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold">
                <Icon name="check" size={13} /> Gratuit
              </span>
            </div>
            <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {initialFeed.map((ad) => (
                <SpyCard key={ad.ad_archive_id} ad={ad} onAnalyze={analyze} onPlay={setPlaying} />
              ))}
            </div>
            <p className="text-muted-foreground pt-1 text-xs">
              Lance ta propre recherche ci-dessus pour explorer un mot-clé ou un marché précis.
            </p>
          </div>
        ) : (
          <EmptyState
            icon={Search}
            title="Lance une recherche"
            description="Choisis un ou plusieurs pays et tes filtres — le mot-clé est facultatif : sans mot-clé, tu vois toutes les pubs actives du pays qui passent tes filtres. Les pubs qui tournent depuis longtemps (et à fort reach en UE) sont les meilleurs signaux."
          />
        ))}

      {status === "done" && ads.length === 0 && (
        <div className="border-border bg-surface rounded-xl border border-dashed p-12 text-center">
          <p className="text-muted-foreground text-sm">
            Aucune pub pour ces filtres. Élargis le mot-clé ou baisse les seuils.
          </p>
        </div>
      )}

      {/* Résultats — affichés dès que des cartes arrivent (même en cours) */}
      {ads.length > 0 && (
        <>
          {status === "done" && (
            <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
              <span>
                <b className="text-fg tabular-nums">{nf(visible.length)}</b> pub{visible.length > 1 ? "s" : ""}
                {hidden > 0 && <> · {nf(hidden)} masquée{hidden > 1 ? "s" : ""} par tes filtres</>}
              </span>
              {cached && (
                <span className="bg-input text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                  ⚡ en cache
                </span>
              )}
              {cod && codLoading && <span className="text-xs">Vérification des boutiques…</span>}
            </p>
          )}
          {cod && status === "done" && (
            <p className="bg-secondary text-fg-2 rounded-lg px-3 py-2 text-xs">
              Paiement à la livraison : seules les boutiques déjà lues par Look360 sont reconnues. Les nouvelles boutiques de
              cette recherche sont analysées en arrière-plan et apparaîtront à ta prochaine recherche.
            </p>
          )}
          {visible.length === 0 && status === "done" && (
            <div className="border-border bg-surface rounded-xl border border-dashed p-8 text-center">
              <p className="text-muted-foreground text-sm">Aucune pub ne passe tes filtres d&apos;affinage.</p>
              {refineOn && (
                <button
                  type="button"
                  onClick={() => {
                    setDuration(NO_DURATION);
                    setAdvMin("0");
                    setCod(false);
                  }}
                  className="text-accent mt-2 text-sm font-semibold hover:underline"
                >
                  Retirer durée, annonceur et livraison
                </button>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((ad) => (
              <SpyCard key={ad.ad_archive_id} ad={ad} onAnalyze={analyze} onPlay={setPlaying} />
            ))}
          </div>

          {status === "done" && limit < 100 && countries.length <= 1 && (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={chargerPlus}
                className="border-border bg-surface hover:bg-input inline-flex min-h-[44px] items-center gap-1.5 rounded-md border px-5 text-sm font-semibold transition-colors"
              >
                <Icon name="plus" size={16} /> Charger plus de résultats
              </button>
            </div>
          )}

          {status === "done" && (
            <p className="text-muted-foreground pt-2 text-xs">
              Données issues de la bibliothèque publicitaire publique de Meta via
              service tiers. Aucune donnée d&apos;impressions / dépenses / ventes
              n&apos;est disponible ; les signaux reposent sur l&apos;ancienneté, les
              variantes, l&apos;activité et le reach UE (loi DSA).
            </p>
          )}
        </>
      )}

      {playing && (
        <VideoLightbox
          url={playing.url}
          adLibraryUrl={playing.adLibraryUrl}
          adId={playing.adId}
          hlsUrl={playing.hlsUrl}
          sourceUrl={playing.sourceUrl}
          pageName={playing.pageName}
          adText={playing.adText}
          ctaText={playing.ctaText}
          landingDomain={playing.landingDomain}
          onClose={() => setPlaying(null)}
        />
      )}
    </div>
  );
}

/** Choix compact en boutons (panneau « Plus de filtres »). */
function Segment({ label, options, value, onChange }: { label: string; options: PillOption[]; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="text-fg mb-1.5 text-xs font-semibold">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
            className={`h-8 rounded-full border px-3 text-xs font-medium transition-colors ${
              o.value === value ? "border-accent bg-secondary text-accent" : "border-border text-fg-2 hover:bg-input"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Panneau « Durée de diffusion » : sélection rapide + plage libre, appliqué au clic. */
function DurationPanel({ value, onApply }: { value: Duration; onApply: (d: Duration) => void }) {
  const [draft, setDraft] = useState<Duration>(value);
  const num = (v: string) => (v.trim() === "" ? null : Math.max(0, Math.floor(Number(v) || 0)));
  const invalid = draft.max != null && draft.max < draft.min;
  return (
    <div>
      <PanelHead title="Durée de diffusion" hint="Depuis combien de jours la pub tourne." />
      <p className="text-warn-fg mb-1.5 flex items-center gap-1 text-xs font-bold uppercase tracking-wide">
        <Icon name="sparkles" size={12} /> Sélection rapide
      </p>
      <div className="space-y-1">
        {DURATION_PRESETS.map((p) => {
          const sel = draft.min === p.d.min && draft.max === p.d.max;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => setDraft(sel ? NO_DURATION : p.d)}
              aria-pressed={sel}
              className={`flex w-full items-start gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                sel ? "border-accent bg-secondary" : "border-border hover:bg-input"
              }`}
            >
              <span className={`mt-0.5 shrink-0 ${sel ? "text-accent" : "text-muted-foreground"}`}>
                <Icon name={p.icon} size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`flex items-baseline gap-1.5 text-sm font-semibold ${sel ? "text-accent" : "text-fg"}`}>
                  {p.label}
                  <span className="text-muted-foreground text-xs font-medium tabular-nums">
                    {p.d.max == null ? `${p.d.min}+ jours` : `${p.d.min} → ${p.d.max} jours`}
                  </span>
                </span>
                <span className="text-muted-foreground block text-xs">{p.hint}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-muted-foreground mb-1.5 mt-3 text-xs font-semibold">Plage personnalisée (jours)</p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          inputMode="numeric"
          aria-label="Jours minimum"
          value={draft.min || ""}
          placeholder="0"
          onChange={(e) => setDraft((d) => ({ ...d, min: num(e.target.value) ?? 0 }))}
          className="border-border bg-input focus:border-accent h-9 w-full rounded-md border px-2.5 text-sm tabular-nums outline-none"
        />
        <span className="text-muted-foreground">—</span>
        <input
          type="number"
          min={0}
          inputMode="numeric"
          aria-label="Jours maximum"
          value={draft.max ?? ""}
          placeholder="∞"
          onChange={(e) => setDraft((d) => ({ ...d, max: num(e.target.value) }))}
          className="border-border bg-input focus:border-accent h-9 w-full rounded-md border px-2.5 text-sm tabular-nums outline-none"
        />
      </div>
      {invalid && <p className="text-danger-fg mt-1 text-xs">Le maximum doit être supérieur au minimum.</p>}
      <div className="border-border mt-3 flex items-center justify-between border-t pt-3">
        <button type="button" onClick={() => onApply(NO_DURATION)} className="text-fg-2 hover:text-fg text-sm font-medium">
          Réinitialiser
        </button>
        <button
          type="button"
          disabled={invalid}
          onClick={() => onApply(draft)}
          className="bg-accent text-accent-on hover:bg-accent-hover inline-flex h-9 items-center gap-1.5 rounded-md px-4 text-sm font-semibold transition-colors disabled:opacity-50"
        >
          <Icon name="check" size={14} /> Appliquer
        </button>
      </div>
    </div>
  );
}

/** Demande de lecture d'une pub : HLS transcodé si connu, source Meta sinon. */
function playRequest(ad: SpyAd, url: string): PlayRequest {
  return {
    url,
    adId: ad.ad_archive_id,
    hlsUrl: ad.media_hls_url ?? null,
    sourceUrl: ad.media_source_url ?? ad.media_url ?? url,
    adLibraryUrl: ad.ad_library_url,
    pageName: ad.page_name,
    adText: ad.ad_text,
    ctaText: ad.cta_text,
    landingDomain: ad.landing_domain,
  };
}


function scoreTone(label: SpyAd["score_label"]): string {
  if (label === "Fort potentiel") return "text-success-fg";
  if (label === "Moyen") return "text-warn-fg";
  return "text-muted-foreground";
}

const iconBtn =
  "border-border bg-surface text-fg-2 hover:bg-input focus-visible:ring-accent/40 grid h-9 w-9 shrink-0 place-items-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:opacity-60";
const menuItem =
  "text-fg-2 hover:bg-input focus-visible:bg-input flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm focus-visible:outline-none disabled:opacity-60";

export function SpyCard({
  ad,
  rank,
  onAnalyze,
  onPlay,
}: {
  ad: SpyAd;
  /** Position dans un classement (Top Trend) — affichée en haut à gauche. */
  rank?: number;
  onAnalyze?: (ad: SpyAd) => void;
  onPlay?: (v: PlayRequest) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [followed, setFollowed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const canDownload = useCanDownload();
  const kind = ad.landing_kind ?? landingKind(ad.landing_url);
  const isShop = kind === "shop";
  const pageName = cleanField(ad.page_name);
  const adText = cleanField(ad.ad_text);

  async function save() {
    if (saved || saving) return;
    setSaving(true);
    try {
      const r = await fetch("/api/spy/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ad),
      });
      if (r.ok) setSaved(true);
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  }

  function follow() {
    if (!ad.page_id) return;
    startTransition(async () => {
      const r = await suivreConcurrent({
        page_id: ad.page_id!,
        page_name: pageName,
        domaine: ad.landing_domain,
        country: ad.country,
      });
      if (r.ok) setFollowed(true);
      else if (r.reason === "limit")
        alert(
          (r.slots ?? 0) === 0
            ? "Le suivi de concurrents est réservé aux offres payantes."
            : `Limite de ${r.slots} concurrent(s) atteinte — passe à une offre supérieure.`,
        );
    });
  }

  const eu = ad.targets_eu && ad.reach != null;
  const estimate = eu && !ad.spend ? estimateSpend(ad.reach, ad.country) : null;
  const destination = ad.landing_domain ?? (kind ? LANDING_LABEL[kind] : null);

  return (
    <article className="group bg-surface border-border shadow-card card-lift relative flex h-full flex-col rounded-xl border">
      {/* En-tête : annonceur, statut, pays, score */}
      <div className="flex items-center gap-2.5 p-3 pb-2.5">
        {rank != null && (
          <span
            className={`grid h-6 min-w-6 shrink-0 place-items-center rounded-full px-1.5 text-xs font-bold tabular-nums ${
              rank <= 3 ? "bg-accent text-accent-on" : "bg-input text-fg"
            }`}
            title={`Classement n° ${rank}`}
          >
            <span className="sr-only">Classement n° </span>
            {rank}
          </span>
        )}
        <span className="bg-secondary text-accent grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold" aria-hidden>
          {(pageName ?? "?").slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold" title={pageName ?? ""}>
            {pageName ?? "Page inconnue"}
          </h3>
          <p className="text-muted-foreground flex items-center gap-1.5 truncate text-xs">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${ad.is_active ? "bg-success-fg" : "bg-muted-foreground"}`} />
            {ad.is_active ? "Active" : "Inactive"}
            {ad.country && <> · {countryLabel(ad.country)}</>}
            {ad.targets_eu && (
              <span className="bg-secondary text-accent rounded-full px-1.5 text-xs font-semibold leading-4">UE</span>
            )}
          </p>
        </div>
        <div className="shrink-0 text-right" title={`${ad.score_label} — ${ad.score_detail.join(" · ")}`}>
          <p className={`text-xl font-bold leading-none tabular-nums ${scoreTone(ad.score_label)}`}>{ad.score}</p>
          <p className="text-muted-foreground mt-0.5 text-xs">Score</p>
        </div>
      </div>

      <div className="overflow-hidden">
        <CreativeMedia
          image={ad.thumbnail_url}
          alt={pageName ?? ""}
          isVideo={ad.media_type === "video"}
          playUrl={ad.media_url}
          onPlay={(u) => onPlay?.(playRequest(ad, u))}
        >
          {ad.media_type !== "none" && (
            <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">
              {ad.media_type === "video" ? "Vidéo" : "Image"}
            </span>
          )}
        </CreativeMedia>
      </div>

      <div className="flex flex-1 flex-col p-3 pt-2.5">
        <p className="text-fg-2 line-clamp-2 min-h-10 text-sm leading-5">{adText ?? ad.title ?? ""}</p>

        {/* Chiffres clés — uniquement des données réelles */}
        <dl className="bg-bg mt-2.5 grid grid-cols-3 overflow-hidden rounded-md">
          {eu ? (
            <Kpi label="Audience UE" value={formatReach(ad.reach)} highlight hint="Personnes touchées dans l'UE (donnée Meta, transparence DSA)" />
          ) : (
            <Kpi label="En diffusion" value={ad.jours_actifs == null ? "—" : `${ad.jours_actifs} j`} />
          )}
          {eu ? (
            <Kpi label="En diffusion" value={ad.jours_actifs == null ? "—" : `${ad.jours_actifs} j`} />
          ) : (
            <Kpi label="Variantes" value={String(ad.variants_count)} />
          )}
          {eu ? (
            <Kpi label="Variantes" value={String(ad.variants_count)} />
          ) : (
            <Kpi label="Pubs actives" value={ad.page_active_ads_count == null ? "—" : String(ad.page_active_ads_count)} hint="Pubs actives de cette page" />
          )}
        </dl>

        {eu && (
          <p className="text-muted-foreground mt-2 flex items-center gap-1 text-xs">
            {ad.spend ? (
              <>
                Dépense (Meta) <b className="text-fg-2 font-medium">{ad.spend}</b>
              </>
            ) : estimate ? (
              <span title={SPEND_METHOD} className="cursor-help">
                Dépense estimée <b className="text-fg-2 font-medium tabular-nums">{formatSpendRange(estimate)}</b>{" "}
                <span className="border-border rounded border px-1 text-xs">estimation</span>
              </span>
            ) : null}
          </p>
        )}
        {destination && (
          <p className="text-muted-foreground mt-1.5 truncate text-xs">
            Destination <span className="text-fg-2 font-medium">{destination}</span>
          </p>
        )}

        <div className="mt-auto flex items-center gap-1.5 pt-3">
          <button
            onClick={() => onAnalyze?.(ad)}
            disabled={!ad.page_id}
            className="bg-accent text-accent-on hover:bg-accent-hover focus-visible:ring-accent/40 flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50"
          >
            <Icon name="chart" size={15} /> Analyser
          </button>
          <form action={ajouterAuxProduits}>
            <input type="hidden" name="nom" value={pageName ?? ad.title ?? ""} />
            <input type="hidden" name="image_url" value={ad.thumbnail_url ?? (ad.media_type !== "video" ? ad.media_url : null) ?? ""} />
            <input type="hidden" name="landing_url" value={ad.landing_url ?? ""} />
            <input type="hidden" name="ad_library_url" value={ad.ad_library_url} />
            <input type="hidden" name="ad_text" value={adText ?? ""} />
            <input type="hidden" name="marche" value={ad.country ?? ""} />
            <button type="submit" title="Ajouter à mes produits" aria-label="Ajouter à mes produits" className={iconBtn}>
              <Icon name="plus" size={16} />
            </button>
          </form>
          <button
            onClick={save}
            disabled={saving || saved}
            title={saved ? "Sauvegardée" : "Sauvegarder la pub"}
            aria-label={saved ? "Sauvegardée" : "Sauvegarder la pub"}
            className={`${iconBtn} ${saved ? "text-success-fg border-success-fg" : ""}`}
          >
            <Icon name={saved ? "check" : "bookmark"} size={15} />
          </button>
          <details className="relative">
            <summary aria-label="Plus d'actions" title="Plus d'actions" className={`${iconBtn} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
              <Icon name="more" size={16} />
            </summary>
            <div className="bg-surface border-border shadow-raised absolute bottom-full right-0 z-20 mb-2 w-56 rounded-xl border p-1.5">
              <button onClick={follow} disabled={!ad.page_id || followed || pending} className={menuItem}>
                <Icon name={followed ? "check" : "bell"} size={15} />
                {followed ? "Page surveillée" : pending ? "…" : "Surveiller la page"}
              </button>
              <div className="border-border-soft my-1 border-t" />
              <a href={ad.ad_library_url} target="_blank" rel="noopener noreferrer" className={menuItem}>
                <Icon name="external" size={15} /> Voir dans l&apos;Ad Library
              </a>
              {ad.landing_url && isShop ? (
                <a href={ad.landing_url} target="_blank" rel="noopener noreferrer" className={menuItem}>
                  <Icon name="store" size={15} /> Ouvrir la boutique
                </a>
              ) : kind ? (
                <span className={`${menuItem} text-muted-foreground cursor-default`} title="Ce n'est pas une boutique">
                  <Icon name="store" size={15} /> {LANDING_LABEL[kind]}
                </span>
              ) : null}
              {ad.media_type === "video" &&
                ad.media_url &&
                (canDownload ? (
                  <a href={`/api/spy/video?url=${encodeURIComponent(ad.media_url)}`} className={menuItem}>
                    <Icon name="download" size={15} /> Télécharger la vidéo
                  </a>
                ) : (
                  <Link href="/offres" title="Téléchargement inclus à partir de l'offre Starter" className={`${menuItem} text-muted-foreground`}>
                    <Icon name="lock" size={15} /> Télécharger (Starter)
                  </Link>
                ))}
            </div>
          </details>
        </div>
      </div>
    </article>
  );
}

function Kpi({ label, value, highlight = false, hint }: { label: string; value: string; highlight?: boolean; hint?: string }) {
  return (
    <div className={`border-border min-w-0 px-2 py-2 [&+&]:border-l ${highlight ? "bg-secondary" : ""}`} title={hint}>
      <dt className="text-muted-foreground truncate text-xs">{label}</dt>
      <dd className={`truncate text-base font-semibold tabular-nums ${highlight ? "text-accent" : "text-fg"}`}>{value}</dd>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="bg-surface border-border animate-pulse overflow-hidden rounded-xl border">
          <div className="bg-input aspect-square w-full" />
          <div className="space-y-2 p-3">
            <div className="bg-input h-4 w-2/3 rounded" />
            <div className="bg-input h-3 w-full rounded" />
            <div className="bg-input h-6 w-1/2 rounded-full" />
            <div className="bg-input h-9 w-full rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
