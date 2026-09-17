import { STATUT_BADGE, STATUT_LABELS, type Statut } from "@/lib/produits";

export function StatusChip({ statut }: { statut: Statut }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-medium ${STATUT_BADGE[statut]}`}
    >
      {STATUT_LABELS[statut]}
    </span>
  );
}
