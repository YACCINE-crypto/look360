import Link from "next/link";
import { Icon } from "@/components/Icon";
import { RevealOnScroll } from "./RevealOnScroll";

/** Petit CTA répété entre les sections clés. */
export function CtaInline({ label = "Commencer gratuitement" }: { label?: string }) {
  return (
    <div className="px-4 py-8 text-center sm:px-6">
      <RevealOnScroll>
        <Link
          href="/signup"
          className="bg-primary text-primary-foreground shadow-primary/25 inline-flex min-h-[50px] items-center gap-2 rounded-xl px-7 text-base font-semibold shadow-lg transition-transform hover:scale-[1.03] active:scale-95"
        >
          {label} <Icon name="chevronRight" size={18} />
        </Link>
        <p className="text-muted-foreground mt-2 text-xs">
          Aucune carte bancaire requise
        </p>
      </RevealOnScroll>
    </div>
  );
}
