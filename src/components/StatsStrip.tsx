import { Icon } from "./Icon";
import { StatCard } from "./ui";

type IconName = Parameters<typeof Icon>[0]["name"];

export type Stat = {
  label: string;
  value: string;
  icon: IconName;
  valueClass?: string;
};

/** Bandeau de statistiques — grille de cartes KPI (recette Kimba). */
export function StatsStrip({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((s) => (
        <StatCard
          key={s.label}
          label={s.label}
          value={s.value}
          icon={s.icon}
          valueClass={s.valueClass}
        />
      ))}
    </div>
  );
}
