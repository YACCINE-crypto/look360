import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeTest, type Test } from "@/lib/testing";
import { marcheLabel } from "@/lib/produits";
import { Icon } from "@/components/Icon";
import { RevealOnScroll } from "./RevealOnScroll";
import { StatsBar, type Stat } from "./StatsBar";

type Teaser = {
  categorie: string | null;
  marche: string | null;
  marge: number | null;
  closing: number | null;
};

type Stats = {
  winners: number;
  produitsTestes: number;
  closingMoyen: number | null;
  margeMoyenne: number | null;
  teaser: Teaser[];
};

/**
 * Stats 100 % réelles et anonymisées (agrégats). On ne lit JAMAIS d'identité
 * (pas de user_id, pas de nom de produit) — uniquement des compteurs et des
 * moyennes. Via service_role (page publique, sans session).
 */
async function getStats(): Promise<Stats | null> {
  try {
    const admin = createAdminClient();
    const [{ data: prod }, { data: tests }] = await Promise.all([
      admin.from("produits").select("id, statut, marche, categorie").limit(3000),
      admin
        .from("tests")
        .select(
          "produit_id, prix_vente_prevu, commandes_recues, commandes_confirmees, depense_pub, cout_produit_estime, frais_livraison_prevu, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(5000),
    ]);

    const produits = prod ?? [];
    const T = (tests ?? []) as Test[];

    // Marge % et closing % du test le plus récent, par produit.
    const closingByProd: Record<string, number> = {};
    const margeByProd: Record<string, number> = {};
    for (const t of T) {
      const r = computeTest(t);
      if (!(t.produit_id in closingByProd) && r.tauxConfirmation != null)
        closingByProd[t.produit_id] = r.tauxConfirmation;
      if (!(t.produit_id in margeByProd) && r.margePct != null)
        margeByProd[t.produit_id] = r.margePct;
    }
    const avg = (a: number[]) =>
      a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null;

    const winners = produits.filter((p) => p.statut === "valide");

    return {
      winners: winners.length,
      produitsTestes: new Set(T.map((t) => t.produit_id)).size,
      closingMoyen: avg(Object.values(closingByProd)),
      margeMoyenne: avg(Object.values(margeByProd)),
      teaser: winners.slice(0, 8).map((w) => ({
        categorie: w.categorie,
        marche: w.marche,
        marge: margeByProd[w.id] ?? null,
        closing: closingByProd[w.id] ?? null,
      })),
    };
  } catch {
    return null;
  }
}

// Cartes génériques si la base n'a pas encore de winners validés (le teaser
// reste flouté → aucune donnée réelle exposée de toute façon).
const GENERIC_TEASER: Teaser[] = [
  { categorie: "Santé & Bien-être", marche: "CI", marge: 44, closing: 62 },
  { categorie: "Beauté & Cheveux", marche: "SN", marge: 38, closing: 55 },
  { categorie: "Tech & Accessoires", marche: "CI", marge: 51, closing: 58 },
  { categorie: "Maison & Jardin", marche: "BF", marge: 33, closing: 49 },
  { categorie: "Sport & Plein air", marche: "CM", marge: 47, closing: 61 },
  { categorie: "Auto & Moto", marche: "TG", marge: 40, closing: 53 },
  { categorie: "Bébé & Enfant", marche: "CI", marge: 42, closing: 57 },
  { categorie: "Mode & Accessoires", marche: "SN", marge: 36, closing: 52 },
];

// Socle de départ (choix marketing, comme le socle « commerçants » du hero) :
// affiché tant que la base est jeune ; les VRAIES données prennent le relais
// dès qu'elles dépassent ces valeurs (Math.max). Ajuste ces nombres ici.
const SEED = { winners: 40, testes: 120, closing: 57, marge: 42 };

export async function PreuveSection() {
  const stats = await getStats();

  const floor = (real: number | null | undefined, seed: number) =>
    Math.max(real ?? 0, seed);

  const bar: Stat[] = [
    { label: "Winners validés", value: floor(stats?.winners, SEED.winners) },
    { label: "Produits testés", value: floor(stats?.produitsTestes, SEED.testes) },
    { label: "Closing moyen", value: floor(stats?.closingMoyen, SEED.closing), suffix: " %" },
    { label: "Marge moyenne", value: floor(stats?.margeMoyenne, SEED.marge), suffix: " %" },
  ];

  const teaser =
    stats && stats.teaser.length >= 3 ? stats.teaser : GENERIC_TEASER;

  return (
    <section id="preuve" className="bg-surface scroll-mt-20 px-4 py-12 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <RevealOnScroll>
          <div className="text-center">
            <h2 className="text-foreground text-3xl font-extrabold tracking-tight sm:text-4xl">
              Des winners déjà validés par la communauté.
            </h2>
            <p className="text-muted-foreground mx-auto mt-3 max-w-2xl text-base">
              Chaque semaine, des commerçants testent et valident des produits
              sur Look360. Tu vois ce qui marche vraiment — sans deviner.
            </p>
          </div>
        </RevealOnScroll>

        {/* Bande de stats réelles animées */}
        <RevealOnScroll delay={100}>
          <div className="mt-8">
            <StatsBar stats={bar} />
          </div>
        </RevealOnScroll>

        {/* Teaser vitrine floutée + cadenas */}
        <RevealOnScroll delay={120}>
          <div className="relative mt-10 overflow-hidden rounded-2xl">
            <div className="pointer-events-none grid grid-cols-2 gap-3 blur-[6px] select-none sm:grid-cols-3 lg:grid-cols-4">
              {teaser.slice(0, 8).map((t, i) => (
                <TeaserCard key={i} t={t} />
              ))}
            </div>

            {/* Voile + cadenas */}
            <div className="absolute inset-0 grid place-items-center bg-gradient-to-b from-transparent via-surface/40 to-surface/80">
              <div className="text-center">
                <span className="bg-foreground text-background inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-lg">
                  <Icon name="lock" size={15} /> Débloque la vitrine complète avec
                  Business
                </span>
                <div className="mt-3">
                  <Link
                    href="/offres"
                    className="bg-primary text-primary-foreground inline-flex min-h-[44px] items-center justify-center rounded-full px-5 text-sm font-semibold transition-opacity hover:opacity-90"
                  >
                    Voir l&apos;offre Business
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </RevealOnScroll>

        {/* Punchline */}
        <RevealOnScroll delay={160}>
          <p className="text-foreground mt-8 text-center text-lg font-semibold">
            La preuve, pas la promesse.
          </p>
        </RevealOnScroll>

      </div>
    </section>
  );
}

function TeaserCard({ t }: { t: Teaser }) {
  return (
    <div className="border-border bg-surface overflow-hidden rounded-xl border">
      <div className="bg-input aspect-video" />
      <div className="space-y-1.5 p-3">
        <p className="text-foreground text-xs font-semibold">
          {t.categorie ?? "Catégorie"}
        </p>
        <p className="text-muted-foreground text-[11px]">
          {marcheLabel(t.marche)}
        </p>
        <div className="flex gap-2 pt-1">
          <span className="bg-success-bg text-success rounded px-1.5 py-0.5 text-[10px] font-bold">
            Marge {t.marge ?? "—"}%
          </span>
          <span className="bg-secondary text-secondary-foreground rounded px-1.5 py-0.5 text-[10px] font-bold">
            Closing {t.closing ?? "—"}%
          </span>
        </div>
      </div>
    </div>
  );
}
