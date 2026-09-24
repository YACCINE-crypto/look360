"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { Select, type SelectOption } from "@/components/Select";
import { CountryMultiSelect } from "@/components/CountryMultiSelect";
import { CreativeMedia } from "@/components/CreativeMedia";
import { ajouterAuxProduits } from "./actions";
import { suivreConcurrent } from "../surveillance/actions";
import {
  isEUCountry,
  formatReach,
  landingKind,
  LANDING_LABEL,
  cleanField,
  countryLabel,
  SPY_COUNTRIES_SOFT,
  type SpyAd,
} from "@/lib/spy";
import { searchCost, formatCredits, SEARCH_COST_PER_COUNTRY } from "@/lib/billing";
import { useCanDownload } from "@/components/PlanProvider";

const labelCls = "text-xs font-medium text-muted-foreground";

const PLATFORM_OPTS: SelectOption[] = [
  { value: "", label: "Toutes" },
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
];
const ANCIENNETE_OPTS: SelectOption[] = [
  { value: "0", label: "Toutes" },
  { value: "15", label: "+ de 15 j" },
  { value: "30", label: "+ de 30 j" },
  { value: "60", label: "+ de 60 j" },
  { value: "90", label: "+ de 90 j" },
];
const REACH_OPTS: SelectOption[] = [
  { value: "0", label: "Tous" },
  { value: "50000", label: "+ 50 000" },
  { value: "100000", label: "+ 100 000" },
  { value: "500000", label: "+ 500 000" },
  { value: "1000000", label: "+ 1 000 000" },
];
const VARIANTS_OPTS: SelectOption[] = [
  { value: "0", label: "Toutes" },
  { value: "2", label: "≥ 2" },
  { value: "3", label: "≥ 3" },
  { value: "5", label: "≥ 5" },
];
const MEDIA_OPTS: SelectOption[] = [
  { value: "all", label: "Tout" },
  { value: "video", label: "Vidéo" },
  { value: "image", label: "Image" },
];

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

