import { Icon } from "@/components/Icon";
import { RevealOnScroll } from "./RevealOnScroll";

const STEPS = [
  {
    n: "01",
    icon: "search" as const,
    title: "Trouve",
    body: "Repère les produits qui cartonnent déjà en Afrique et en Europe. Pas juste « beaucoup de pubs » : les vrais winners.",
  },
  {
    n: "02",
    icon: "flask" as const,
    title: "Teste",
    body: "Lance le produit sur ton marché et mesure ton taux de closing COD réel.",
    hint: "Un test devient valable à partir de 10 commandes reçues.",
  },
  {
    n: "03",
    icon: "check" as const,
    title: "Valide",
    body: "Vérifie la marge, obtiens le verdict rentable / pas rentable, et investis dans le stock seulement si c'est validé.",
  },
];

export function EtapesSection() {
  return (
    <section id="etapes" className="scroll-mt-20 px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        {/* AVANT / APRÈS */}
        <RevealOnScroll>
          <div className="grid gap-4 md:grid-cols-2">
            {/* Avant */}
            <div className="rounded-2xl border border-danger/25 bg-danger-bg/40 p-6">
              <div className="text-danger inline-flex items-center gap-2 text-sm font-bold">
                <span className="bg-danger/15 grid h-6 w-6 place-items-center rounded-full">
                  <Icon name="x" size={13} strokeWidth={3} />
                </span>
                AVANT
              </div>
              <p className="text-foreground mt-3 text-sm leading-relaxed">
                Plein de pubs tournent sur un produit → tu commandes le stock →
                il dort. Le nombre de pubs ne dit pas si ça vend sur{" "}
                <span className="font-semibold">ton</span> marché.
              </p>
            </div>
            {/* Après */}
            <div className="rounded-2xl border border-success/30 bg-success-bg/50 p-6">
              <div className="text-success inline-flex items-center gap-2 text-sm font-bold">
                <span className="bg-success/15 grid h-6 w-6 place-items-center rounded-full">
                  <Icon name="check" size={13} strokeWidth={3} />
                </span>
                APRÈS
              </div>
              <p className="text-foreground mt-3 text-sm leading-relaxed">
                Tu testes le produit sur ton marché et tu vérifies sa
                rentabilité <span className="font-semibold">avant</span> de
                commander. Tu investis seulement sur ce qui est prouvé.
              </p>
            </div>
          </div>
        </RevealOnScroll>

        {/* Titre section */}
        <RevealOnScroll>
          <div className="mt-16 text-center">
            <h2 className="text-foreground text-3xl font-extrabold tracking-tight sm:text-4xl">
              Comment ça marche
            </h2>
            <p className="text-muted-foreground mx-auto mt-3 max-w-xl text-base">
              Trois étapes pour arrêter de deviner et investir sur du prouvé.
            </p>
          </div>
        </RevealOnScroll>

        {/* 3 étapes */}
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <RevealOnScroll key={s.n} delay={i * 120}>
              <div className="border-border bg-surface shadow-card relative flex h-full flex-col rounded-2xl border p-6 transition-shadow hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="bg-secondary text-primary grid h-12 w-12 place-items-center rounded-xl">
                    <Icon name={s.icon} size={22} />
                  </span>
                  <span className="text-muted/70 text-4xl font-extrabold tabular-nums">
                    {s.n}
                  </span>
                </div>
                <h3 className="text-foreground mt-5 text-lg font-bold tracking-tight">
                  {s.title}
                </h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {s.body}
                </p>
                {s.hint && (
                  <p className="text-primary bg-secondary/60 mt-4 rounded-lg px-3 py-2 text-xs font-medium">
                    {s.hint}
                  </p>
                )}
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
