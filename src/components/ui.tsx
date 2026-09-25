import { Icon } from "./Icon";
import { Sparkline, type Tone } from "./dataviz";

type IconName = Parameters<typeof Icon>[0]["name"];

/** Carte standard — recette Kimba (bordure fine, coins 16px, ombre subtile). */
export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-surface border-border rounded-xl border shadow-card ${className}`}
    >
      {children}
    </div>
  );
}

/** En-tête de page — recette Kimba (titre text-lg lg:text-xl + slot d'actions). */
export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="from-primary to-primary/40 mt-0.5 h-8 w-1.5 shrink-0 rounded-full bg-gradient-to-b" />
        <div>
          <h1 className="text-lg font-bold tracking-tight lg:text-xl">{title}</h1>
          {subtitle && (
            <p className="text-muted-foreground mt-0.5 text-sm">{subtitle}</p>
          )}
        </div>
      </div>
      {children && (
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      )}
    </div>
  );
}

/** Carte KPI — recette Kimba (label + chiffre clé 24px + icône en badge). */
export function StatCard({
  label,
  value,
  icon,
  valueClass = "",
  trend,
  trendTone = "primary",
}: {
  label: string;
  value: string;
  icon: IconName;
  valueClass?: string;
  trend?: number[];
  trendTone?: Tone;
}) {
  return (
    <Card className="card-lift p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-muted-foreground text-xs font-medium">{label}</p>
        <span className="bg-secondary text-primary grid h-8 w-8 shrink-0 place-items-center rounded-lg">
          <Icon name={icon} size={16} />
        </span>
      </div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p className={`text-2xl font-bold tabular-nums ${valueClass}`}>{value}</p>
        {trend && trend.length >= 2 && (
          <Sparkline data={trend} tone={trendTone} width={72} height={26} />
        )}
      </div>
    </Card>
  );
}