export function SpyClient({ balance }: { balance: number; plan?: string }) {
  const params = useSearchParams();
  const [bal, setBal] = useState(balance);
  const [q, setQ] = useState("");
  const [countries, setCountries] = useState<string[]>(() => {
    const c = (params.get("country") || "FR").toUpperCase();
    return [c];
  });
  const [platform, setPlatform] = useState("");
  const [statut, setStatut] = useState("active");
  const [mediaType, setMediaType] = useState("all");
  const [ancienneteMin, setAncienneteMin] = useState("0");
  const [reachMin, setReachMin] = useState("0");
  const [variantsMin, setVariantsMin] = useState("0");
  const [tri, setTri] = useState("score");

  const [status, setStatus] = useState<Status>("idle");
  const [ads, setAds] = useState<SpyAd[]>([]);
  const [cached, setCached] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [progress, setProgress] = useState(0);
  const router = useRouter();

  const jsonHeaders = { "Content-Type": "application/json" };

  const euDispo = countries.some(isEUCountry);
  const nbSearches = countries.length;
  const cost = searchCost(countries.length);

  const triOpts: SelectOption[] = useMemo(
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
      ancienneteMin: Number(ancienneteMin) || 0,
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
        setError(data?.error || "Crédits insuffisants.");
        setStatus("error");
        return;
      }
      if (!res.ok) throw new Error(data?.error || "Recherche impossible.");
      setAds(sortAds(data.ads ?? [], tri));
      setCached(Boolean(data.cached));
      if (!data.cached) setBal((b) => Math.max(0, b - searchCost(countries.length)));
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue.");
      setStatus("error");
    }
  }

  async function runSearch(searchLimit = limit) {
    setConfirmOpen(false);
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
            if (!msg.cached) setBal((b) => Math.max(0, b - SEARCH_COST_PER_COUNTRY));
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
    // Confirmation du coût AVANT toute recherche payante.
    setConfirmOpen(true);
  }

  function analyze(ad: SpyAd) {
    if (!ad.page_id) return;
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

      <form
        onSubmit={submit}
        className="border-border bg-surface space-y-3 rounded-xl border p-4 shadow-card"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className={labelCls}>Mot-clé (produit / niche)</span>
            <div className="border-border bg-input flex min-h-[44px] items-center gap-2 rounded-md border px-3">
              <Icon name="search" size={16} className="text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ex. montre, ceinture, masseur…"
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
          </label>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <span className={labelCls}>Pays cibles (plusieurs possibles)</span>
            <CountryMultiSelect selected={countries} onChange={setCountries} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Plateforme</span>
            <Select value={platform} onChange={setPlatform} options={PLATFORM_OPTS} ariaLabel="Plateforme" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Ancienneté min.</span>
            <Select value={ancienneteMin} onChange={setAncienneteMin} options={ANCIENNETE_OPTS} ariaLabel="Ancienneté minimum" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>
              Reach min. {!euDispo && <span className="text-warning">(UE only)</span>}
            </span>
            <Select
              value={reachMin}
              onChange={setReachMin}
              options={REACH_OPTS}
              disabled={!euDispo}
              ariaLabel="Reach minimum"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Variantes min.</span>
            <Select value={variantsMin} onChange={setVariantsMin} options={VARIANTS_OPTS} ariaLabel="Variantes minimum" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Créative</span>
            <Select value={mediaType} onChange={setMediaType} options={MEDIA_OPTS} ariaLabel="Type de créative" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Tri</span>
            <Select value={tri} onChange={setTri} options={triOpts} ariaLabel="Tri" />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={statut === "all"}
              onChange={(e) => setStatut(e.target.checked ? "all" : "active")}
              className="accent-primary h-4 w-4"
            />
            Inclure les pubs inactives
          </label>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              nbSearches > SPY_COUNTRIES_SOFT
                ? "bg-warning-bg text-warning"
                : "bg-input text-muted-foreground"
            }`}
            title="Coût débité uniquement si la recherche n'est pas déjà en cache"
          >
            ≈ {formatCredits(cost)} crédits
          </span>
          <span className="bg-secondary text-secondary-foreground rounded-full px-2.5 py-1 text-xs font-semibold">
            Solde : {formatCredits(bal)}
          </span>
          <button
            type="submit"
            disabled={status === "loading"}
            className="bg-primary text-primary-foreground ml-auto inline-flex min-h-[44px] items-center gap-1.5 rounded-md px-5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <Icon name="search" size={16} />
            {status === "loading" ? "Recherche…" : "Rechercher"}
          </button>
        </div>
        {!euDispo && (
          <p className="text-muted-foreground text-xs">
            Reach non disponible pour ces pays — on s&apos;appuie sur l&apos;ancienneté,
            les variantes et l&apos;activité.
          </p>
        )}
      </form>

      {/* Bandeau de progression (streaming) */}
      {status === "loading" && (
        <div className="border-border bg-surface flex items-center gap-3 rounded-xl border p-3 text-sm shadow-card">
          <span className="border-primary/30 border-t-primary h-4 w-4 shrink-0 animate-spin rounded-full border-2" />
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
        <div className="bg-danger-bg text-danger rounded-xl p-4 text-sm">
          {error} — réessaie dans un instant. (Le reste de Look360 fonctionne
          indépendamment de Spy.)
        </div>
      )}

      {status === "idle" && (
        <div className="border-border bg-surface rounded-xl border border-dashed p-12 text-center">
          <span className="bg-secondary text-primary mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full">
            <Icon name="eye" size={24} />
          </span>
          <p className="font-medium">Lance une recherche</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
            Choisis un mot-clé et un ou plusieurs pays. Les pubs qui tournent depuis
            longtemps (et à fort reach en UE) sont les meilleurs signaux.
          </p>
        </div>
      )}

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
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              {ads.length} pub(s) trouvée(s)
              {cached && (
                <span className="bg-input text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-medium">
                  ⚡ en cache
                </span>
              )}
            </p>
          )}
          <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {ads.map((ad) => (
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

      {confirmOpen && (
        <ConfirmSearch
          countries={countries}
          cost={cost}
          balance={bal}
          onConfirm={() => runSearch()}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
      {playing && <VideoModal url={playing} onClose={() => setPlaying(null)} />}
    </div>
  );
}

function ConfirmSearch({
  countries,
  cost,
  balance,
  onConfirm,
  onCancel,
}: {
  countries: string[];
  cost: number;
  balance: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const enough = balance >= cost;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} aria-hidden="true" />
      <div className="bg-surface border-border relative z-10 w-full max-w-sm rounded-xl border p-5 shadow-xl">
        <div className="mb-3 flex items-center gap-2">
          <span className="bg-secondary text-secondary-foreground grid h-9 w-9 place-items-center rounded-full text-sm font-bold">
            ⚡
          </span>
          <h3 className="font-bold">Confirmer la recherche</h3>
        </div>
        <p className="text-muted-foreground text-sm">
          Cette recherche coûtera <b className="text-foreground">{formatCredits(cost)} crédits</b>
          {countries.length > 1
            ? ` (${countries.length} pays × ${formatCredits(SEARCH_COST_PER_COUNTRY)})`
            : ""}{" "}
          — continuer ?
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          Solde actuel : {formatCredits(balance)} crédits. Gratuit si la recherche est déjà en cache.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {countries.map((c) => (
            <span key={c} className="bg-input text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-medium">
              {countryLabel(c)}
            </span>
          ))}
        </div>

        {!enough ? (
          <div className="mt-4 space-y-3">
            <div className="bg-danger-bg text-danger rounded-md p-3 text-sm">
              Crédits insuffisants — recharge des crédits ou passe à une offre supérieure.
            </div>
            <div className="flex gap-2">
              <Link
                href="/offres"
                className="bg-primary text-primary-foreground inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-md px-4 text-sm font-semibold"
              >
                Recharger
              </Link>
              <button
                onClick={onCancel}
                className="bg-input text-foreground inline-flex min-h-[44px] items-center justify-center rounded-md px-4 text-sm font-semibold"
              >
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 flex gap-2">
            <button
              onClick={onConfirm}
              className="bg-primary text-primary-foreground inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-md px-4 text-sm font-semibold transition-opacity hover:opacity-90"
            >
              <Icon name="search" size={16} /> Continuer
            </button>
            <button
              onClick={onCancel}
              className="bg-input text-foreground inline-flex min-h-[44px] items-center justify-center rounded-md px-4 text-sm font-semibold"
            >
              Annuler
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function scoreBadge(label: SpyAd["score_label"]): string {
  if (label === "Fort potentiel") return "bg-success-bg text-success";
  if (label === "Moyen") return "bg-warning-bg text-warning";
  return "bg-input text-muted-foreground";
}
function ancienneteBadge(j: number | null): string {
  if (j == null) return "bg-input text-muted-foreground";
  if (j >= 60) return "bg-success-bg text-success";
  if (j >= 30) return "bg-chip-bleu text-chip-bleu-fg";
  return "bg-input text-muted-foreground";
}

export function SpyCard({
  ad,
  onAnalyze,
  onPlay,
}: {
  ad: SpyAd;
  onAnalyze?: (ad: SpyAd) => void;
  onPlay?: (url: string) => void;
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

  return (
    <article className="bg-surface border-border shadow-card flex h-full flex-col overflow-hidden rounded-xl border">
      <CreativeMedia
        image={ad.thumbnail_url}
        alt={pageName ?? ""}
        isVideo={ad.media_type === "video"}
        playUrl={ad.media_url}
        onPlay={onPlay}
      >
        <span
          className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${scoreBadge(ad.score_label)}`}
          title={ad.score_detail.join(" · ")}
        >
          Score {ad.score} · {ad.score_label}
        </span>
        {ad.media_type !== "none" && (
          <span className="bg-black/55 absolute left-2 top-2 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase text-white">
            {ad.media_type === "video" ? "Vidéo" : "Image"}
          </span>
        )}
        <button
          onClick={save}
          disabled={saving || saved}
          title={saved ? "Sauvegardée" : "Sauvegarder la pub"}
          aria-label={saved ? "Sauvegardée" : "Sauvegarder la pub"}
          className={`absolute bottom-2 left-2 grid h-9 w-9 place-items-center rounded-full border shadow-sm backdrop-blur transition-colors ${
            saved
              ? "bg-success text-primary-foreground border-transparent"
              : "bg-surface/90 text-foreground border-border hover:bg-muted"
          }`}
        >
          <Icon name={saved ? "check" : "bookmark"} size={16} />
        </button>
      </CreativeMedia>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold" title={pageName ?? ""}>
            {pageName ?? "Page inconnue"}
          </h3>
          {adText && <p className="text-muted-foreground line-clamp-2 text-xs">{adText}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${ancienneteBadge(ad.jours_actifs)}`}>
            <Icon name="clock" size={11} />
            {ad.jours_actifs == null ? "—" : `Tourne depuis ${ad.jours_actifs} j`}
          </span>
          {ad.variants_count > 1 && (
            <span className="bg-input text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-medium">
              {ad.variants_count} variantes
            </span>
          )}
          {ad.targets_eu && ad.reach != null && (
            <span className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" title="Reach UE (transparence DSA)">
              <Icon name="eye" size={11} /> Reach {formatReach(ad.reach)}
            </span>
          )}
          {ad.targets_eu && ad.spend && (
            <span className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" title="Dépense estimée (transparence DSA UE)">
              <Icon name="trending" size={11} /> Dépense {ad.spend}
            </span>
          )}
        </div>

        {ad.platforms.length > 0 && (
          <p className="text-muted-foreground truncate text-[11px]">{ad.platforms.join(" · ")}</p>
        )}

        <div className="mt-auto space-y-2 pt-1">
          {/* Ligne liens : Ad Library + boutique intelligente */}
          <div className="flex gap-2">
            <a
              href={ad.ad_library_url}
              target="_blank"
              rel="noopener noreferrer"
              className="border-border hover:bg-input flex flex-1 items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors"
            >
              <Icon name="external" size={12} /> Ad Library
            </a>
            {ad.landing_url && isShop ? (
              <a
                href={ad.landing_url}
                target="_blank"
                rel="noopener noreferrer"
                className="border-border hover:bg-input flex flex-1 items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors"
              >
                <Icon name="external" size={12} /> Boutique
              </a>
            ) : kind ? (
              <span
                className="border-border text-muted-foreground flex flex-1 items-center justify-center gap-1 rounded-md border border-dashed px-2 py-1.5 text-xs font-medium"
                title="Ce n'est pas une boutique"
              >
                {LANDING_LABEL[kind]}
              </span>
            ) : null}
          </div>

          {/* Ligne annonceur : Analyser + Surveiller */}
          <div className="flex gap-2">
            <button
              onClick={() => onAnalyze?.(ad)}
              disabled={!ad.page_id}
              className="bg-input text-foreground hover:bg-muted flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
            >
              <Icon name="search" size={12} /> Analyser
            </button>
            <button
              onClick={follow}
              disabled={!ad.page_id || followed || pending}
              className="bg-input text-foreground hover:bg-muted flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors disabled:opacity-60"
            >
              <Icon name={followed ? "check" : "bell"} size={12} />
              {followed ? "Surveillé" : pending ? "…" : "Surveiller"}
            </button>
          </div>

          {/* Vidéo : regarder + télécharger */}
          {ad.media_type === "video" && ad.media_url && (
            <div className="flex gap-2">
              <button
                onClick={() => onPlay?.(ad.media_url!)}
                className="border-border hover:bg-input flex flex-1 items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors"
              >
                <Icon name="play" size={12} /> Regarder
              </button>
              {canDownload ? (
                <a
                  href={`/api/spy/video?url=${encodeURIComponent(ad.media_url)}`}
                  className="border-border hover:bg-input flex flex-1 items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors"
                >
                  <Icon name="download" size={12} /> Télécharger
                </a>
              ) : (
                <Link
                  href="/offres"
                  title="Téléchargement inclus à partir de l'offre Starter"
                  className="border-border text-muted-foreground hover:bg-input flex flex-1 items-center justify-center gap-1 rounded-md border border-dashed px-2 py-1.5 text-xs font-medium transition-colors"
                >
                  <Icon name="lock" size={12} /> Télécharger
                </Link>
              )}
            </div>
          )}

          <form action={ajouterAuxProduits}>
            <input type="hidden" name="nom" value={pageName ?? ad.title ?? ""} />
            <input type="hidden" name="image_url" value={ad.thumbnail_url ?? ad.media_url ?? ""} />
            <input type="hidden" name="landing_url" value={ad.landing_url ?? ""} />
            <input type="hidden" name="ad_library_url" value={ad.ad_library_url} />
            <input type="hidden" name="ad_text" value={adText ?? ""} />
            <input type="hidden" name="marche" value={ad.country ?? ""} />
            <AddButton />
          </form>
        </div>
      </div>
    </article>
  );
}

function AddButton() {
  return (
    <button
      type="submit"
      className="bg-primary text-primary-foreground flex min-h-[38px] w-full items-center justify-center gap-1.5 rounded-md text-xs font-semibold transition-opacity hover:opacity-90"
    >
      <Icon name="plus" size={14} /> Ajouter à mes produits
    </button>
  );
}

export function VideoModal({ url, onClose }: { url: string; onClose: () => void }) {
  const canDownload = useCanDownload();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-2xl">
        <button
          onClick={onClose}
          className="bg-surface text-foreground absolute -top-3 -right-3 grid h-9 w-9 place-items-center rounded-full shadow"
          aria-label="Fermer"
        >
          <Icon name="x" size={18} />
        </button>
        <video src={url} controls autoPlay className="max-h-[80vh] w-full rounded-lg bg-black" />
        {canDownload ? (
          <a
            href={`/api/spy/video?url=${encodeURIComponent(url)}`}
            className="bg-primary text-primary-foreground mt-3 inline-flex min-h-[40px] items-center gap-1.5 rounded-md px-4 text-sm font-semibold"
          >
            <Icon name="download" size={16} /> Télécharger la vidéo
          </a>
        ) : (
          <Link
            href="/offres"
            className="bg-input text-muted-foreground mt-3 inline-flex min-h-[40px] items-center gap-1.5 rounded-md px-4 text-sm font-semibold"
          >
            <Icon name="lock" size={16} /> Télécharger — inclus à partir de Starter
          </Link>
        )}
      </div>
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
