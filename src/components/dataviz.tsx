import Link from "next/link";
import { Icon } from "./Icon";
import { marcheFlag, marcheLabel } from "@/lib/produits";

/* ============================================================================
 * Primitives data-viz Look360 — SVG/CSS pur (aucune lib, perf mobile), sûres en
 * composant serveur. Couleurs via tokens signal (success / warning / danger).
 * ==========================================================================*/

export type Tone = "success" | "warning" | "danger" | "muted" | "primary";

const TONE_TEXT: Record<Tone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  muted: "text-muted-foreground",
  primary: "text-primary",
};
const TONE_SOFT: Record<Tone, string> = {
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
  muted: "bg-input text-muted-foreground",
  primary: "bg-secondary text-primary",
};

/** Palier de closing → tonalité (vert ≥60 / ambre 35-60 / rouge <35). */
export function closingTone(taux: number | null | undefined): Tone {
  if (taux == null) return "muted";
  if (taux >= 60) return "success";
  if (taux >= 35) return "warning";
  return "danger";
}
/** Palier de marge → tonalité (vert ≥30 / ambre 15-30 / rouge <15). */
export function margeTone(pct: number | null | undefined): Tone {
  if (pct == null) return "muted";
  if (pct >= 30) return "success";
  if (pct >= 15) return "warning";
  return "danger";
}

