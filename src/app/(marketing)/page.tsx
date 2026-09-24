import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RevealOnScroll } from "@/components/landing/RevealOnScroll";

export const dynamic = "force-dynamic";

/**
 * Landing publique Look360. Les sections sont construites étape par étape
 * (Phase 4) — cette version pose les FONDATIONS (STEP 0) : ancres, reveal au
 * scroll, nav + footer via le layout marketing. Les blocs marqués
 * « [STEP n] » seront remplis aux étapes suivantes.
 */
export default async function LandingPage() {
  // Un visiteur déjà connecté n'a rien à faire sur la vitrine marketing :
  // on l'envoie directement dans l'app.
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims?.sub) redirect("/recherche");

  return (
    <div>
      {/* HERO — [STEP 1] */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-20 text-center sm:px-6">
        <RevealOnScroll>
          <p className="text-primary text-xs font-bold tracking-[0.15em] uppercase">
            Spy Facebook · Testing COD · Winners
          </p>
          <h1 className="text-foreground mx-auto mt-4 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
            Trouver un produit gagnant ne suffit pas.
          </h1>
          <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-base sm:text-lg">
            Fondations de la nouvelle landing en place. Les sections (hero
            complet, comparatif, testing, offres, FAQ…) arrivent aux étapes
            suivantes.
          </p>
        </RevealOnScroll>
      </section>

      {/* Sections ancrées — remplies aux STEP suivants */}
      {[
        { id: "fonctions", label: "Fonctions", step: "STEP 3" },
        { id: "comparatif", label: "Comparatif", step: "STEP 3" },
        { id: "tarifs", label: "Tarifs", step: "STEP 6" },
        { id: "faq", label: "FAQ", step: "STEP 7" },
      ].map((s, i) => (
        <section
          key={s.id}
          id={s.id}
          className={`scroll-mt-20 px-4 py-16 sm:px-6 ${
            i % 2 === 0 ? "bg-surface" : "bg-background"
          }`}
        >
          <RevealOnScroll>
            <div className="border-border text-muted-foreground mx-auto max-w-6xl rounded-2xl border border-dashed p-10 text-center">
              <p className="text-foreground text-lg font-bold">{s.label}</p>
              <p className="mt-1 text-sm">Section à construire — {s.step}</p>
            </div>
          </RevealOnScroll>
        </section>
      ))}
    </div>
  );
}
