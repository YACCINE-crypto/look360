import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLandingData } from "@/lib/landingData";
import { NuitNav } from "@/components/landing/nuit/NuitNav";
import { NuitMotion } from "@/components/landing/nuit/NuitMotion";
import {
  Chiffres,
  Comparatif,
  Etapes,
  Faq,
  Fonctions,
  Footer,
  Hero,
  Marquee,
  Tarifs,
  Testing,
} from "@/components/landing/nuit/Sections";
import "./nuit.css";

export const dynamic = "force-dynamic";

// Barre du navigateur mobile assortie au fond navy (--night) de la landing.
export const viewport: Viewport = { themeColor: "#08111f" };

export const metadata: Metadata = {
  title: "Look360 · Trouve, teste et valide tes produits gagnants",
  description:
    "Look360 repère les pubs qui marchent en Afrique et en Europe, te montre le vendeur derrière et calcule si le produit est rentable en COD avant que tu achètes ton stock.",
};

/**
 * Landing publique « Nuit ». Référence visuelle :
 * design-system/references/look360-maquette-reference.html.
 * Données réelles (produits, chiffres) recalculées au plus une fois par 24 h.
 */
export default async function LandingPage() {
  // Un visiteur déjà connecté va directement dans l'app.
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (auth?.claims?.sub) redirect("/recherche");

  const data = await getLandingData();

  return (
    <div className="nuit">
      <canvas className="rain" aria-hidden />
      <NuitNav />
      <main className="layer">
        <Hero data={data} />
        <Marquee products={data.products} />
        <Etapes products={data.products} />
        <Comparatif />
        <Testing />
        <Chiffres stats={data.stats} />
        <Fonctions products={data.products} />
        <Tarifs />
        <Faq />
      </main>
      <Footer />
      <NuitMotion />
    </div>
  );
}
