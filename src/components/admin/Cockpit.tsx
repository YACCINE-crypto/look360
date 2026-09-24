"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { usePrefersReducedMotion, useCountUp } from "@/components/landing/anim";

export type CockpitData = {
  revenueMonth: number;
  revenueCount: number;
  mrr: number;
  clientsActifs: number;
  inscritsTotal: number;
  nouveauxToday: number;
  nouveaux7d: number;
  conversion: number; // %
  creditsConsumed: number;
  coutEstime: number;
  margeNette: number;
  plans: { free: number; starter: number; pro: number; business: number };
};

type Fmt = "fcfa" | "int" | "pct";

export function Cockpit({ k }: { k: CockpitData }) {
  return (
    <div className="space-y-5">
      {/* Ligne principale */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon="store"
          label="Revenu du mois"
          period="Mois en cours"
          value={k.revenueMonth}
          format="fcfa"
          sub={`${k.revenueCount} paiement${k.revenueCount > 1 ? "s" : ""} réussi${k.revenueCount > 1 ? "s" : ""}`}
        />
        <KpiCard
          icon="trending"
          label="MRR estimé"
          period="Abonnements actifs"
          value={k.mrr}
          format="fcfa"
          sub="Revenu mensuel récurrent"
        />
        <KpiCard
          icon="users"
          label="Clients actifs"
          period="Offres payantes"
          value={k.clientsActifs}
          format="int"
          sub={`sur ${k.inscritsTotal} inscrit${k.inscritsTotal > 1 ? "s" : ""}`}
        />
        <KpiCard
          icon="check"
          label="Inscrits total"
          period="Depuis le lancement"
          value={k.inscritsTotal}
          format="int"
          sub={`+${k.nouveaux7d} sur 7 jours`}
        />
      </div>

      {/* Ligne secondaire */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard icon="today" label="Nouveaux aujourd'hui" value={k.nouveauxToday} format="int" small />
        <KpiCard icon="calendar" label="Nouveaux (7 j)" value={k.nouveaux7d} format="int" small />
        <KpiCard icon="trending" label="Conversion → payant" value={k.conversion} format="pct" small />
        <KpiCard icon="flask" label="Crédits consommés (mois)" value={k.creditsConsumed} format="int" small />
      </div>

      {/* Marge + répartition */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <KpiCard
          icon="download"
          label="Coût réel estimé"
          period="Crédits consommés × coût unitaire"
          value={k.coutEstime}
          format="fcfa"
          sub="Estimation (paramètre ajustable)"
        />
        <KpiCard
          icon="trending"
          label="Marge nette (en direct)"
          period="Revenu − coût estimé"
          value={k.margeNette}
          format="fcfa"
          tone={k.margeNette >= 0 ? "success" : "danger"}
          highlight
        />
        <PlanBreakdown plans={k.plans} total={k.inscritsTotal} />
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  period,
  value,
  format,
  sub,
  tone,
  highlight = false,
  small = false,
}: {
  icon: React.ComponentProps<typeof Icon>["name"];
  label: string;
  period?: string;
  value: number;
  format: Fmt;
  sub?: string;
  tone?: "success" | "danger";
  highlight?: boolean;
  small?: boolean;
}) {
  const reduce = usePrefersReducedMotion();
  const [active, setActive] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setActive(true));
    return () => cancelAnimationFrame(t);
  }, []);
  const v = useCountUp(Math.round(value), active, reduce, 1000);
  const nf = new Intl.NumberFormat("fr-FR");
  const display =
    format === "fcfa" ? `${nf.format(v)} FCFA` : format === "pct" ? `${v} %` : nf.format(v);

  const valueColor =
    tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-foreground";

  return (
    <div
      className={`rounded-2xl border p-5 transition-shadow hover:shadow-md ${
        highlight
          ? "border-primary/30 from-secondary/40 to-surface bg-gradient-to-b shadow-lg"
          : "border-border bg-surface shadow-card"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground truncate text-sm font-medium">{label}</p>
          {period && !small && (
            <p className="text-muted-foreground/70 mt-0.5 text-[11px]">{period}</p>
          )}
        </div>
        <span className="bg-secondary text-primary grid h-9 w-9 shrink-0 place-items-center rounded-xl">
          <Icon name={icon} size={17} />
        </span>
      </div>
      <p
        className={`mt-3 font-extrabold tabular-nums ${valueColor} ${
          small ? "text-xl" : "text-2xl sm:text-3xl"
        }`}
      >
        {display}
      </p>
      {sub && !small && <p className="text-muted-foreground mt-1 text-xs">{sub}</p>}
    </div>
  );
}

function PlanBreakdown({
  plans,
  total,
}: {
  plans: CockpitData["plans"];
  total: number;
}) {
  const rows = [
    { label: "Gratuit", n: plans.free, c: "bg-muted-foreground/40" },
    { label: "Starter", n: plans.starter, c: "bg-blue-400" },
    { label: "Pro", n: plans.pro, c: "bg-primary" },
    { label: "Business", n: plans.business, c: "bg-emerald-500" },
  ];
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className="border-border bg-surface shadow-card rounded-2xl border p-5">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm font-medium">Répartition par offre</p>
        <span className="bg-secondary text-primary grid h-9 w-9 place-items-center rounded-xl">
          <Icon name="users" size={17} />
        </span>
      </div>
      <div className="mt-3 space-y-2.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2">
            <span className="text-muted-foreground w-16 shrink-0 text-xs">{r.label}</span>
            <div className="bg-input h-2 flex-1 overflow-hidden rounded-full">
              <div
                className={`h-full rounded-full ${r.c}`}
                style={{ width: `${(r.n / max) * 100}%` }}
              />
            </div>
            <span className="text-foreground w-8 shrink-0 text-right text-xs font-bold tabular-nums">
              {r.n}
            </span>
          </div>
        ))}
      </div>
      <p className="text-muted-foreground/70 mt-3 text-[11px]">
        {total} compte{total > 1 ? "s" : ""} au total
      </p>
    </div>
  );
}
