"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { usePrefersReducedMotion, useCountUp } from "@/components/landing/anim";
import { planLabel } from "@/lib/billing";

const nf = new Intl.NumberFormat("fr-FR");

export type RevenusData = {
  revenueMonth: number;
  revenueCountMonth: number;
  revenuePrevMonth: number;
  revenueTotal: number;
  mrr: number;
  creditsConsumed: number;
  coutEstime: number;
  margeNette: number;
  series: { month: string; total: number }[];
};

export type LowCredit = {
  user_id: string;
  email: string | null;
  plan: string;
  credits_balance: number;
  monthly_credits: number;
  ratio: number | null;
};
export type FailedPayment = {
  user_id: string;
  email: string | null;
  amount: number;
  plan: string | null;
  status: string;
  created_at: string;
};
export type SuspendedAccount = {
  user_id: string;
  email: string | null;
  plan: string | null;
};

export function Revenus({
  k,
  lowCredits,
  failedPayments,
  suspended,
}: {
  k: RevenusData;
  lowCredits: LowCredit[];
  failedPayments: FailedPayment[];
  suspended: SuspendedAccount[];
}) {
  const delta =
    k.revenuePrevMonth > 0
      ? Math.round(((k.revenueMonth - k.revenuePrevMonth) / k.revenuePrevMonth) * 100)
      : null;
  const alertCount = lowCredits.length + failedPayments.length + suspended.length;

  return (
    <div className="space-y-5">
      {/* KPIs monétaires */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon="store"
          label="Revenu du mois"
          value={k.revenueMonth}
          fcfa
          sub={`${k.revenueCountMonth} paiement${k.revenueCountMonth > 1 ? "s" : ""} réussi${k.revenueCountMonth > 1 ? "s" : ""}`}
          delta={delta}
        />
        <Kpi icon="trending" label="MRR estimé" value={k.mrr} fcfa sub="Abonnements actifs / mois" />
        <Kpi
          icon="download"
          label="Coût réel estimé"
          value={k.coutEstime}
          fcfa
          sub="Crédits consommés × coût unitaire"
        />
        <Kpi
          icon="sparkles"
          label="Marge nette (en direct)"
          value={k.margeNette}
          fcfa
          tone={k.margeNette >= 0 ? "success" : "danger"}
          highlight
          sub="Revenu du mois − coût estimé"
        />
      </div>

      {/* Graphe mensuel + récap */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="border-border bg-surface shadow-card rounded-2xl border p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-foreground font-bold">Revenus encaissés</p>
              <p className="text-muted-foreground text-xs">12 derniers mois — paiements réussis (FCFA)</p>
            </div>
            <span className="bg-secondary text-primary grid h-9 w-9 place-items-center rounded-xl">
              <Icon name="trending" size={17} />
            </span>
          </div>
          <Bars data={k.series} />
        </div>

        <div className="border-border bg-surface shadow-card rounded-2xl border p-5">
          <p className="text-foreground font-bold">Récapitulatif</p>
          <div className="mt-3 space-y-3">
            <MiniRow label="Revenu du mois" value={`${nf.format(k.revenueMonth)} FCFA`} />
            <MiniRow label="Mois précédent" value={`${nf.format(k.revenuePrevMonth)} FCFA`} muted />
            <MiniRow label="Total encaissé" value={`${nf.format(k.revenueTotal)} FCFA`} />
            <MiniRow label="Crédits consommés (mois)" value={nf.format(k.creditsConsumed)} muted />
            <div className="border-border border-t pt-3">
              <MiniRow
                label="Marge nette (mois)"
                value={`${nf.format(k.margeNette)} FCFA`}
                strong
                tone={k.margeNette >= 0 ? "success" : "danger"}
              />
            </div>
          </div>
          <p className="text-muted-foreground/70 mt-3 text-[11px] leading-snug">
            Le coût est une estimation (paramètre ajustable). La marge suit le
            revenu réel encaissé et la consommation réelle de crédits.
          </p>
        </div>
      </div>

      {/* Alertes */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <span
            className={`grid h-8 w-8 place-items-center rounded-xl ${alertCount > 0 ? "bg-danger-bg text-danger" : "bg-success-bg text-success"}`}
          >
            <Icon name="bell" size={16} />
          </span>
          <h2 className="text-foreground text-lg font-bold">
            Alertes {alertCount > 0 && <span className="text-danger">({alertCount})</span>}
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Crédits presque épuisés */}
          <AlertCard
            title="Crédits presque épuisés"
            hint="Comptes payants ≤ 15 % de leur quota"
            icon="flask"
            count={lowCredits.length}
          >
            {lowCredits.map((c) => (
              <AlertRow
                key={c.user_id}
                href={`/admin/clients/${c.user_id}`}
                left={c.email ?? "—"}
                sub={`${planLabel(c.plan)} · ${nf.format(c.credits_balance)} crédits`}
                right={c.ratio != null ? `${c.ratio} %` : "—"}
                tone="danger"
              />
            ))}
          </AlertCard>

          {/* Paiements échoués */}
          <AlertCard
            title="Paiements échoués"
            hint="30 derniers jours"
            icon="lock"
            count={failedPayments.length}
          >
            {failedPayments.map((p, i) => (
              <AlertRow
                key={`${p.user_id}-${i}`}
                href={`/admin/clients/${p.user_id}`}
                left={p.email ?? "—"}
                sub={`${p.plan ? planLabel(p.plan) + " · " : ""}${new Date(p.created_at).toLocaleDateString("fr-FR")}`}
                right={`${nf.format(p.amount)} FCFA`}
                tone="danger"
              />
            ))}
          </AlertCard>

          {/* Comptes suspendus */}
          <AlertCard
            title="Comptes suspendus"
            hint="Accès bloqué"
            icon="eyeOff"
            count={suspended.length}
          >
            {suspended.map((s) => (
              <AlertRow
                key={s.user_id}
                href={`/admin/clients/${s.user_id}`}
                left={s.email ?? "—"}
                sub={s.plan ? planLabel(s.plan) : "—"}
                right="Suspendu"
                tone="muted"
              />
            ))}
          </AlertCard>
        </div>
      </div>
    </div>
  );
}

/* --- Sous-composants -------------------------------------------------------- */

function Kpi({
  icon,
  label,
  value,
  fcfa = false,
  sub,
  tone,
  highlight = false,
  delta,
}: {
  icon: React.ComponentProps<typeof Icon>["name"];
  label: string;
  value: number;
  fcfa?: boolean;
  sub?: string;
  tone?: "success" | "danger";
  highlight?: boolean;
  delta?: number | null;
}) {
  const reduce = usePrefersReducedMotion();
  const [active, setActive] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setActive(true));
    return () => cancelAnimationFrame(t);
  }, []);
  const v = useCountUp(Math.round(value), active, reduce, 1000);
  const display = fcfa ? `${nf.format(v)} FCFA` : nf.format(v);
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
        <p className="text-muted-foreground truncate text-sm font-medium">{label}</p>
        <span className="bg-secondary text-primary grid h-9 w-9 shrink-0 place-items-center rounded-xl">
          <Icon name={icon} size={17} />
        </span>
      </div>
      <p className={`mt-3 text-2xl font-extrabold tabular-nums sm:text-3xl ${valueColor}`}>
        {display}
      </p>
      <div className="mt-1 flex items-center gap-2">
        {sub && <p className="text-muted-foreground text-xs">{sub}</p>}
        {delta != null && (
          <span
            className={`text-[11px] font-semibold ${delta >= 0 ? "text-success" : "text-danger"}`}
          >
            {delta >= 0 ? "+" : ""}
            {delta} %
          </span>
        )}
      </div>
    </div>
  );
}

