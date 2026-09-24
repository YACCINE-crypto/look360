import { Icon } from "@/components/Icon";
import { RevealOnScroll } from "./RevealOnScroll";

type Cell = boolean | string; // true = ✅ · string = ❌ + précision · false = ❌

const ROWS: {
  feature: string;
  strong?: boolean;
  testing?: boolean;
  look: Cell;
  autres: Cell;
}[] = [
  { feature: "Trouver des pubs gagnantes (Facebook)", look: true, autres: true },
  {
    feature: "Winners Afrique + Europe",
    strong: true,
    look: true,
    autres: "Afrique uniquement",
  },
  { feature: "Tester le produit sur ton marché", look: true, autres: false },
  {
    feature: "Taux de closing COD réel",
    strong: true,
    testing: true,
    look: true,
    autres: false,
  },
  {
    feature: "Marge nette + verdict rentable/pas",
    strong: true,
    testing: true,
    look: true,
    autres: false,
  },
  { feature: "Éviter d'acheter un stock à l'aveugle", look: true, autres: false },
  { feature: "Vitrine des winners validés", look: true, autres: false },
  {
    feature: "Pensé COD africain (mobile money, FCFA)",
    look: true,
    autres: false,
  },
];

export function ComparatifSection() {
  return (
    <section id="comparatif" className="scroll-mt-20 px-4 py-12 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <RevealOnScroll>
          <div className="text-center">
            <h2 className="text-foreground mx-auto max-w-3xl text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Les autres s&apos;arrêtent à «&nbsp;voici une pub&nbsp;». Look360 va
              jusqu&apos;à «&nbsp;voici si ça va te rapporter&nbsp;».
            </h2>
            <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-base">
              Trouver une pub qui tourne, c&apos;est la partie facile — tout le
              monde le fait. La vraie question, c&apos;est : est-ce que ça va
              vendre et être rentable sur <span className="font-semibold">ton</span>{" "}
              marché ? C&apos;est là que Look360 est seul.
            </p>
          </div>
        </RevealOnScroll>

        <RevealOnScroll delay={120}>
          <div className="border-border bg-surface shadow-card mt-8 overflow-hidden rounded-2xl border sm:mt-12">
            {/* En-tête */}
            <div className="border-border grid grid-cols-[1fr_auto_auto] items-center gap-1.5 border-b px-3 py-4 sm:gap-2 sm:px-6">
              <span className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide sm:text-xs">
                Fonctionnalité
              </span>
              <span className="text-primary w-16 text-center text-sm font-extrabold sm:w-32">
                Look360
              </span>
              <span className="text-muted-foreground w-16 text-center text-[10px] font-semibold leading-tight sm:w-32 sm:text-xs">
                <span className="sm:hidden">Autres</span>
                <span className="hidden sm:inline">Les autres spy tools</span>
              </span>
            </div>

            {/* Lignes */}
            {ROWS.map((r, i) => (
              <div
                key={i}
                className={`grid grid-cols-[1fr_auto_auto] items-center gap-1.5 px-3 py-3.5 sm:gap-2 sm:px-6 ${
                  r.testing
                    ? "bg-secondary/40"
                    : i % 2 === 1
                      ? "bg-background/50"
                      : ""
                }`}
              >
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span
                    className={`text-[13px] sm:text-sm ${
                      r.strong
                        ? "text-foreground font-semibold"
                        : "text-foreground"
                    }`}
                  >
                    {r.feature}
                  </span>
                  {r.testing && (
                    <span className="bg-primary text-primary-foreground hidden rounded-full px-2 py-0.5 text-[10px] font-bold sm:inline">
                      Testing
                    </span>
                  )}
                </span>
                <span className="flex w-16 justify-center sm:w-32">
                  <CellMark cell={r.look} positive />
                </span>
                <span className="flex w-16 justify-center sm:w-32">
                  <CellMark cell={r.autres} />
                </span>
              </div>
            ))}
          </div>
        </RevealOnScroll>

        <RevealOnScroll delay={200}>
          <p className="text-foreground mx-auto mt-8 max-w-2xl text-center text-lg font-semibold">
            N&apos;importe quel outil te montre une pub. Un seul te dit si tu vas
            gagner de l&apos;argent avec.
          </p>
        </RevealOnScroll>
      </div>
    </section>
  );
}

function CellMark({ cell, positive = false }: { cell: Cell; positive?: boolean }) {
  if (cell === true) {
    return (
      <span
        className={`grid h-7 w-7 place-items-center rounded-full ${
          positive ? "bg-success-bg text-success" : "bg-input text-muted-foreground"
        }`}
      >
        <Icon name="check" size={15} strokeWidth={3} />
      </span>
    );
  }
  // ❌ (avec précision éventuelle)
  return (
    <span className="flex flex-col items-center gap-1">
      <span className="bg-danger-bg text-danger grid h-7 w-7 place-items-center rounded-full">
        <Icon name="x" size={14} strokeWidth={3} />
      </span>
      {typeof cell === "string" && (
        <span className="text-muted-foreground text-[10px] leading-tight">
          {cell}
        </span>
      )}
    </span>
  );
}
