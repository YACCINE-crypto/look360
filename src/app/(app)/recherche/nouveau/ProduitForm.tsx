"use client";

import { useState } from "react";
import Link from "next/link";
import { createProduit } from "../actions";
import {
  STATUTS,
  STATUT_LABELS,
  MARCHES,
  EMOTIONS,
  coutLivreEstime,
  formatFCFA,
} from "@/lib/produits";

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100";
const labelCls = "text-sm font-medium";
const fieldCls = "space-y-1.5";

export function ProduitForm({ error }: { error?: string }) {
  const [prix, setPrix] = useState<string>("");
  const [poids, setPoids] = useState<string>("");
  const [frais, setFrais] = useState<string>("");

  const n = (s: string) => {
    const v = Number(s.replace(",", "."));
    return Number.isFinite(v) ? v : 0;
  };
  const cout = coutLivreEstime(n(prix), n(poids), n(frais));

  return (
    <form action={createProduit} className="mt-6 space-y-6">
      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error === "nom"
            ? "Le nom du produit est requis."
            : "Impossible d'enregistrer le produit. Réessaie."}
        </p>
      )}

      <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-zinc-500">Identité</h2>
        <div className={fieldCls}>
          <label htmlFor="nom" className={labelCls}>
            Nom du produit *
          </label>
          <input id="nom" name="nom" required className={inputCls} />
        </div>
        <div className={fieldCls}>
          <label htmlFor="image_url" className={labelCls}>
            Lien de l&apos;image
          </label>
          <input
            id="image_url"
            name="image_url"
            type="url"
            placeholder="https://…"
            className={inputCls}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={fieldCls}>
            <label htmlFor="marche" className={labelCls}>
              Marché
            </label>
            <select id="marche" name="marche" className={inputCls} defaultValue="">
              <option value="">—</option>
              {MARCHES.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className={fieldCls}>
            <label htmlFor="statut" className={labelCls}>
              Statut
            </label>
            <select
              id="statut"
              name="statut"
              className={inputCls}
              defaultValue="idee"
            >
              {STATUTS.map((s) => (
                <option key={s} value={s}>
                  {STATUT_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-zinc-500">Liens & veille</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={fieldCls}>
            <label htmlFor="lien_source" className={labelCls}>
              Lien source (Alibaba/AliExpress)
            </label>
            <input id="lien_source" name="lien_source" className={inputCls} />
          </div>
          <div className={fieldCls}>
            <label htmlFor="lien_concurrent" className={labelCls}>
              Lien concurrent
            </label>
            <input
              id="lien_concurrent"
              name="lien_concurrent"
              className={inputCls}
            />
          </div>
          <div className={fieldCls}>
            <label htmlFor="lien_ad_library" className={labelCls}>
              Lien FB Ad Library
            </label>
            <input
              id="lien_ad_library"
              name="lien_ad_library"
              className={inputCls}
            />
          </div>
          <div className={fieldCls}>
            <label htmlFor="date_debut_pub_concurrent" className={labelCls}>
              Début pub concurrent
            </label>
            <input
              id="date_debut_pub_concurrent"
              name="date_debut_pub_concurrent"
              type="date"
              className={inputCls}
            />
          </div>
          <div className={fieldCls}>
            <label htmlFor="angle_marketing" className={labelCls}>
              Angle marketing
            </label>
            <input
              id="angle_marketing"
              name="angle_marketing"
              className={inputCls}
            />
          </div>
          <div className={fieldCls}>
            <label htmlFor="emotion_tag" className={labelCls}>
              Émotion / angle
            </label>
            <select
              id="emotion_tag"
              name="emotion_tag"
              className={inputCls}
              defaultValue=""
            >
              <option value="">—</option>
              {EMOTIONS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-zinc-500">Sourcing & coût</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className={fieldCls}>
            <label htmlFor="prix_sourcing" className={labelCls}>
              Prix sourcing (FCFA)
            </label>
            <input
              id="prix_sourcing"
              name="prix_sourcing"
              inputMode="decimal"
              value={prix}
              onChange={(e) => setPrix(e.target.value)}
              className={inputCls}
            />
          </div>
          <div className={fieldCls}>
            <label htmlFor="poids_kg" className={labelCls}>
              Poids (kg)
            </label>
            <input
              id="poids_kg"
              name="poids_kg"
              inputMode="decimal"
              value={poids}
              onChange={(e) => setPoids(e.target.value)}
              className={inputCls}
            />
          </div>
          <div className={fieldCls}>
            <label htmlFor="frais_logistiques_kilo" className={labelCls}>
              Frais logistiques /kg (FCFA)
            </label>
            <input
              id="frais_logistiques_kilo"
              name="frais_logistiques_kilo"
              inputMode="decimal"
              value={frais}
              onChange={(e) => setFrais(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-zinc-100 px-4 py-3 dark:bg-zinc-800">
          <span className="text-sm text-zinc-500">Coût livré estimé</span>
          <span className="text-lg font-semibold">{formatFCFA(cout)}</span>
        </div>
        <p className="text-xs text-zinc-400">
          = prix sourcing + poids × frais logistiques/kg (calculé aussi côté base).
        </p>
      </section>

      <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-zinc-500">Planning & notes</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={fieldCls}>
            <label htmlFor="date_a_travailler" className={labelCls}>
              Date à travailler
            </label>
            <input
              id="date_a_travailler"
              name="date_a_travailler"
              type="date"
              className={inputCls}
            />
          </div>
          <div className={fieldCls}>
            <label htmlFor="date_lancement_testing" className={labelCls}>
              Date lancement testing
            </label>
            <input
              id="date_lancement_testing"
              name="date_lancement_testing"
              type="date"
              className={inputCls}
            />
          </div>
        </div>
        <div className={fieldCls}>
          <label htmlFor="notes" className={labelCls}>
            Notes
          </label>
          <textarea id="notes" name="notes" rows={3} className={inputCls} />
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Enregistrer le produit
        </button>
        <Link
          href="/recherche"
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Annuler
        </Link>
      </div>
    </form>
  );
}
