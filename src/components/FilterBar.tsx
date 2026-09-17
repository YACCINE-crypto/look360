"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { STATUTS, STATUT_LABELS, MARCHES, TRIS, type Tri } from "@/lib/produits";

export function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const currentStatut = params.get("statut") ?? "";
  const currentMarche = params.get("marche") ?? "";
  const currentTri = (params.get("tri") as Tri) ?? "recent";

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}?${next.toString()}`);
  }

  const pills: { value: string; label: string }[] = [
    { value: "", label: "Tous" },
    ...STATUTS.map((s) => ({ value: s, label: STATUT_LABELS[s] })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1.5">
        {pills.map((p) => {
          const active = currentStatut === p.value;
          return (
            <button
              key={p.value || "tous"}
              type="button"
              onClick={() => update("statut", p.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
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

      <div className="ml-auto flex gap-2">
        <select
          value={currentMarche}
          onChange={(e) => update("marche", e.target.value)}
          className="border-border bg-surface rounded-md border px-2.5 py-1.5 text-sm"
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
          value={currentTri}
          onChange={(e) => update("tri", e.target.value)}
          className="border-border bg-surface rounded-md border px-2.5 py-1.5 text-sm"
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
