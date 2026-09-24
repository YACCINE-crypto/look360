"use client";

import { useInView, usePrefersReducedMotion, useCountUp } from "./anim";

export type Stat = {
  label: string;
  value: number | null; // null = donnée indisponible → « — »
  suffix?: string;
};

/** Bande de compteurs animés au scroll (données réelles passées par le serveur). */
export function StatsBar({ stats }: { stats: Stat[] }) {
  const [ref, inView] = useInView<HTMLDivElement>(0.4);
  const reduce = usePrefersReducedMotion();
  return (
    <div ref={ref} className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      {stats.map((s, i) => (
        <StatItem key={i} stat={s} active={inView} reduce={reduce} />
      ))}
    </div>
  );
}

function StatItem({
  stat,
  active,
  reduce,
}: {
  stat: Stat;
  active: boolean;
  reduce: boolean;
}) {
  const v = useCountUp(stat.value ?? 0, active && stat.value != null, reduce);
  return (
    <div className="border-border bg-surface shadow-card rounded-2xl border p-4 text-center sm:p-5">
      <p className="text-primary text-3xl font-extrabold tabular-nums sm:text-4xl">
        {stat.value == null ? "—" : v}
        {stat.value != null && stat.suffix ? stat.suffix : ""}
      </p>
      <p className="text-muted-foreground mt-1 text-xs sm:text-sm">{stat.label}</p>
    </div>
  );
}