function Bars({ data }: { data: { month: string; total: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.total));
  const monthLabel = (ym: string) => {
    const [y, m] = ym.split("-").map(Number);
    return new Date(y, (m || 1) - 1, 1)
      .toLocaleDateString("fr-FR", { month: "short" })
      .replace(".", "");
  };
  const compact = (v: number) =>
    v >= 1_000_000
      ? `${(v / 1_000_000).toFixed(1).replace(".0", "")}M`
      : v >= 1_000
        ? `${Math.round(v / 1_000)}k`
        : String(v);

  return (
    <div
      className="flex h-44 items-end gap-1.5"
      role="img"
      aria-label={`Revenus mensuels sur ${data.length} mois`}
    >
      {data.map((d) => (
        <div key={d.month} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <span className="text-muted-foreground h-4 text-[10px] tabular-nums">
            {d.total > 0 ? compact(d.total) : ""}
          </span>
          <div className="flex w-full flex-1 items-end">
            <div
              className={`w-full rounded-t-md transition-all ${d.total > 0 ? "bg-primary" : "bg-input"}`}
              style={{ height: `${Math.max(2, (d.total / max) * 100)}%` }}
              title={`${monthLabel(d.month)} : ${nf.format(d.total)} FCFA`}
            />
          </div>
          <span className="text-muted-foreground/70 text-[10px]">{monthLabel(d.month)}</span>
        </div>
      ))}
    </div>
  );
}

function MiniRow({
  label,
  value,
  muted = false,
  strong = false,
  tone,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
  tone?: "success" | "danger";
}) {
  const color =
    tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-foreground";
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span
        className={`shrink-0 tabular-nums ${strong ? "text-base font-extrabold" : "text-sm font-semibold"} ${muted ? "text-muted-foreground" : color}`}
      >
        {value}
      </span>
    </div>
  );
}

function AlertCard({
  title,
  hint,
  icon,
  count,
  children,
}: {
  title: string;
  hint: string;
  icon: React.ComponentProps<typeof Icon>["name"];
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="border-border bg-surface shadow-card rounded-2xl border">
      <div className="border-border flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className={`grid h-8 w-8 place-items-center rounded-lg ${count > 0 ? "bg-danger-bg text-danger" : "bg-input text-muted-foreground"}`}
          >
            <Icon name={icon} size={15} />
          </span>
          <div>
            <p className="text-foreground text-sm font-bold">{title}</p>
            <p className="text-muted-foreground text-[11px]">{hint}</p>
          </div>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${count > 0 ? "bg-danger-bg text-danger" : "bg-success-bg text-success"}`}
        >
          {count}
        </span>
      </div>
      <div className="divide-border max-h-72 divide-y overflow-y-auto">
        {count === 0 ? (
          <p className="text-muted-foreground px-4 py-6 text-center text-sm">Rien à signaler ✅</p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function AlertRow({
  href,
  left,
  sub,
  right,
  tone,
}: {
  href: string;
  left: string;
  sub: string;
  right: string;
  tone: "danger" | "muted";
}) {
  return (
    <Link href={href} className="hover:bg-input/50 flex items-center justify-between gap-3 px-4 py-2.5 transition-colors">
      <div className="min-w-0">
        <p className="text-foreground truncate text-sm font-medium">{left}</p>
        <p className="text-muted-foreground text-[11px]">{sub}</p>
      </div>
      <span
        className={`shrink-0 text-xs font-bold tabular-nums ${tone === "danger" ? "text-danger" : "text-muted-foreground"}`}
      >
        {right}
      </span>
    </Link>
  );
}
