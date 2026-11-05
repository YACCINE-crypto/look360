import Link from "next/link";
import { Icon } from "./Icon";
import { planLabel } from "@/lib/billing";

/** État de facturation calculé EN BASE (billing_state / my_billing_state). */
export type BillingState = {
  plan: string;
  effective_plan: string;
  period_end: string | null;
  banner: "pending" | "failed" | "expired" | null;
  banner_plan: string | null;
  banner_date: string | null;
};

const fmtDate = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso)) : "";

/**
 * Bandeau d'état d'abonnement (paiement en attente / échoué / expiré).
 * Informatif : les accès sont déjà réduits côté serveur (plan effectif).
 */
export function BillingBanner({ state }: { state: BillingState | null }) {
  if (!state?.banner) return null;
  const plan = planLabel(state.banner_plan);

  const v =
    state.banner === "pending"
      ? {
          tone: "bg-secondary text-accent",
          icon: "clock" as const,
          text: "Ton paiement est en cours de validation, tes accès s'activent dès confirmation.",
          cta: null,
        }
      : state.banner === "failed"
        ? {
            tone: "bg-danger-bg text-danger-fg",
            icon: "bell" as const,
            text: `Ton paiement n'a pas abouti, réessaie pour activer ton abonnement ${plan}.`,
            cta: "Réessayer le paiement",
          }
        : {
            tone: "bg-warn-bg text-warn-fg",
            icon: "bell" as const,
            text: `Ton abonnement ${plan} a expiré${state.banner_date ? ` le ${fmtDate(state.banner_date)}` : ""}, renouvelle pour retrouver tes accès.`,
            cta: `Renouveler ${plan}`,
          };

  return (
    <div role="status" className={`${v.tone} mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl px-4 py-3 text-sm font-medium`}>
      <Icon name={v.icon} size={16} className="shrink-0" />
      <p className="min-w-0 flex-1">{v.text}</p>
      {v.cta && (
        <Link
          href="/offres"
          className="bg-accent text-accent-on hover:bg-accent-hover inline-flex min-h-9 shrink-0 items-center rounded-md px-3.5 text-sm font-semibold transition-colors"
        >
          {v.cta}
        </Link>
      )}
    </div>
  );
}
