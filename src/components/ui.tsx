import { Icon } from "./Icon";

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
      <div>
        <h1 className="text-lg font-semibold tracking-tight lg:text-xl">
          {title}
        </h1>
        {subtitle && (
          <p className="text-muted-foreground mt-0.5 text-sm">{subtitle}</p>
        )}
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
}: {
  label: string;
  value: string;
  icon: IconName;
  valueClass?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-muted-foreground text-xs font-medium">{label}</p>
        <span className="bg-input text-muted-foreground grid h-8 w-8 shrink-0 place-items-center rounded-lg">
          <Icon name={icon} size={16} />
        </span>
      </div>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${valueClass}`}>
        {value}
      </p>
    </Card>
  );
}
