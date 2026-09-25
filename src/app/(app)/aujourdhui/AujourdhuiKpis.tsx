"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { usePrefersReducedMotion, useCountUp } from "@/components/landing/anim";

type Kpi = {
  label: string;
  value: number | null;
  suffix?: string;
  hint: string;
  icon: Parameters<typeof Icon>[0]["name"];
  tone: "primary" | "success" | "warning";
};

const TONE: Record<Kpi["tone"], { badge: string; val: string }> = {
  primary: { badge: "bg-secondary text-primary", val: "text-foreground" },
  success: { badge: "bg-success-bg text-success", val: "text-success" },
  warning: { badge: "bg-warning-bg text-warning", val: "text-warning" },
};

/** Rangée de KPI animés (count-up) du tableau de bord. */
export function AujourdhuiKpis({
  kpis,
}: {
  kpis: {
    enTest: number;
    tauxValidation: number | null;
    margeMoyenne: number | null;
    enProduction: number;
  };
}) {
  const items: Kpi[] = [
    { label: "Produits en test", value: kpis.enTest, hint: "actifs en ce moment", icon: "flask", tone: "primary" },
    { label: "Taux de validation", value: kpis.tauxValidation, suffix: "%", hint: "produits tranchés", icon: "check", tone: "success" },
    { label: "Marge moyenne", value: kpis.margeMoyenne, suffix: "%", hint: "produits validés", icon: "trending", tone: "warning" },
    { label: "En production", value: kpis.enProduction, hint: "produits actifs", icon: "pipeline", tone: "primary" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((k) => (
        <Tile key={k.label} {...k} />
      ))}
    </div>
  );
}

function Tile({ label, value, suffix, hint, icon, tone }: Kpi) {
  const reduce = usePrefersReducedMotion();
  const [active, setActive] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setActive(true));
    return () => cancelAnimationFrame(t);
  }, []);
  const v = useCountUp(Math.round(value ?? 0), active, reduce, 900);
  const t = TONE[tone];
  return (
    <div className="border-border bg-surface shadow-card card-lift rounded-xl border p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{label}</span>
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${t.badge}`}>
          <Icon name={icon} size={16} />
        </span>
      </div>
      <p className={`mt-2 text-2xl font-extrabold tabular-nums ${t.val}`}>
        {value === null ? "—" : `${v}${suffix ?? ""}`}
      </p>
      <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>
    </div>
  );
}
