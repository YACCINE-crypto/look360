import { Icon } from "@/components/Icon";

export default function AujourdhuiPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Aujourd&apos;hui</h1>
      <p className="text-muted-foreground text-sm">
        Ton prochain produit à traiter, un à la fois.
      </p>

      <div className="border-border bg-surface mt-8 flex flex-col items-center gap-3 rounded-xl border border-dashed p-12 text-center">
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
