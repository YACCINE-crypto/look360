import { marcheFlag, marcheLabel } from "@/lib/produits";

/* ============================================================================
 * Primitives data-viz Look360 — SVG/CSS pur (aucune lib, perf mobile), sûres en
 * composant serveur. Couleurs via tokens signal (success / warning / danger).
 * ==========================================================================*/

export type Tone = "success" | "warning" | "danger" | "muted" | "primary";

const TONE_TEXT: Record<Tone, string> = {
  success: "text-success",
  warning: "text-warn",
  danger: "text-danger",
  muted: "text-muted-foreground",
  primary: "text-accent",
};
const TONE_SOFT: Record<Tone, string> = {
  success: "bg-success-bg text-success",
  warning: "bg-warn-bg text-warn",
  danger: "bg-danger-bg text-danger",
  muted: "bg-input text-muted-foreground",
  primary: "bg-secondary text-accent",
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
          <span className="text-fg block text-sm font-bold tabular-nums">
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
    t === "success" ? "bg-success" : t === "warning" ? "bg-warn" : t === "danger" ? "bg-danger" : "bg-accent";
  return (
    <div>
      <div className="bg-muted relative w-full overflow-hidden rounded-full" style={{ height }}>
        <div className={`h-full rounded-full ${fill} transition-all`} style={{ width: `${v}%` }} />
        {target != null && (
          <span
            className="bg-fg/60 absolute top-0 h-full w-px"
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

