import { Icon } from "./Icon";

type IconName = Parameters<typeof Icon>[0]["name"];

export type Stat = {
  label: string;
  value: string;
  icon: IconName;
  valueClass?: string;
};

export function StatsStrip({ stats }: { stats: Stat[] }) {
  return (
    <div className="border-border bg-surface flex flex-wrap items-center gap-x-8 gap-y-4 rounded-xl border px-5 py-4">
      {stats.map((s) => (
        <div key={s.label} className="flex items-center gap-3">
          <span className="bg-input text-muted-foreground grid h-9 w-9 shrink-0 place-items-center rounded-md">
            <Icon name={s.icon} size={18} />
          </span>
          <div>
            <p className="text-muted-foreground text-xs font-medium">
              {s.label}
            </p>
            <p className={`text-lg font-bold tabular-nums ${s.valueClass ?? ""}`}>
              {s.value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
