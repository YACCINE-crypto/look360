import Link from "next/link";
import { Card } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { StatusChip } from "@/components/StatusChip";
import type { TestResult } from "@/lib/testing";
import {
  formatFCFA,
  marcheLabel,
  echeanceLabel,
  joursRestants,
  type Produit,
  type Statut,
} from "@/lib/produits";

/* eslint-disable @next/next/no-img-element */

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

export type AujourdhuiData = {
  dateLabel: string;
  heure: string;
  pendingCount: number;
  kpis: {
    enTest: number;
    tauxValidation: number | null;
    margeMoyenne: number | null;
    enProduction: number;
  };
  duJour: { p: Produit; ech: string | null; r: TestResult } | null;
  semaine: { lances: number; valides: number; rejetes: number; attente: number };
  echeances: { p: Produit; ech: string | null }[];
};

// Couleur signal (tokens Kimba) selon le tier de verdict.
function verdictColor(tier: string | null): { badge: string; text: string } {
  if (tier === "rentable") return { badge: "bg-success-bg text-success", text: "text-success" };
  if (tier === "moyen") return { badge: "bg-warning-bg text-warning", text: "text-warning" };
  if (tier === "pas_rentable" || tier === "marge_faible")
    return { badge: "bg-danger-bg text-danger", text: "text-danger" };
  return { badge: "bg-input text-muted-foreground", text: "text-foreground" };
}

const CLOSING_LABEL: Record<string, string> = {
  super: "Super closing",
  normal: "Bon closing",
  correct: "Closing correct",
  faible: "Closing faible",
};

function insight(r: TestResult): string {
  const v = r.verdict?.tier;
  if (v === "rentable")
    return "Le taux de closing dépasse l'objectif. Ce produit est prêt pour la production.";
  if (v === "moyen")
    return "Rentabilité correcte : optimise la marge ou le closing avant de lancer.";
  return "Rentabilité insuffisante : à retravailler ou abandonner.";
}

