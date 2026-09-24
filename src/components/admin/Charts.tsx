"use client";

import { Icon } from "@/components/Icon";

export type MonthPoint = { month: string; value: number };

const nf = new Intl.NumberFormat("fr-FR");
function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, (m || 1) - 1, 1)
    .toLocaleDateString("fr-FR", { month: "short" })
    .replace(".", "");
}
function compact(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(".0", "")}M`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}k`;
  return String(v);
}

export function Charts({
  revenue,
  signups,
  plans,
}: {
  revenue: MonthPoint[];
  signups: MonthPoint[];
  plans: { free: number; starter: number; pro: number; business: number };
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="border-border bg-surface shadow-card rounded-2xl border p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-foreground font-bold">Revenus dans le temps</p>
              <p className="text-muted-foreground text-xs">12 derniers mois (FCFA)</p>
            </div>
            <span className="bg-secondary text-primary grid h-9 w-9 place-items-center rounded-xl">
              <Icon name="trending" size={17} />
            </span>
          </div>
          <AreaChart data={revenue} unit=" FCFA" />
        </div>

        <div className="border-border bg-surface shadow-card rounded-2xl border p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-foreground font-bold">Clients par offre</p>
              <p className="text-muted-foreground text-xs">Répartition actuelle</p>
            </div>
            <span className="bg-secondary text-primary grid h-9 w-9 place-items-center rounded-xl">
              <Icon name="users" size={17} />
            </span>
          </div>
          <Donut plans={plans} />
        </div>
      </div>

      <div className="border-border bg-surface shadow-card rounded-2xl border p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-foreground font-bold">Inscriptions dans le temps</p>
            <p className="text-muted-foreground text-xs">12 derniers mois</p>
          </div>
          <span className="bg-secondary text-primary grid h-9 w-9 place-items-center rounded-xl">
            <Icon name="users" size={17} />
          </span>
        </div>
        <Bars data={signups} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Aire (revenus) */

function AreaChart({ data, unit = "" }: { data: MonthPoint[]; unit?: string }) {
  const W = 640;
  const H = 200;
  const pad = { l: 8, r: 8, t: 12, b: 22 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const n = data.length;
  const max = Math.max(1, ...data.map((d) => d.value));
  const x = (i: number) => pad.l + (n <= 1 ? innerW / 2 : (i * innerW) / (n - 1));
  const y = (v: number) => pad.t + innerH - (v / max) * innerH;

  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.value)}`).join(" ");
  const area = `${line} L${x(n - 1)},${pad.t + innerH} L${x(0)},${pad.t + innerH} Z`;
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="text-primary">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-48 w-full"
        role="img"
        aria-label={`Revenus sur 12 mois, total ${nf.format(total)}${unit}`}
      >
        <defs>
          <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* grille horizontale légère */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={pad.l}
            x2={W - pad.r}
            y1={pad.t + innerH * f}
            y2={pad.t + innerH * f}
            className="text-border"
            stroke="currentColor"
            strokeWidth="1"
          />
        ))}
        <path d={area} fill="url(#revFill)" />
        <path d={line} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 6}
            textAnchor="middle"
            className="fill-muted-foreground text-[9px]"
          >
            {monthLabel(d.month)}
          </text>
        ))}
      </svg>
      <p className="text-muted-foreground mt-1 text-[11px]">
        Max mensuel : <span className="text-foreground font-semibold">{nf.format(max)}{unit}</span>
      </p>
    </div>
  );
}

/* ------------------------------------------------------- Barres (inscriptions) */

function Bars({ data }: { data: MonthPoint[] }) {
  const W = 640;
  const H = 180;
  const pad = { l: 8, r: 8, t: 12, b: 22 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const n = data.length;
  const max = Math.max(1, ...data.map((d) => d.value));
  const bw = (innerW / n) * 0.6;
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="text-primary">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-44 w-full"
        role="img"
        aria-label={`Inscriptions sur 12 mois, total ${total}`}
      >
        {data.map((d, i) => {
          const cx = pad.l + (i + 0.5) * (innerW / n);
          const h = (d.value / max) * innerH;
          return (
            <g key={i}>
              <rect
                x={cx - bw / 2}
                y={pad.t + innerH - h}
                width={bw}
                height={h}
                rx="3"
                fill="currentColor"
                opacity={0.85}
              />
              <text x={cx} y={H - 6} textAnchor="middle" className="fill-muted-foreground text-[9px]">
                {monthLabel(d.month)}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="text-muted-foreground mt-1 text-[11px]">
        Total sur 12 mois : <span className="text-foreground font-semibold">{total}</span>
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- Donut (offres) */

function Donut({
  plans,
}: {
  plans: { free: number; starter: number; pro: number; business: number };
}) {
  const segs = [
    { label: "Gratuit", value: plans.free, color: "#9ca3af" },
    { label: "Starter", value: plans.starter, color: "#60a5fa" },
    { label: "Pro", value: plans.pro, color: "#1a56db" },
    { label: "Business", value: plans.business, color: "#10b981" },
  ];
  const total = segs.reduce((s, x) => s + x.value, 0);
  const R = 42;
  const C = 2 * Math.PI * R;
  let acc = 0;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <svg viewBox="0 0 120 120" className="h-32 w-32 shrink-0" role="img" aria-label={`Répartition par offre, ${total} comptes`}>
        <circle cx="60" cy="60" r={R} fill="none" stroke="var(--color-input)" strokeWidth="16" />
        {total > 0 &&
          segs.map((s, i) => {
            const dash = (s.value / total) * C;
            const el = (
              <circle
                key={i}
                cx="60"
                cy="60"
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth="16"
                strokeDasharray={`${dash} ${C - dash}`}
                strokeDashoffset={-acc}
                transform="rotate(-90 60 60)"
              />
            );
            acc += dash;
            return el;
          })}
        <text x="60" y="56" textAnchor="middle" className="fill-foreground text-[16px] font-extrabold">
          {total}
        </text>
        <text x="60" y="72" textAnchor="middle" className="fill-muted-foreground text-[8px]">
          comptes
        </text>
      </svg>
      <ul className="w-full space-y-1.5">
        {segs.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            <span className="text-muted-foreground flex-1">{s.label}</span>
            <span className="text-foreground font-bold tabular-nums">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
