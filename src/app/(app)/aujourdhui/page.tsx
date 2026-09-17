import { Icon } from "@/components/Icon";
import { PageHeader } from "@/components/ui";

export default function AujourdhuiPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Aujourd'hui"
        subtitle="Ton prochain produit à traiter, un à la fois."
      />

      <div className="border-border bg-surface flex flex-col items-center gap-3 rounded-xl border border-dashed p-12 text-center">
        <span className="bg-secondary text-primary grid h-12 w-12 place-items-center rounded-full">
          <Icon name="today" size={24} />
        </span>
        <p className="font-medium">Écran à venir</p>
        <p className="text-muted-foreground max-w-sm text-sm">
          Le tableau « Aujourd&apos;hui » (rappel anti-procrastination, un seul
          produit dû à la fois) arrive avec l&apos;étape des notifications.
        </p>
      </div>
    </div>
  );
}
