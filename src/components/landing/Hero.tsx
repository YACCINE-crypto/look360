import Link from "next/link";
import { Icon } from "@/components/Icon";
import { RevealOnScroll } from "./RevealOnScroll";
import { HeroPreview } from "./HeroPreview";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Fond dégradé doux (bleu de marque en haut, sans excès) */}
      <div
        aria-hidden
        className="from-secondary/50 pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b via-background to-background"
      />

      <div className="mx-auto max-w-6xl px-4 pb-10 pt-12 sm:px-6 sm:pt-24">
        <RevealOnScroll>
          <div className="mx-auto max-w-3xl text-center">
            {/* Eyebrow pill */}
            <span className="border-border bg-surface/80 text-primary shadow-card inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-bold tracking-wide backdrop-blur sm:px-3.5 sm:text-xs">
              <span className="bg-primary inline-block h-1.5 w-1.5 shrink-0 rounded-full" />
              <span className="whitespace-nowrap">SPY FACEBOOK · TESTING COD · WINNERS</span>
            </span>

            {/* Titre avec accent bleu */}
            <h1 className="text-foreground mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
              Trouver un produit gagnant{" "}
              <span className="text-primary">ne suffit pas.</span>
            </h1>

            {/* Sous-titre */}
            <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-base sm:text-lg">
              Avec Look360, repère les winners en Afrique et en Europe, teste
              leur rentabilité réelle en COD, et investis seulement sur ceux qui
              le méritent.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/login?tab=signup"
                className="bg-primary text-primary-foreground shadow-primary/25 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl px-7 text-base font-semibold shadow-lg transition-transform hover:scale-[1.03] active:scale-95 sm:w-auto"
              >
                Commencer gratuitement
                <Icon name="chevronRight" size={18} />
              </Link>
              <a
                href="#etapes"
                className="border-border bg-surface text-foreground hover:bg-input inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border px-7 text-base font-semibold transition-colors sm:w-auto"
              >
                <Icon name="play" size={16} /> Voir comment ça marche
              </a>
            </div>
            <p className="text-muted-foreground mt-3 text-xs">
              Aucune carte bancaire requise
            </p>
          </div>
        </RevealOnScroll>

        {/* Aperçu de l'app */}
        <RevealOnScroll delay={120}>
          <div className="mt-10 sm:mt-14">
            <HeroPreview />
          </div>
        </RevealOnScroll>

        {/* Barre de confiance */}
        <RevealOnScroll delay={200}>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:mt-10 sm:flex-row">
            <AvatarCluster />
            <p className="text-muted-foreground text-sm">
              Rejoins les premiers commerçants sur Look360
            </p>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}

/** Avatars neutres (placeholders) — aucune fausse identité. */
function AvatarCluster() {
  const tints = [
    "from-blue-400 to-blue-600",
    "from-emerald-400 to-emerald-600",
    "from-amber-400 to-amber-600",
    "from-rose-400 to-rose-600",
    "from-violet-400 to-violet-600",
  ];
  return (
    <div className="flex -space-x-3">
      {tints.map((t, i) => (
        <span
          key={i}
          className={`border-surface grid h-9 w-9 place-items-center rounded-full border-2 bg-gradient-to-br ${t} text-white`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5z" />
          </svg>
        </span>
      ))}
    </div>
  );
}
