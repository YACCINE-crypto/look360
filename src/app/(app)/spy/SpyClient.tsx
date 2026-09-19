"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { PageHeader } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { ajouterAuxProduits } from "./actions";
import {
  SPY_COUNTRIES,
  isEUCountry,
  formatReach,
  type SpyAd,
} from "@/lib/spy";

/* eslint-disable @next/next/no-img-element */

const inputCls =
  "min-h-[40px] rounded-md border border-border bg-input px-3 text-sm outline-none focus:border-primary";
const labelCls = "text-xs font-medium text-muted-foreground";

type Status = "idle" | "loading" | "done" | "error";

export function SpyClient() {
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("FR");
  const [platform, setPlatform] = useState("");
  const [statut, setStatut] = useState("active");
  const [mediaType, setMediaType] = useState("all");
  const [ancienneteMin, setAncienneteMin] = useState("0");
  const [reachMin, setReachMin] = useState("0");
  const [variantsMin, setVariantsMin] = useState("0");
  const [tri, setTri] = useState("score");

  const [status, setStatus] = useState<Status>("idle");
  const [ads, setAds] = useState<SpyAd[]>([]);
  const [error, setError] = useState<string | null>(null);

  const euDispo = isEUCountry(country);

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/spy/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q,
          country,
          platform,
          statut,
          mediaType,
          ancienneteMin: Number(ancienneteMin) || 0,
          reachMin: euDispo ? Number(reachMin) || 0 : 0,
          variantsMin: Number(variantsMin) || 0,
          tri,
          limit: 50,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Recherche impossible.");
      setAds(data.ads ?? []);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue.");
      setStatus("error");
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Spy Facebook"
        subtitle="Trouve des pubs qui tournent déjà — signaux réels de la bibliothèque Meta."
      />

      {/* Barre de filtres */}
      <form
        onSubmit={search}
        className="border-border bg-surface space-y-3 rounded-xl border p-4 shadow-card"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className={labelCls}>Mot-clé (produit / niche)</span>
            <div className="border-border bg-input flex min-h-[40px] items-center gap-2 rounded-md border px-3">
              <Icon name="search" size={16} className="text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ex. montre, ceinture, masseur…"
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Pays cible</span>
            <select value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls}>
              <optgroup label="Afrique">
                {SPY_COUNTRIES.filter((c) => !c.eu).map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </optgroup>
              <optgroup label="Europe (reach dispo)">
                {SPY_COUNTRIES.filter((c) => c.eu).map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </optgroup>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Plateforme</span>
            <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={inputCls}>
              <option value="">Toutes</option>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Ancienneté min.</span>
            <select value={ancienneteMin} onChange={(e) => setAncienneteMin(e.target.value)} className={inputCls}>
              <option value="0">Toutes</option>
              <option value="15">+ de 15 j</option>
              <option value="30">+ de 30 j</option>
              <option value="60">+ de 60 j</option>
              <option value="90">+ de 90 j</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>
              Reach min. {!euDispo && <span className="text-warning">(UE only)</span>}
            </span>
            <select
              value={reachMin}
              onChange={(e) => setReachMin(e.target.value)}
              disabled={!euDispo}
              className={`${inputCls} disabled:opacity-50`}
              title={euDispo ? "" : "Reach non disponible pour ce pays"}
            >
              <option value="0">Tous</option>
              <option value="50000">+ 50 000</option>
              <option value="100000">+ 100 000</option>
              <option value="500000">+ 500 000</option>
              <option value="1000000">+ 1 000 000</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Variantes min.</span>
            <select value={variantsMin} onChange={(e) => setVariantsMin(e.target.value)} className={inputCls}>
              <option value="0">Toutes</option>
              <option value="2">≥ 2</option>
              <option value="3">≥ 3</option>
              <option value="5">≥ 5</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Créative</span>
            <select value={mediaType} onChange={(e) => setMediaType(e.target.value)} className={inputCls}>
              <option value="all">Tout</option>
              <option value="video">Vidéo</option>
              <option value="image">Image</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Tri</span>
            <select value={tri} onChange={(e) => setTri(e.target.value)} className={inputCls}>
              <option value="score">Score gagnant</option>
              {euDispo && <option value="reach">Reach</option>}
              <option value="anciennete">Ancienneté</option>
              <option value="variants">Nb variantes</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={statut === "all"}
              onChange={(e) => setStatut(e.target.checked ? "all" : "active")}
            />
            Inclure les pubs inactives
          </label>
          <button
            type="submit"
            disabled={status === "loading"}
            className="bg-primary text-primary-foreground ml-auto inline-flex min-h-[40px] items-center gap-1.5 rounded-md px-5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <Icon name="search" size={16} />
            {status === "loading" ? "Recherche…" : "Rechercher"}
          </button>
        </div>
        {!euDispo && (
          <p className="text-muted-foreground text-xs">
            Reach non disponible pour ce pays — on s&apos;appuie sur l&apos;ancienneté,
            les variantes et l&apos;activité.
          </p>
        )}
      </form>

      {/* Résultats */}
      {status === "loading" && <SkeletonGrid />}

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
            Choisis un mot-clé et un pays. Les pubs qui tournent depuis longtemps
            (et à fort reach en UE) sont les meilleurs signaux.
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

      {status === "done" && ads.length > 0 && (
        <>
          <p className="text-muted-foreground text-sm">{ads.length} pub(s) trouvée(s)</p>
          <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {ads.map((ad) => (
              <SpyCard key={ad.ad_archive_id} ad={ad} />
            ))}
          </div>
          <p className="text-muted-foreground pt-2 text-xs">
            Données issues de la bibliothèque publicitaire publique de Meta via
            service tiers. Aucune donnée d&apos;impressions / dépenses / ventes
            n&apos;est disponible ; les signaux reposent sur l&apos;ancienneté, les
            variantes, l&apos;activité et le reach UE (loi DSA).
          </p>
        </>
      )}
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

export function SpyCard({ ad }: { ad: SpyAd }) {
  return (
    <article className="bg-surface border-border shadow-card flex h-full flex-col overflow-hidden rounded-xl border">
      <div className="bg-input relative aspect-[4/3] w-full">
        {ad.thumbnail_url ? (
          <img src={ad.thumbnail_url} alt={ad.page_name ?? ""} className="h-full w-full object-cover" />
        ) : (
          <div className="text-muted-foreground grid h-full w-full place-items-center">
            <Icon name="image" size={26} />
          </div>
        )}
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
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold" title={ad.page_name ?? ""}>
            {ad.page_name ?? "Page inconnue"}
          </h3>
          {ad.ad_text && (
            <p className="text-muted-foreground line-clamp-2 text-xs">{ad.ad_text}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${ancienneteBadge(ad.jours_actifs)}`}
          >
            <Icon name="clock" size={11} />
            {ad.jours_actifs == null ? "—" : `Tourne depuis ${ad.jours_actifs} j`}
          </span>
          {ad.variants_count > 1 && (
            <span className="bg-input text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-medium">
              {ad.variants_count} variantes
            </span>
          )}
          {ad.targets_eu && ad.reach != null && (
            <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-[11px] font-semibold">
              Reach {formatReach(ad.reach)}
            </span>
          )}
        </div>

        {ad.platforms.length > 0 && (
          <p className="text-muted-foreground truncate text-[11px]">
            {ad.platforms.join(" · ")}
          </p>
        )}

        <div className="mt-auto space-y-2 pt-1">
          <div className="flex gap-2">
            <a
              href={ad.ad_library_url}
              target="_blank"
              rel="noopener noreferrer"
              className="border-border hover:bg-input flex flex-1 items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors"
            >
              <Icon name="external" size={12} /> Ad Library
            </a>
            {ad.landing_url && (
              <a
                href={ad.landing_url}
                target="_blank"
                rel="noopener noreferrer"
                className="border-border hover:bg-input flex flex-1 items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors"
              >
                <Icon name="external" size={12} /> Boutique
              </a>
            )}
          </div>
          <form action={ajouterAuxProduits}>
            <input type="hidden" name="nom" value={ad.page_name ?? ad.title ?? ""} />
            <input type="hidden" name="image_url" value={ad.thumbnail_url ?? ad.media_url ?? ""} />
            <input type="hidden" name="landing_url" value={ad.landing_url ?? ""} />
            <input type="hidden" name="ad_library_url" value={ad.ad_library_url} />
            <input type="hidden" name="ad_text" value={ad.ad_text ?? ""} />
            <input type="hidden" name="marche" value={ad.country ?? ""} />
            <AddButton />
          </form>
        </div>
      </div>
    </article>
  );
}

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-primary text-primary-foreground flex min-h-[38px] w-full items-center justify-center gap-1.5 rounded-md text-xs font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      <Icon name="plus" size={14} />
      {pending ? "Ajout…" : "Ajouter à mes produits"}
    </button>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="bg-surface border-border animate-pulse overflow-hidden rounded-xl border">
          <div className="bg-input aspect-[4/3] w-full" />
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
