"use client";

import { STATUTS, STATUT_LABELS, MARCHES, TRIS, type Statut, type Tri } from "@/lib/produits";

export function FilterBar({
  statut,
  marche,
  tri,
  onStatut,
  onMarche,
  onTri,
}: {
  statut: string;
  marche: string;
  tri: Tri;
  onStatut: (v: string) => void;
  onMarche: (v: string) => void;
  onTri: (v: Tri) => void;
}) {
  const pills: { value: string; label: string }[] = [
    { value: "", label: "Tous" },
    ...STATUTS.map((s) => ({ value: s as string, label: STATUT_LABELS[s as Statut] })),
  ];

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center">
      {/* Chips statut : UNE seule ligne, scroll horizontal tactile */}
      <div className="no-scrollbar -mx-1 flex touch-pan-x flex-nowrap gap-1.5 overflow-x-auto px-1 md:flex-1">
        {pills.map((p) => {
          const active = statut === p.value;
          return (
            <button
              key={p.value || "tous"}
              type="button"
              onClick={() => onStatut(p.value)}
              className={`inline-flex min-h-[44px] shrink-0 items-center whitespace-nowrap rounded-md px-3.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-input text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="flex shrink-0 gap-2">
        <select
          value={marche}
          onChange={(e) => onMarche(e.target.value)}
          className="border-border bg-surface min-h-[44px] rounded-md border px-2.5 text-sm"
          aria-label="Marché"
        >
          <option value="">Tous marchés</option>
          {MARCHES.map((m) => (
            <option key={m.code} value={m.code}>
              {m.label}
            </option>
          ))}
        </select>

        <select
          value={tri}
          onChange={(e) => onTri(e.target.value as Tri)}
          className="border-border bg-surface min-h-[44px] rounded-md border px-2.5 text-sm"
          aria-label="Trier"
        >
          {(Object.keys(TRIS) as Tri[]).map((t) => (
            <option key={t} value={t}>
              {TRIS[t]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
