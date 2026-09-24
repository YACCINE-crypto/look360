import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Hero } from "@/components/landing/Hero";
import { TrustStrip } from "@/components/landing/TrustStrip";
import { CtaInline } from "@/components/landing/CtaInline";
import { StickyCta } from "@/components/landing/StickyCta";
import { EtapesSection } from "@/components/landing/EtapesSection";
import { FonctionsSection } from "@/components/landing/FonctionsSection";
import { ComparatifSection } from "@/components/landing/ComparatifSection";
import { TestingSection } from "@/components/landing/TestingSection";
import { PreuveSection } from "@/components/landing/PreuveSection";
import { OffresSection } from "@/components/landing/OffresSection";
import { FaqSection } from "@/components/landing/FaqSection";
import { CtaFinal } from "@/components/landing/CtaFinal";

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
      {/* HERO — STEP 1 */}
      <Hero />
      <TrustStrip />

      {/* PROBLÈME/SOLUTION + 3 ÉTAPES — STEP 2 */}
      <EtapesSection />

      {/* GRILLE DE FONCTIONS + COMPARATIF — STEP 3 */}
      <FonctionsSection />
      <ComparatifSection />
      <CtaInline />

      {/* SECTION TESTING SIGNATURE — STEP 4 */}
      <TestingSection />

      {/* PREUVE SOCIALE / VITRINE PUBLIQUE — STEP 5 */}
      <PreuveSection />

      {/* BLOC OFFRES — STEP 6 */}
      <OffresSection />

      {/* FAQ + CTA FINAL — STEP 7 */}
      <FaqSection />
      <CtaFinal />

      {/* Barre CTA collante — mobile uniquement */}
      <StickyCta />
    </div>
  );
}
