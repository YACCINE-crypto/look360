import { Icon } from "@/components/Icon";

const ITEMS = [
  "Afrique + Europe",
  "Paiement mobile money",
  "Sans engagement",
  "Support WhatsApp",
];

/** Bande de confiance honnête sous le hero (aucun chiffre). */
export function TrustStrip() {
  return (
    <div className="border-border bg-surface border-y">
      <div className="text-muted-foreground mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-5 gap-y-2 px-4 py-3 text-xs font-medium sm:gap-x-8 sm:px-6 sm:text-sm">
        {ITEMS.map((label) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <span className="text-success">
              <Icon name="check" size={14} strokeWidth={3} />
            </span>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
