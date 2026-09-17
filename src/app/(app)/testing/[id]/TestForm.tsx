"use client";

import { useState } from "react";
import { computeTest } from "@/lib/testing";
import { formatFCFA, MARCHES } from "@/lib/produits";
import { saveTest } from "../actions";

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100";
const labelCls = "text-sm font-medium";

function pct(v: number | null): string {
  return v === null ? "—" : `${v.toFixed(1)} %`;
}
function ratio(v: number | null): string {
  return v === null ? "—" : v.toFixed(2);
}

export function TestForm({
  produitId,
  defautMarche,
  defautCoutProduit,
  saved,
  error,
}: {
  produitId: string;
  defautMarche: string | null;
  defautCoutProduit: number | null;
  saved?: boolean;
  error?: boolean;
}) {
  const [prix, setPrix] = useState("");
  const [recues, setRecues] = useState("");
  const [confirmees, setConfirmees] = useState("");
  const [pub, setPub] = useState("");
  const [coutProduit, setCoutProduit] = useState(
    defautCoutProduit != null ? String(defautCoutProduit) : "",
  );
  const [frais, setFrais] = useState("1800");

  const n = (s: string): number | null => {
    if (s.trim() === "") return null;
    const v = Number(s.replace(",", "."));
    return Number.isFinite(v) ? v : null;
  };

  const r = computeTest({
    prix_vente_prevu: n(prix),
    commandes_recues: n(recues),
    commandes_confirmees: n(confirmees),
    depense_pub: n(pub),
    cout_produit_estime: n(coutProduit),
    frais_livraison_prevu: n(frais),
  });

  return (
    <form action={saveTest} className="space-y-6">
      <input type="hidden" name="produit_id" value={produitId} />

      {saved && (
        <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          Test enregistré ✓
        </p>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          Impossible d&apos;enregistrer le test. Réessaie.
        </p>
      )}

      {/* --- Taux de confirmation : la validation de la demande, en haut --- */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Taux de confirmation (closing)
        </p>
        <div className="mt-1 flex flex-wrap items-baseline gap-3">
          <span className="text-4xl font-semibold tabular-nums">
            {pct(r.tauxConfirmation)}
          </span>
          {r.confirmation && (
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${r.confirmation.badge}`}
            >
              {r.confirmation.label}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-zinc-400">
          commandes confirmées ÷ commandes reçues
        </p>
      </div>

      {/* --- Saisie des chiffres réels --- */}
      <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-zinc-500">Chiffres du test</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className={labelCls}>Marché testé</span>
            <select
              name="marche"
              defaultValue={defautMarche ?? ""}
              className={inputCls}
            >
              <option value="">—</option>
              {MARCHES.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className={labelCls}>Prix de vente prévu (FCFA)</span>
            <input
              name="prix_vente_prevu"
              inputMode="decimal"
              value={prix}
              onChange={(e) => setPrix(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="space-y-1.5">
            <span className={labelCls}>Commandes reçues (leads)</span>
            <input
              name="commandes_recues"
              inputMode="numeric"
              value={recues}
              onChange={(e) => setRecues(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="space-y-1.5">
            <span className={labelCls}>Commandes confirmées</span>
            <input
              name="commandes_confirmees"
              inputMode="numeric"
              value={confirmees}
              onChange={(e) => setConfirmees(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="space-y-1.5">
            <span className={labelCls}>Dépense pub totale (FCFA)</span>
            <input
              name="depense_pub"
              inputMode="decimal"
              value={pub}
              onChange={(e) => setPub(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="space-y-1.5">
            <span className={labelCls}>Coût produit livré /unité (FCFA)</span>
            <input
              name="cout_produit_estime"
              inputMode="decimal"
              value={coutProduit}
              onChange={(e) => setCoutProduit(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="space-y-1.5">
            <span className={labelCls}>Frais livraison /commande (FCFA)</span>
            <input
              name="frais_livraison_prevu"
              inputMode="decimal"
              value={frais}
              onChange={(e) => setFrais(e.target.value)}
              className={inputCls}
            />
          </label>
        </div>
      </section>

      {/* --- Bénéfice projeté + verdict --- */}
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Bénéfice projeté
          </p>
          <p
            className={`mt-1 text-3xl font-semibold tabular-nums ${
              r.beneficeProjete !== null && r.beneficeProjete < 0
                ? "text-red-600 dark:text-red-400"
                : ""
            }`}
          >
            {formatFCFA(r.beneficeProjete)}
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            projection par commande confirmée, une fois le stock livré
          </p>
        </div>
        <div className="flex flex-col justify-center rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Verdict rentabilité
          </p>
          {r.verdict ? (
            <span
              className={`mt-2 inline-block w-fit rounded-full px-3 py-1 text-sm font-medium ${r.verdict.badge}`}
            >
              {r.verdict.label}
            </span>
          ) : (
            <span className="mt-2 text-sm text-zinc-400">
              Renseigne les chiffres…
            </span>
          )}
          <p className="mt-2 text-xs text-zinc-400">Marge : {pct(r.margePct)}</p>
        </div>
      </section>

      {/* --- Indicateurs détaillés --- */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-zinc-500">Indicateurs</h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <Indicateur label="CA" value={formatFCFA(r.ca)} />
          <Indicateur label="Marge / unité" value={formatFCFA(r.margeUnite)} />
          <Indicateur label="Marge %" value={pct(r.margePct)} />
          <Indicateur label="CPA (par lead)" value={formatFCFA(r.cpaRecue)} />
          <Indicateur
            label="Coût / confirmée"
            value={formatFCFA(r.coutParConfirmee)}
          />
          <Indicateur label="ROAS" value={ratio(r.roas)} />
        </dl>
      </section>

      <label className="block space-y-1.5">
        <span className={labelCls}>Notes du test</span>
        <textarea name="notes_test" rows={2} className={inputCls} />
      </label>

      <button
        type="submit"
        className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Enregistrer ce test
      </button>
    </form>
  );
}

function Indicateur({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-zinc-100 py-1 dark:border-zinc-800">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