export function AujourdhuiView({ data }: { data: AujourdhuiData }) {
  const { kpis } = data;
  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Aujourd&apos;hui</h1>
          <p className="text-muted-foreground mt-0.5 text-sm capitalize">
            {data.dateLabel}
            <span className="lowercase">
              {" · "}
              <span className={data.pendingCount > 0 ? "text-warning font-medium" : ""}>
                {data.pendingCount} décision{data.pendingCount > 1 ? "s" : ""} en attente
              </span>
            </span>
          </p>
        </div>
        <span className="border-border bg-surface text-muted-foreground inline-flex w-fit items-center gap-1.5 rounded-md border px-3 py-2 text-xs">
          <Icon name="clock" size={13} />
          Mis à jour à {data.heure}
        </span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Produits en test" value={String(kpis.enTest)} hint="actifs cette semaine" />
        <Kpi
          label="Taux de validation"
          value={kpis.tauxValidation === null ? "—" : `${kpis.tauxValidation.toFixed(0)}%`}
          hint="produits tranchés"
          valueClass="text-success"
        />
        <Kpi
          label="Marge moyenne"
          value={kpis.margeMoyenne === null ? "—" : `${kpis.margeMoyenne.toFixed(0)}%`}
          hint="produits validés"
          valueClass="text-warning"
        />
        <Kpi label="En production" value={String(kpis.enProduction)} hint="produits actifs" />
      </div>

      {/* Produit du jour */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${data.duJour ? "bg-success" : "bg-muted-foreground"}`}
          />
          <h2 className="font-semibold">Produit du jour — décision requise</h2>
        </div>

        {data.duJour ? (
          <ProduitDuJour item={data.duJour} />
        ) : (
          <Card className="flex flex-col items-center gap-2 p-10 text-center">
            <span className="bg-success-bg text-success grid h-11 w-11 place-items-center rounded-full">
              <Icon name="check" size={22} />
            </span>
            <p className="font-medium">Aucune décision en attente</p>
            <p className="text-muted-foreground max-w-sm text-sm">
              Lance un test sur un produit pour voir apparaître ici le prochain
              verdict à trancher.
            </p>
          </Card>
        )}
      </section>

      {/* Bas : score de la semaine + prochaines échéances */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wide">
            Score de la semaine
          </p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { v: data.semaine.lances, l: "Tests lancés", c: "text-foreground" },
              { v: data.semaine.valides, l: "Validés", c: "text-success" },
              { v: data.semaine.rejetes, l: "Rejetés", c: "text-danger" },
              { v: data.semaine.attente, l: "En attente", c: "text-warning" },
            ].map((s, i) => (
              <div
                key={s.l}
                className={`flex flex-col gap-0.5 ${i > 0 ? "border-border border-l pl-3" : ""}`}
              >
                <span className={`text-xl font-bold tabular-nums ${s.c}`}>{s.v}</span>
                <span className="text-muted-foreground text-xs leading-tight">{s.l}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Prochaines échéances
            </p>
            <Link href="/recherche" className="text-primary text-xs font-medium hover:underline">
              Voir tout
            </Link>
          </div>
          {data.echeances.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              Aucune échéance planifiée.
            </p>
          ) : (
            <div>
              {data.echeances.map(({ p, ech }) => (
                <EcheanceRow key={p.id} p={p} ech={ech} />
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  valueClass = "",
}: {
  label: string;
  value: string;
  hint: string;
  valueClass?: string;
}) {
  return (
    <Card className="flex flex-col gap-1 px-4 py-3">
      <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
        {label}
      </span>
      <span className={`text-2xl font-bold tabular-nums ${valueClass}`}>{value}</span>
      <span className="text-muted-foreground text-xs">{hint}</span>
    </Card>
  );
}

function ProduitDuJour({
  item,
}: {
  item: { p: Produit; ech: string | null; r: TestResult };
}) {
  const { p, ech, r } = item;
  const vc = verdictColor(r.verdict?.tier ?? null);
  const closing = r.confirmation;
  const closingColor = verdictColor(
    closing?.tier === "super" || closing?.tier === "normal"
      ? "rentable"
      : closing?.tier === "correct"
        ? "moyen"
        : closing?.tier === "faible"
          ? "marge_faible"
          : null,
  ).text;

  return (
    <div className="bg-surface border-success shadow-card flex flex-col gap-5 rounded-xl border-2 p-5 sm:flex-row sm:gap-6 sm:p-6">
      {/* Image */}
      <div className="bg-input relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-lg sm:aspect-square sm:h-36 sm:w-36">
        {p.image_url ? (
          <img src={p.image_url} alt={p.nom ?? ""} className="h-full w-full object-cover" />
        ) : (
          <div className="text-muted-foreground grid h-full w-full place-items-center">
            <Icon name="image" size={28} />
          </div>
        )}
      </div>

      {/* Corps */}
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="bg-success-bg text-success rounded px-2 py-0.5 text-xs font-medium">
                Verdict disponible
              </span>
              <span className="text-muted-foreground text-xs">
                {marcheLabel(p.marche)}
                {p.categorie ? ` · ${p.categorie}` : ""}
              </span>
            </div>
            <h3 className="text-xl font-bold leading-tight">{p.nom ?? "Sans nom"}</h3>
            <p className="text-muted-foreground mt-0.5 text-sm">
              Coût livré :{" "}
              <span className="text-foreground font-medium">
                {formatFCFA(p.cout_livre_estime)}
              </span>
              {ech && (
                <>
                  {" · Échéance : "}
                  <span className="text-foreground font-medium">{echeanceLabel(ech)}</span>
                </>
              )}
            </p>
          </div>
          {r.verdict && (
            <span
              className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-base font-bold ${vc.badge}`}
            >
              <span className="h-2.5 w-2.5 rounded-full bg-current opacity-80" />
              {r.verdict.label}
            </span>
          )}
        </div>

        {/* Métriques */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="bg-background rounded-lg px-4 py-3">
            <p className="text-muted-foreground mb-1 text-xs">Taux de closing</p>
            <p className={`text-2xl font-bold tabular-nums ${closingColor}`}>
              {r.tauxConfirmation === null ? "—" : `${r.tauxConfirmation.toFixed(0)}%`}
            </p>
            {closing && (
              <p className={`mt-0.5 text-xs font-medium ${closingColor}`}>
                {CLOSING_LABEL[closing.tier]}
              </p>
            )}
          </div>
          <div className="bg-background rounded-lg px-4 py-3">
            <p className="text-muted-foreground mb-1 text-xs">Bénéfice projeté</p>
            <p className="text-2xl font-bold tabular-nums">
              {r.beneficeProjete === null ? "—" : nf.format(Math.round(r.beneficeProjete))}
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs">FCFA</p>
          </div>
          <div className="bg-background rounded-lg px-4 py-3">
            <p className="text-muted-foreground mb-1 text-xs">Marge nette</p>
            <p className={`text-2xl font-bold tabular-nums ${vc.text}`}>
              {r.margePct === null ? "—" : `${r.margePct.toFixed(0)}%`}
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs">sur prix de vente</p>
          </div>
        </div>

        {/* Action + insight */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <Link
            href={`/testing/${p.id}`}
            className="bg-success text-primary-foreground inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold transition-opacity hover:opacity-90"
          >
            <Icon name="check" size={16} />
            Prendre la décision
          </Link>
          <p className="text-muted-foreground text-xs">{insight(r)}</p>
        </div>
      </div>
    </div>
  );
}

function EcheanceRow({ p, ech }: { p: Produit; ech: string | null }) {
  const jours = joursRestants(ech);
  const urgent = jours !== null && jours <= 2;
  return (
    <Link
      href={`/testing/${p.id}`}
      className="border-border flex items-center gap-3 border-b py-3 last:border-b-0 hover:opacity-80"
    >
      <div className="bg-input text-muted-foreground grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md">
        {p.image_url ? (
          <img src={p.image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <Icon name="image" size={16} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{p.nom ?? "Sans nom"}</p>
        <p className="text-muted-foreground text-xs">{marcheLabel(p.marche)}</p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <StatusChip statut={p.statut as Statut} />
        <span
          className={`flex items-center gap-1 text-xs ${urgent ? "text-warning font-medium" : "text-muted-foreground"}`}
        >
          <Icon name="clock" size={11} />
          {echeanceLabel(ech)}
        </span>
      </div>
    </Link>
  );
}
