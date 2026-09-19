"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { envoyerEnTestAvecSourcing } from "../../../recherche/actions";
import {
  MODES_TRANSIT,
  TYPES_APPRO,
  DEFAULT_FRAIS_TRANSIT_KILO,
  coutLivreEstime,
  formatFCFA,
  type ModeTransit,
  type TypeAppro,
} from "@/lib/produits";

const inputCls =
  "w-full min-h-[44px] rounded-md border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary";
const labelCls = "text-xs font-medium text-muted-foreground";

type Produit = {
  id: string;
  nom: string | null;
  type_approvisionnement: string;
  prix_fournisseur: number | null;
  prix_achat_local: number | null;
  poids_kg: number | null;
  mode_transit: string;
  frais_transit_kilo: number | null;
  cbm: number | null;
  frais_transit_cbm: number | null;
};

const s = (v: number | null | undefined) => (v == null ? "" : String(v));

export function EnvoyerTestForm({ produit }: { produit: Produit }) {
  const [typeAppro, setTypeAppro] = useState<TypeAppro>(
    produit.type_approvisionnement === "local" ? "local" : "import",
  );
  const [mode, setMode] = useState<ModeTransit>(
    produit.mode_transit === "maritime" ? "maritime" : "aerien",
  );
  const [prix, setPrix] = useState(s(produit.prix_fournisseur));
  const [prixLocal, setPrixLocal] = useState(s(produit.prix_achat_local));
  const [poids, setPoids] = useState(s(produit.poids_kg));
  const [fraisKilo, setFraisKilo] = useState(
    s(produit.frais_transit_kilo) || String(DEFAULT_FRAIS_TRANSIT_KILO),
  );
  const [cbm, setCbm] = useState(s(produit.cbm));
  const [fraisCbm, setFraisCbm] = useState(s(produit.frais_transit_cbm));

  const n = (v: string): number | null => {
    if (v.trim() === "") return null;
    const x = Number(v.replace(",", "."));
    return Number.isFinite(x) ? x : null;
  };

  const cout = coutLivreEstime({
    typeAppro,
    mode,
    prixFournisseur: n(prix),
    prixAchatLocal: n(prixLocal),
    poidsKg: n(poids),
    fraisTransitKilo: n(fraisKilo),
    cbm: n(cbm),
    fraisTransitCbm: n(fraisCbm),
  });

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <Link
          href={`/produits/${produit.id}`}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
        >
          <Icon name="chevronRight" size={14} className="rotate-180" />
          {produit.nom ?? "Produit"}
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Envoyer en test</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">
          Renseigne le coût & la rentabilité pour lancer le test.
        </p>
      </div>

      <form action={envoyerEnTestAvecSourcing} className="border-border bg-surface space-y-4 rounded-xl border p-5 shadow-card">
        <input type="hidden" name="id" value={produit.id} />
        <input type="hidden" name="type_approvisionnement" value={typeAppro} />
        <input type="hidden" name="mode_transit" value={mode} />

        {/* Type d'approvisionnement */}
        <div className="space-y-1.5">
          <span className={labelCls}>Approvisionnement</span>
          <div className="border-border bg-input flex gap-1 rounded-md border p-1">
            {TYPES_APPRO.map((t) => (
              <button
                key={t.code}
                type="button"
                onClick={() => setTypeAppro(t.code)}
                className={`min-h-[38px] flex-1 rounded-[6px] text-sm font-medium transition-colors ${
                  typeAppro === t.code
                    ? "bg-surface text-foreground shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {typeAppro === "local" ? (
          <label className="block space-y-1.5">
            <span className={labelCls}>Prix d&apos;achat local (FCFA)</span>
            <input
              name="prix_achat_local"
              inputMode="decimal"
              value={prixLocal}
              onChange={(e) => setPrixLocal(e.target.value)}
              placeholder="0"
              className={inputCls}
            />
          </label>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5">
                <span className={labelCls}>Prix fournisseur (FCFA)</span>
                <input
                  name="prix_fournisseur"
                  inputMode="decimal"
                  value={prix}
                  onChange={(e) => setPrix(e.target.value)}
                  placeholder="0"
                  className={inputCls}
                />
              </label>
              <label className="block space-y-1.5">
                <span className={labelCls}>Poids (kg)</span>
                <input
                  name="poids_kg"
                  inputMode="decimal"
                  value={poids}
                  onChange={(e) => setPoids(e.target.value)}
                  placeholder="0"
                  className={inputCls}
                />
              </label>
            </div>
            <label className="block space-y-1.5">
              <span className={labelCls}>Mode de transit</span>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as ModeTransit)}
                className={inputCls}
              >
                {MODES_TRANSIT.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            {mode === "aerien" ? (
              <label className="block space-y-1.5">
                <span className={labelCls}>Frais transit / kg (FCFA)</span>
                <input
                  name="frais_transit_kilo"
                  inputMode="decimal"
                  value={fraisKilo}
                  onChange={(e) => setFraisKilo(e.target.value)}
                  className={inputCls}
                />
              </label>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1.5">
                  <span className={labelCls}>CBM (m³)</span>
                  <input
                    name="cbm"
                    inputMode="decimal"
                    value={cbm}
                    onChange={(e) => setCbm(e.target.value)}
                    placeholder="0"
                    className={inputCls}
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className={labelCls}>Frais / CBM (FCFA)</span>
                  <input
                    name="frais_transit_cbm"
                    inputMode="decimal"
                    value={fraisCbm}
                    onChange={(e) => setFraisCbm(e.target.value)}
                    placeholder="0"
                    className={inputCls}
                  />
                </label>
              </div>
            )}
          </>
        )}

        {/* Coût livré — calculé en direct */}
        <div className="border-border bg-input flex items-center justify-between rounded-md border px-3 py-2.5">
          <div>
            <p className={labelCls}>Coût livré (calculé)</p>
            <p className="text-muted-foreground text-[11px]">
              {typeAppro === "local"
                ? "= prix d'achat local"
                : mode === "aerien"
                  ? "prix + poids × frais/kg"
                  : "prix + CBM × frais/CBM"}
            </p>
          </div>
          <span className="text-lg font-bold tabular-nums">{formatFCFA(cout)}</span>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            className="bg-primary text-primary-foreground inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-md px-5 text-sm font-semibold transition-opacity hover:opacity-90"
          >
            <Icon name="flask" size={16} /> Lancer le test
          </button>
          <Link
            href={`/produits/${produit.id}`}
            className="bg-input text-foreground inline-flex min-h-[44px] items-center justify-center rounded-md px-5 text-sm font-semibold"
          >
            Annuler
          </Link>
        </div>
      </form>
    </div>
  );
}
