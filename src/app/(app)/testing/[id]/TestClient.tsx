"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { computeTest, type ConfirmationTier } from "@/lib/testing";
import { marcheLabel } from "@/lib/produits";
import { saveTest, validerProduit, abandonnerProduit } from "../actions";

const CONFIRMATION_SHORT: Record<ConfirmationTier, string> = {
  faible: "Closing faible",
  correct: "Closing correct",
  normal: "Bon closing",
  super: "Excellent closing",
};

const inputCls =
  "w-full min-h-[44px] rounded-md border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary";
const fieldLabel = "text-xs font-medium text-muted-foreground";

type Props = {
  produit: {
    id: string;
    nom: string | null;
    marche: string | null;
    categorie: string | null;
    cout_livre_estime: number | null;
    angle_marketing: string | null;
    lien_source: string | null;
    lien_concurrent: string | null;
    date_lancement_testing: string | null;
  };
  initial: {
    impressions: string;
    clics: string;
    recues: string;
    confirmees: string;
    prix: string;
    coutProduit: string;
    pub: string;
    frais: string;
  };
};

export function TestClient({ produit, initial }: Props) {
  const [impressions, setImpressions] = useState(initial.impressions);
  const [clics, setClics] = useState(initial.clics);
  const [recues, setRecues] = useState(initial.recues);
  const [confirmees, setConfirmees] = useState(initial.confirmees);
  const [prix, setPrix] = useState(initial.prix);
  const [coutProduit, setCoutProduit] = useState(initial.coutProduit);
  const [pub, setPub] = useState(initial.pub);
  const [frais, setFrais] = useState(initial.frais);

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

  const taux = r.tauxConfirmation ?? 0;
  const barWidth = Math.max(0, Math.min(100, taux));
  const duree = joursDepuis(produit.date_lancement_testing);
  const reco = recommandation(r);

  return (
    <div className="space-y-6">
      {/* Barre d'action */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/testing"
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
        >
          <Icon name="chevronRight" size={14} className="rotate-180" />
          Recherche <span className="text-muted-foreground">/</span>
          <span className="text-foreground font-medium">
            {produit.nom ?? "Sans nom"}
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="bg-chip-bleu text-chip-bleu-fg rounded-md px-2 py-1 text-xs font-medium">
            En test
          </span>
          <form action={validerProduit}>
            <input type="hidden" name="produit_id" value={produit.id} />
            <button className="bg-success text-primary-foreground inline-flex min-h-[44px] items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90">
              <Icon name="check" size={15} /> Valider le produit
            </button>
          </form>
          <form action={abandonnerProduit}>
            <input type="hidden" name="produit_id" value={produit.id} />
            <button className="text-danger border-danger/40 hover:bg-danger-bg inline-flex min-h-[44px] items-center gap-1.5 rounded-md border px-4 py-2 text-sm font-semibold transition-colors">
              <Icon name="x" size={15} /> Rejeter
            </button>
          </form>
        </div>
      </div>

      {/* En-tête produit */}
      <div className="flex items-center gap-4">
        <span className="bg-input text-muted-foreground grid h-14 w-14 place-items-center rounded-lg">
          <Icon name="image" size={22} />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {produit.nom ?? "Sans nom"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {marcheLabel(produit.marche)}
            {produit.date_lancement_testing &&
              ` · Lancé le ${formatDate(produit.date_lancement_testing)}`}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Colonne principale */}
        <div className="space-y-6 lg:col-span-2">
          <div className="border-border bg-surface rounded-xl border p-6">
            <div className="flex items-start justify-between">
              <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                Verdict du test
              </p>
              <div className="text-right">
                <p className="text-muted-foreground text-xs">Durée du test</p>
                <p className="font-bold">
                  {duree === null ? "—" : `${duree} jour${duree > 1 ? "s" : ""}`}
                </p>
              </div>
            </div>

            {r.verdict ? (
              <span
                className={`mt-3 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-base font-semibold ${verdictPill(r.verdict.tier)}`}
              >
                <span className="text-lg leading-none">●</span>
                {r.verdict.label}
              </span>
            ) : (
              <span className="text-muted-foreground mt-3 inline-block text-sm">
                Renseigne les chiffres →
              </span>
            )}

            {/* Taux de confirmation */}
            <div className="mt-6">
              <p className="text-muted-foreground text-sm">
                Taux de confirmation (closing)
              </p>
              <div className="flex items-baseline justify-between">
                <span
                  className={`text-4xl font-bold tabular-nums ${confColor(r.confirmation?.tier)}`}
                >
                  {r.tauxConfirmation === null
                    ? "—"
                    : `${r.tauxConfirmation.toFixed(0)}%`}
                </span>
                {r.confirmation && (
                  <span
                    className={`text-sm font-semibold ${confColor(r.confirmation.tier)}`}
                  >
                    {CONFIRMATION_SHORT[r.confirmation.tier]}
                  </span>
                )}
              </div>

              {/* Barre objectif 60% */}
              <div className="bg-muted relative mt-2 h-2 w-full overflow-hidden rounded-full">
                <div
                  className={`h-full rounded-full ${confBar(r.confirmation?.tier)}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <div className="text-muted-foreground mt-1 flex justify-between text-xs">
                <span>0%</span>
                <span>Objectif 60%</span>
                <span>100%</span>
              </div>
            </div>

            {/* 4 cartes */}
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Metric label="Bénéfice projeté" hint="FCFA">
                <span
                  className={
                    r.beneficeProjete !== null && r.beneficeProjete < 0
                      ? "text-danger"
                      : ""
                  }
                >
                  {r.beneficeProjete === null
                    ? "—"
                    : new Intl.NumberFormat("fr-FR", {
                        maximumFractionDigits: 0,
                      }).format(r.beneficeProjete)}
                </span>
              </Metric>
              <Metric label="Marge nette" hint="sur prix de vente">
                <span className={marginColor(r.margePct)}>
                  {r.margePct === null ? "—" : `${r.margePct.toFixed(0)}%`}
                </span>
              </Metric>
              <Metric label="ROAS" hint="retour sur budget pub">
                <span className="text-warning">
                  {r.roas === null ? "—" : `${r.roas.toFixed(1)}x`}
                </span>
              </Metric>
              <Metric label="Budget pub dépensé" hint="FCFA">
                {n(pub) === null
                  ? "—"
                  : new Intl.NumberFormat("fr-FR", {
                      maximumFractionDigits: 0,
                    }).format(n(pub)!)}
              </Metric>
            </div>
          </div>

          {/* Recommandation */}
          <div className="bg-secondary text-secondary-foreground flex items-start gap-2 rounded-xl p-4 text-sm">
            <span className="mt-0.5">💡</span>
            <p>
              <span className="font-semibold">Recommandation :</span> {reco}
            </p>
          </div>
        </div>

        {/* Colonne droite */}
        <div className="space-y-6">
          {produit.angle_marketing && (
            <div>
              <h2 className="mb-2 text-sm font-semibold">Angle marketing</h2>
              <p className="border-border bg-surface rounded-xl border p-4 text-sm">
                {produit.angle_marketing}
              </p>
            </div>
          )}

          {(produit.lien_source || produit.lien_concurrent) && (
            <div>
              <h2 className="mb-2 text-sm font-semibold">Liens</h2>
              <div className="space-y-2 text-sm">
                {produit.lien_source && (
                  <a
                    href={produit.lien_source}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary flex items-center gap-2 hover:underline"
                  >
                    <Icon name="chevronRight" size={14} /> Voir fournisseur
                  </a>
                )}
                {produit.lien_concurrent && (
                  <a
                    href={produit.lien_concurrent}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary flex items-center gap-2 hover:underline"
                  >
                    <Icon name="chevronRight" size={14} /> Voir pub concurrent
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Chiffres réels — formulaire de sauvegarde */}
          <form action={saveTest} className="space-y-3">
            <input type="hidden" name="produit_id" value={produit.id} />
            <input type="hidden" name="marche" value={produit.marche ?? ""} />
            <input type="hidden" name="prix_vente_prevu" value={prix} />
            <input type="hidden" name="commandes_recues" value={recues} />
            <input type="hidden" name="commandes_confirmees" value={confirmees} />
            <input type="hidden" name="depense_pub" value={pub} />
            <input type="hidden" name="cout_produit_estime" value={coutProduit} />
            <input type="hidden" name="frais_livraison_prevu" value={frais} />

            <h2 className="text-sm font-semibold">Chiffres réels du test</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Impressions" value={impressions} onChange={setImpressions} />
              <Field label="Clics" value={clics} onChange={setClics} />
              <Field label="Commandes passées" value={recues} onChange={setRecues} />
              <Field
                label="Commandes confirmées"
                value={confirmees}
                onChange={setConfirmees}
                highlight
              />
              <Field label="Prix de vente (FCFA)" value={prix} onChange={setPrix} />
              <Field label="Coût produit (FCFA)" value={coutProduit} onChange={setCoutProduit} />
            </div>
            <Field
              label="Budget pub dépensé (FCFA)"
              value={pub}
              onChange={setPub}
            />
            <Field
              label="Frais livraison / commande (FCFA)"
              value={frais}
              onChange={setFrais}
            />

            <button
              type="submit"
              className="bg-primary text-primary-foreground flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
            >
              <Icon name="clock" size={15} /> Recalculer &amp; enregistrer
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-input rounded-lg p-4">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{children}</p>
      {hint && <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  highlight,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  highlight?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className={fieldLabel}>{label}</span>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputCls} ${highlight ? "border-success bg-success-bg text-success font-semibold" : ""}`}
      />
    </label>
  );
}

function confColor(tier?: ConfirmationTier): string {
  if (tier === "faible") return "text-danger";
  if (tier === "correct") return "text-warning";
  return "text-success";
}
function confBar(tier?: ConfirmationTier): string {
  if (tier === "faible") return "bg-danger";
  if (tier === "correct") return "bg-warning";
  return "bg-success";
}
function marginColor(margePct: number | null): string {
  if (margePct === null) return "";
  if (margePct >= 30) return "text-success";
  if (margePct >= 15) return "text-warning";
  return "text-danger";
}
function verdictPill(tier: string): string {
  if (tier === "rentable") return "border-success/40 bg-success-bg text-success";
  if (tier === "moyen") return "border-warning/40 bg-warning-bg text-warning";
  return "border-danger/40 bg-danger-bg text-danger";
}

function recommandation(r: ReturnType<typeof computeTest>): string {
  if (!r.verdict) return "Renseigne les chiffres du test pour obtenir le verdict.";
  if (r.verdict.tier === "rentable" && (r.tauxConfirmation ?? 0) >= 45)
    return "Le taux de closing dépasse l'objectif et la marge est solide. Ce produit est prêt pour la production.";
  if (r.verdict.tier === "pas_rentable")
    return "Le test n'est pas rentable en l'état. Revois le prix, le coût produit ou l'angle avant de continuer.";
  return "Résultats corrects mais à optimiser (prix, closing ou coût) avant de valider.";
}

function joursDepuis(dateISO: string | null): number | null {
  if (!dateISO) return null;
  const d = new Date(dateISO + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const j = Math.round((today.getTime() - d.getTime()) / 86_400_000);
  return j >= 0 ? j : null;
}

function formatDate(dateISO: string): string {
  return new Date(dateISO + "T00:00:00").toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
