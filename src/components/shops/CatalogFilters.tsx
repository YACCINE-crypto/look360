"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/Icon";

const chip =
  "border-border bg-surface text-fg-2 hover:bg-input focus-visible:ring-accent/40 h-9 shrink-0 cursor-pointer appearance-none rounded-full border pl-3 pr-8 text-sm font-medium focus-visible:outline-none focus-visible:ring-2";

const ZONES = [
  ["all", "Tous"],
  ["africa", "Afrique"],
  ["europe", "Europe"],
  ["america", "Amérique"],
] as const;

/**
 * Filtres partagés Produits gagnants / Boutiques : zone, recherche, tri,
 * puis une rangée de niches (comme Top Trend). État dans l'URL.
 */
export function CatalogFilters({
  basePath,
  kind,
  niches,
}: {
  basePath: string;
  kind: "produits" | "boutiques";
  niches: string[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const zone = sp.get("zone") ?? "all";
  const sort = sp.get("sort") ?? "pubs";
  const niche = sp.get("niche") ?? "";
  const ads = sp.get("ads") !== "0";

  function set(patch: Record<string, string | null>) {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === "") p.delete(k);
      else p.set(k, v);
    }
    p.delete("page");
    const qs = p.toString();
    router.push(`${basePath}${qs ? `?${qs}` : ""}`);
  }

  return (
    <div className="space-y-3">
      <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1">
        <div className="bg-input flex shrink-0 gap-0.5 rounded-lg p-0.5" role="group" aria-label="Zone">
          {ZONES.map(([z, label]) => (
            <button
              key={z}
              aria-pressed={zone === z}
              onClick={() => set({ zone: z === "all" ? null : z })}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                zone === z ? "bg-surface text-fg shadow-card font-semibold" : "text-fg-2 hover:text-fg"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            set({ q: q.trim() || null });
          }}
          className="border-border bg-surface focus-within:border-accent flex h-9 min-w-52 shrink-0 items-center gap-2 rounded-full border px-3"
        >
          <Icon name="search" size={14} className="text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={kind === "produits" ? "Rechercher un produit…" : "Rechercher une boutique…"}
            aria-label="Rechercher"
            className="w-full bg-transparent text-sm outline-none"
          />
        </form>

        {kind === "produits" && (
          <button
            aria-pressed={ads}
            onClick={() => set({ ads: ads ? "0" : null })}
            className={`h-9 shrink-0 rounded-full border px-3 text-sm font-medium ${
              ads ? "border-accent bg-secondary text-accent" : "border-border bg-surface text-fg-2"
            }`}
            title="Afficher seulement les produits vers lesquels des pubs mènent"
          >
            {ads ? "Avec pubs actives" : "Tout le catalogue"}
          </button>
        )}

        <label className="relative ml-auto shrink-0">
          <span className="sr-only">Tri</span>
          <select value={sort} onChange={(e) => set({ sort: e.target.value === "pubs" ? null : e.target.value })} className={chip}>
            <option value="pubs">Tri : plus de pubs</option>
            {kind === "produits" ? (
              <>
                <option value="recent">Tri : nouveautés</option>
                <option value="promo">En promotion</option>
              </>
            ) : (
              <>
                <option value="produits">Tri : plus de produits</option>
                <option value="cod">Paiement à la livraison</option>
              </>
            )}
          </select>
          <Icon name="chevronDown" size={14} className="text-muted-foreground pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
        </label>
      </div>

      {niches.length > 0 && (
        <nav aria-label="Niches" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {["", ...niches].map((n) => (
            <button
              key={n || "all"}
              aria-pressed={niche === n}
              onClick={() => set({ niche: n || null })}
              className={`h-8 shrink-0 rounded-full border px-3 text-sm font-medium ${
                niche === n ? "border-accent bg-secondary text-accent" : "border-border bg-surface text-fg-2 hover:bg-input"
              }`}
            >
              {n || "Toutes les niches"}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
