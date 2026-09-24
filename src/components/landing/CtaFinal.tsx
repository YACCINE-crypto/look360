import Link from "next/link";
import { Icon } from "@/components/Icon";
import { RevealOnScroll } from "./RevealOnScroll";

/** CTA final pleine largeur (STEP 7). */
export function CtaFinal() {
  return (
    <section className="px-4 pb-16 pt-4 sm:px-6 sm:pb-24">
      <RevealOnScroll>
        <div className="from-primary relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-gradient-to-br to-blue-600 px-6 py-14 text-center sm:py-20">
          {/* halo décoratif discret */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-white/10 blur-3xl"
          />
          <h2 className="relative text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Arrête de deviner. Commence à valider.
          </h2>
          <p className="relative mx-auto mt-4 max-w-2xl text-base text-white/85">
            Trouve, teste, valide — et investis seulement sur ce qui marche.
          </p>
          <div className="relative mt-8 flex flex-col items-center gap-3">
            <Link
              href="/login?tab=signup"
              className="text-primary inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-white px-8 text-base font-bold shadow-lg transition-transform hover:scale-[1.03] active:scale-95"
            >
              Commencer gratuitement <Icon name="chevronRight" size={18} />
            </Link>
            <p className="text-xs text-white/75">Aucune carte bancaire requise</p>
          </div>
        </div>
      </RevealOnScroll>
    </section>
  );
}
