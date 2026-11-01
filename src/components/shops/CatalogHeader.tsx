import { PageHeader } from "@/components/ui";

const nf = new Intl.NumberFormat("fr-FR");

/** En-tête d'une page catalogue : titre + 3 chiffres réels. */
export function CatalogHeader({
  title,
  subtitle,
  stats,
}: {
  title: string;
  subtitle: string;
  stats: { label: string; value: number }[];
}) {
  return (
    <div className="space-y-4">
      <PageHeader title={title} subtitle={subtitle} />
      <dl className="border-border bg-surface shadow-card grid grid-cols-3 divide-x divide-border overflow-hidden rounded-xl border">
        {stats.map((s) => (
          <div key={s.label} className="px-4 py-3">
            <dt className="text-muted-foreground truncate text-xs">{s.label}</dt>
            <dd className="text-fg text-xl font-bold tabular-nums">{nf.format(s.value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
