"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { FilterBar } from "@/components/FilterBar";
import { StatsStrip, type Stat } from "@/components/StatsStrip";
import { AddProductPanel } from "@/components/AddProductPanel";
import { PageHeader } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { type Produit, type Tri } from "@/lib/produits";

export function RechercheClient({
  produits,
  marges,
  stats,
  addError,
}: {
  produits: Produit[];
  marges: Record<string, number>;
  stats: Stat[];
  addError?: string;
}) {
  const [statut, setStatut] = useState("");
  const [marche, setMarche] = useState("");
  const [tri, setTri] = useState<Tri>("recent");
  const [q, setQ] = useState("");

  // Filtrage + tri EN MÉMOIRE → réponse instantanée, aucun aller-retour serveur.
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = produits.filter((p) => {
      if (statut && p.statut !== statut) return false;
      if (marche && p.marche !== marche) return false;
      if (s && !(p.nom ?? "").toLowerCase().includes(s)) return false;
      return true;
    });
    const arr = [...list];
    switch (tri) {
      case "ancien":
        arr.sort((a, b) => a.created_at.localeCompare(b.created_at));
        break;
      case "cout_asc":
        arr.sort((a, b) => (a.cout_livre_estime ?? 0) - (b.cout_livre_estime ?? 0));
        break;
      case "cout_desc":
        arr.sort((a, b) => (b.cout_livre_estime ?? 0) - (a.cout_livre_estime ?? 0));
        break;
      default:
        arr.sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
    return arr;
  }, [produits, statut, marche, tri, q]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Recherche produit"
        subtitle="Trouvez, évaluez et envoyez les produits prometteurs en test."
      >
        <div className="border-border bg-input hidden min-h-[44px] items-center gap-2 rounded-md border px-3 sm:flex">
          <Icon name="search" size={16} className="text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un produit…"
            className="placeholder:text-muted-foreground w-48 bg-transparent text-sm outline-none"
          />
        </div>
        <AddProductPanel />
      </PageHeader>

      <StatsStrip stats={stats} />

      <FilterBar
        statut={statut}
        marche={marche}
        tri={tri}
        onStatut={setStatut}
        onMarche={setMarche}
        onTri={setTri}
      />

      {/* Recherche mobile (sous les filtres) */}
      <div className="border-border bg-input flex min-h-[44px] items-center gap-2 rounded-md border px-3 sm:hidden">
        <Icon name="search" size={16} className="text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un produit…"
          className="placeholder:text-muted-foreground w-full bg-transparent text-sm outline-none"
        />
      </div>

      {addError && (
        <p className="bg-danger-bg text-danger rounded-lg p-3 text-sm">
          {addError === "nom"
            ? "Le nom du produit est requis."
            : "Impossible d'enregistrer le produit. Réessaie."}
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="border-border bg-surface rounded-xl border border-dashed p-12 text-center">
          <p className="text-muted-foreground text-sm">
            Aucun produit pour ces filtres.
          </p>
          <Link
            href="/recherche?add=1"
            className="text-primary mt-3 inline-block text-sm font-medium hover:underline"
          >
            Ajouter ton premier produit
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <ProductCard key={p.id} p={p} marge={marges[p.id] ?? null} />
          ))}
        </div>
      )}
    </div>
  );
}
