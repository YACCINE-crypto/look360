import { Icon } from "@/components/Icon";
import { RevealOnScroll } from "./RevealOnScroll";

const FAQ: { q: string; a: string }[] = [
  {
    q: "C'est quoi Look360 exactement ?",
    a: "Un outil qui t'aide à trouver des produits gagnants (spy Facebook, Afrique + Europe) ET à vérifier s'ils sont vraiment rentables avant d'investir, grâce au testing COD (taux de closing, marge, verdict).",
  },
  {
    q: "En quoi c'est différent d'un spy tool classique ?",
    a: "Un spy tool te montre des pubs qui tournent. Look360 va plus loin : il te dit si le produit va réellement se vendre et être rentable sur ton marché. Trouver la pub, c'est facile — savoir si ça paie, c'est ça qui compte.",
  },
  {
    q: "Ça marche pour le COD en Afrique ?",
    a: "Oui, c'est fait pour ça. Winners Afrique + Europe, taux de closing, marge, paiement mobile money. Pensé pour les dropshippers africains.",
  },
  {
    q: "Je paie comment ?",
    a: "Par mobile money (Orange Money, Wave, MTN...). Pas besoin de carte bancaire.",
  },
  {
    q: "Y a une version gratuite ?",
    a: "Oui. Tu commences gratuitement, sans carte : recherches et testing inclus. Tu passes payant quand tu veux plus de volume et les fonctions automatiques.",
  },
  {
    q: "Comment tester un produit sans avoir de stock ?",
    a: "Tu lances un test et tu mesures l'intérêt réel (taux de closing) avant même de commander ton stock. Un test devient valable à partir de 10 commandes reçues.",
  },
  {
    q: "Mes données sont privées ?",
    a: "Oui. Chaque compte ne voit que ses propres données. La vitrine communautaire est 100 % anonymisée : jamais ton nom, jamais le nom exact de tes produits.",
  },
  {
    q: "Je peux annuler quand je veux ?",
    a: "Oui, aucun engagement. Tu changes ou annules ton offre quand tu veux.",
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="scroll-mt-20 px-4 py-12 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <RevealOnScroll>
          <h2 className="text-foreground text-center text-3xl font-extrabold tracking-tight sm:text-4xl">
            Questions fréquentes
          </h2>
        </RevealOnScroll>

        <RevealOnScroll delay={100}>
          <div className="mt-8 space-y-3">
            {FAQ.map((item, i) => (
              <details
                key={i}
                className="group border-border bg-surface shadow-card rounded-2xl border px-5 py-1 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left">
                  <span className="text-foreground text-sm font-semibold sm:text-base">
                    {item.q}
                  </span>
                  <span className="text-muted-foreground shrink-0 transition-transform duration-200 group-open:rotate-180">
                    <Icon name="chevronDown" size={18} />
                  </span>
                </summary>
                <p className="text-muted-foreground pb-4 text-sm leading-relaxed">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}
