"use client";

import { useState } from "react";
import { Icon } from "./Icon";
import { deleteProduit, updatePlanning } from "@/app/(app)/recherche/actions";

const iconBtn =
  "bg-surface/90 text-foreground grid h-8 w-8 place-items-center rounded-full border border-border shadow-sm backdrop-blur transition-colors hover:bg-muted";

/**
 * Actions sur une carte produit : planifier (dates à travailler / lancement
 * testing) et supprimer (avec confirmation). RLS garantit que seul le
 * propriétaire ou l'admin peut réellement modifier/supprimer.
 */
export function ProductActions({
  id,
  nom,
  dateATravailler,
  dateLancementTesting,
}: {
  id: string;
  nom: string | null;
  dateATravailler: string | null;
  dateLancementTesting: string | null;
}) {
  const [planOpen, setPlanOpen] = useState(false);

  return (
    <>
      <div className="absolute bottom-2 right-2 flex gap-1.5">
        <button
          type="button"
          onClick={() => setPlanOpen(true)}
          className={iconBtn}
          aria-label="Planifier"
          title="Planifier"
        >
          <Icon name="today" size={15} />
        </button>
        <form
          action={deleteProduit}
          onSubmit={(e) => {
            if (
              !confirm(
                `Supprimer « ${nom ?? "ce produit"} » ? Cette action est définitive.`,
              )
            ) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="id" value={id} />
          <button
            type="submit"
            className={`${iconBtn} hover:bg-danger-bg hover:text-danger`}
            aria-label="Supprimer"
            title="Supprimer"
          >
            <Icon name="trash" size={15} />
          </button>
        </form>
      </div>

      {planOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setPlanOpen(false)}
            aria-hidden="true"
          />
          <div className="bg-surface relative z-10 w-full max-w-sm rounded-xl border border-border p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-bold">Planifier</h3>
              <button
                type="button"
                onClick={() => setPlanOpen(false)}
                className="text-muted-foreground hover:text-foreground -mr-2 inline-flex h-9 w-9 items-center justify-center rounded-md"
                aria-label="Fermer"
              >
                <Icon name="x" size={18} />
              </button>
            </div>
            <p className="text-muted-foreground mb-4 text-xs">
              {nom ?? "Produit"} — reçois un rappel push le jour J et 2 jours avant.
            </p>
            <form action={updatePlanning} className="space-y-3">
              <input type="hidden" name="id" value={id} />
              <label className="block space-y-1.5">
                <span className="text-muted-foreground text-xs font-medium">
                  Date à travailler
                </span>
                <input
                  type="date"
                  name="date_a_travailler"
                  defaultValue={dateATravailler ?? ""}
                  className="border-border bg-input focus:border-primary min-h-[44px] w-full rounded-md border px-3 py-2 text-sm outline-none"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-muted-foreground text-xs font-medium">
                  Date de lancement testing
                </span>
                <input
                  type="date"
                  name="date_lancement_testing"
                  defaultValue={dateLancementTesting ?? ""}
                  className="border-border bg-input focus:border-primary min-h-[44px] w-full rounded-md border px-3 py-2 text-sm outline-none"
                />
              </label>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  onClick={() => setPlanOpen(false)}
                  className="bg-primary text-primary-foreground inline-flex min-h-[44px] flex-1 items-center justify-center rounded-md px-4 text-sm font-semibold transition-opacity hover:opacity-90"
                >
                  Enregistrer
                </button>
                <button
                  type="button"
                  onClick={() => setPlanOpen(false)}
                  className="bg-input text-foreground inline-flex min-h-[44px] items-center justify-center rounded-md px-4 text-sm font-semibold"
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
