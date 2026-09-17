"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createProduit } from "@/app/(app)/recherche/actions";
import { MARCHES, CATEGORIES } from "@/lib/produits";
import { Icon } from "./Icon";

const inputCls =
  "w-full rounded-md border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary";
const labelCls = "text-xs font-medium text-muted-foreground";

export function AddProductPanel() {
  const params = useSearchParams();
  const [open, setOpen] = useState(
    params.get("add") === "1" || params.has("error"),
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-primary text-primary-foreground inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
      >
        <Icon name="plus" size={16} />
        Ajouter
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="bg-surface relative z-10 flex h-full w-full max-w-md flex-col overflow-y-auto p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold">Nouveau produit</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground rounded-md p-1"
                aria-label="Fermer"
              >
                <Icon name="x" size={18} />
              </button>
            </div>

            <form action={createProduit} className="space-y-4">
              <input type="hidden" name="redirect_to" value="/recherche" />

              <label className="block space-y-1.5">
                <span className={labelCls}>Nom du produit *</span>
                <input
                  name="nom"
                  required
                  placeholder="ex. Ceinture chauffante infrarouge"
                  className={inputCls}
                />
              </label>

              <label className="block space-y-1.5">
                <span className={labelCls}>Lien fournisseur</span>
                <input
                  name="lien_source"
                  placeholder="https://…"
                  className={inputCls}
                />
              </label>

              <label className="block space-y-1.5">
                <span className={labelCls}>Pub concurrent (optionnel)</span>
                <input
                  name="lien_concurrent"
                  placeholder="https://…"
                  className={inputCls}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1.5">
                  <span className={labelCls}>Coût livré (FCFA)</span>
                  <input
                    name="prix_sourcing"
                    inputMode="decimal"
                    placeholder="0"
                    className={inputCls}
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className={labelCls}>Marché</span>
                  <select name="marche" defaultValue="CI" className={inputCls}>
                    {MARCHES.map((m) => (
                      <option key={m.code} value={m.code}>
                        {m.code}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block space-y-1.5">
                <span className={labelCls}>Angle marketing</span>
                <textarea
                  name="angle_marketing"
                  rows={3}
                  placeholder="En quoi ce produit résout un vrai problème…"
                  className={inputCls}
                />
              </label>

              <label className="block space-y-1.5">
                <span className={labelCls}>Catégorie</span>
                <select name="categorie" defaultValue="" className={inputCls}>
                  <option value="">Sélectionner…</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  className="bg-primary text-primary-foreground rounded-md px-5 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
                >
                  Ajouter
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="bg-input text-foreground rounded-md px-5 py-2 text-sm font-semibold"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
