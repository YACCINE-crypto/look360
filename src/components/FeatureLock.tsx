import Link from "next/link";
import { Icon } from "./Icon";

/**
 * Carte "fonctionnalité réservée à une offre supérieure" (upsell).
 * Rendue à la place de la fonctionnalité quand l'offre de l'utilisateur ne la
 * couvre pas. Le contrôle réel reste CÔTÉ SERVEUR (actions) — ceci est l'UX.
 */
export function FeatureLock({
  title,
  minPlan,
  description,
}: {
  title: string;
  minPlan: string;
  description: string;
}) {
  return (
    <div className="border-border bg-surface rounded-2xl border border-dashed p-10 text-center">
      <span className="bg-secondary text-primary mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full">
        <Icon name="lock" size={26} />
      </span>
      <p className="text-lg font-bold">{title}</p>
      <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
        {description}
      </p>
      <p className="text-primary mt-3 inline-flex items-center gap-1.5 text-sm font-semibold">
        <Icon name="trophy" size={15} /> Inclus à partir de l&apos;offre {minPlan}
      </p>
      <div className="mt-5">
        <Link
          href="/offres"
          className="bg-primary text-primary-foreground inline-flex min-h-[46px] items-center justify-center gap-1.5 rounded-full px-6 text-sm font-semibold transition-opacity hover:opacity-90"
        >
          Passer à l&apos;offre {minPlan}
        </Link>
      </div>
    </div>
  );
}