/* --- Anneau de progression (closing) --------------------------------------- */
export function ProgressRing({
  value,
  tone,
  size = 56,
  stroke = 6,
  label,
  sublabel,
}: {
  value: number | null;
  tone?: Tone;
  size?: number;
  stroke?: number;
  label?: string;
  sublabel?: string;
}) {
  const v = value == null ? 0 : Math.max(0, Math.min(100, value));
  const t = tone ?? closingTone(value);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (v / 100) * c;

  return (
    <div
      className={`relative inline-grid shrink-0 place-items-center ${TONE_TEXT[t]}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label ?? "Valeur"} : ${value == null ? "non renseigné" : `${Math.round(v)} %`}`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-muted opacity-40"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center leading-none">
        <div>
          <span className="text-foreground block text-sm font-bold tabular-nums">
            {value == null ? "—" : `${Math.round(v)}%`}
          </span>
          {sublabel && (
            <span className="text-muted-foreground block text-[9px] font-medium uppercase tracking-wide">
              {sublabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* --- Jauge / barre (marge) ------------------------------------------------- */
export function MeterBar({
  value,
  tone,
  target,
  targetLabel,
  height = 8,
}: {
  value: number | null;
  tone?: Tone;
  target?: number; // marqueur d'objectif (0-100)
  targetLabel?: string;
  height?: number;
}) {
  const v = value == null ? 0 : Math.max(0, Math.min(100, value));
  const t = tone ?? margeTone(value);
  const fill =
    t === "success" ? "bg-success" : t === "warning" ? "bg-warning" : t === "danger" ? "bg-danger" : "bg-primary";
  return (
    <div>
      <div className="bg-muted relative w-full overflow-hidden rounded-full" style={{ height }}>
        <div className={`h-full rounded-full ${fill} transition-all`} style={{ width: `${v}%` }} />
        {target != null && (
          <span
            className="bg-foreground/60 absolute top-0 h-full w-px"
            style={{ left: `${Math.max(0, Math.min(100, target))}%` }}
            title={targetLabel}
          />
        )}
      </div>
    </div>
  );
}

/* --- Gros badge verdict ---------------------------------------------------- */
export function VerdictBadge({
  label,
  tone,
  size = "md",
}: {
  label: string;
  tone: Tone;
  size?: "sm" | "md" | "lg";
}) {
  const pad =
    size === "lg" ? "px-4 py-2 text-base" : size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${TONE_SOFT[tone]} ${pad}`}
    >
      <span className="h-2 w-2 rounded-full bg-current" />
      {label}
    </span>
  );
}

/* --- Mini-courbe (sparkline) ----------------------------------------------- */
export function Sparkline({
  data,
  tone = "primary",
  width = 96,
  height = 28,
  area = true,
}: {
  data: number[];
  tone?: Tone;
  width?: number;
  height?: number;
  area?: boolean;
}) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const stepX = width / (data.length - 1);
  const pts = data.map((d, i) => {
    const x = i * stepX;
    const y = height - 3 - ((d - min) / span) * (height - 6);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${line} L${width},${height} L0,${height} Z`;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`${TONE_TEXT[tone]} overflow-visible`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {area && <path d={areaPath} fill="currentColor" className="opacity-10" />}
      <path d={line} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={2.4} fill="currentColor" />
    </svg>
  );
}

/* --- Drapeau pays ---------------------------------------------------------- */
export function CountryFlag({
  code,
  withLabel = false,
  className = "",
}: {
  code: string | null;
  withLabel?: boolean;
  className?: string;
}) {
  const flag = marcheFlag(code);
  if (!flag && !code) return null;
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} title={marcheLabel(code)}>
      <span className="text-sm leading-none" aria-hidden="true">
        {flag || "🏳️"}
      </span>
      {withLabel && <span className="truncate">{marcheLabel(code)}</span>}
    </span>
  );
}

/* --- État vide : aperçu flouté + CTA --------------------------------------- */
export function EmptyPreview({
  icon,
  title,
  description,
  ctaHref,
  ctaLabel,
  variant = "cards",
}: {
  icon: Parameters<typeof Icon>[0]["name"];
  title: string;
  description: string;
  ctaHref: string;
  ctaLabel: string;
  variant?: "cards" | "list" | "board";
}) {
  return (
    <div className="border-border bg-surface relative overflow-hidden rounded-2xl border">
      {/* Aperçu squelette flouté (montre à quoi ça ressemblera) */}
      <div aria-hidden="true" className="pointer-events-none select-none blur-[3px] opacity-50 saturate-50">
        {variant === "cards" && <SkeletonCards />}
        {variant === "list" && <SkeletonList />}
        {variant === "board" && <SkeletonBoard />}
      </div>
      {/* Voile + CTA */}
      <div className="from-surface/40 to-surface absolute inset-0 bg-gradient-to-b" />
      <div className="absolute inset-0 grid place-items-center p-6">
        <div className="text-center">
          <span className="bg-secondary text-primary mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl shadow-sm">
            <Icon name={icon} size={26} />
          </span>
          <p className="text-foreground text-base font-bold">{title}</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-xs text-sm">{description}</p>
          <Link
            href={ctaHref}
            className="bg-primary text-primary-foreground shadow-primary/25 mt-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-5 text-sm font-semibold shadow-lg transition-transform hover:scale-[1.03] active:scale-95"
          >
            {ctaLabel} <Icon name="chevronRight" size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}

function SkeletonCards() {
  return (
    <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="border-border overflow-hidden rounded-xl border">
          <div className="bg-input aspect-square w-full" />
          <div className="space-y-2 p-3">
            <div className="bg-input h-3 w-3/4 rounded" />
            <div className="bg-input h-3 w-1/2 rounded" />
            <div className="bg-input mt-3 h-8 w-full rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}
function SkeletonList() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="border-border flex gap-3 rounded-xl border p-3">
          <div className="bg-input h-20 w-20 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2 py-1">
            <div className="bg-input h-3 w-2/3 rounded" />
            <div className="bg-input h-3 w-1/3 rounded" />
            <div className="bg-input mt-3 h-2 w-full rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
function SkeletonBoard() {
  return (
    <div className="flex gap-3 p-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="border-border flex-1 space-y-3 rounded-xl border p-3">
          <div className="bg-input h-3 w-1/2 rounded" />
          {Array.from({ length: 2 }).map((__, j) => (
            <div key={j} className="border-border overflow-hidden rounded-lg border">
              <div className="bg-input aspect-video w-full" />
              <div className="space-y-2 p-2">
                <div className="bg-input h-2.5 w-3/4 rounded" />
                <div className="bg-input h-2.5 w-1/2 rounded" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
