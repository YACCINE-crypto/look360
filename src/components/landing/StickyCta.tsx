import Link from "next/link";
import { Icon } from "@/components/Icon";

/**
 * Barre CTA collante en bas, MOBILE uniquement (md:hidden). Le bouton WhatsApp
 * flottant est remonté (bottom-20) pour ne pas la chevaucher.
 */
export function StickyCta() {
  return (
    <div className="border-border bg-surface/95 fixed inset-x-0 bottom-0 z-40 border-t px-4 py-2.5 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-md items-center gap-3">
        <p className="text-foreground flex-1 text-xs font-semibold leading-tight">
          Commence gratuit
          <span className="text-muted-foreground block font-normal">
            Sans carte bancaire
          </span>
        </p>
        <Link
          href="/login?tab=signup"
          className="bg-primary text-primary-foreground inline-flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-full px-5 text-sm font-semibold"
        >
          Commencer <Icon name="chevronRight" size={16} />
        </Link>
      </div>
    </div>
  );
}
