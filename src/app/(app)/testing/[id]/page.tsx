import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TestClient } from "./TestClient";

const s = (v: number | null | undefined) => (v == null ? "" : String(v));

export default async function FicheTestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: produit } = await supabase
    .from("produits")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!produit) notFound();

  // Dernier test (pré-remplissage des chiffres).
  const { data: dernier } = await supabase
    .from("tests")
    .select("*")
    .eq("produit_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <TestClient
      produit={{
        id: produit.id,
        nom: produit.nom,
        marche: produit.marche,
        categorie: produit.categorie,
        cout_livre_estime: produit.cout_livre_estime,
        angle_marketing: produit.angle_marketing,
        lien_source: produit.lien_source,
        lien_concurrent: produit.lien_concurrent,
        lien_ad_library: produit.lien_ad_library,
        date_lancement_testing: produit.date_lancement_testing,
      }}
      initial={{
        impressions: "",
        clics: "",
        recues: s(dernier?.commandes_recues),
        confirmees: s(dernier?.commandes_confirmees),
        prix: s(dernier?.prix_vente_prevu),
        coutProduit: s(
          dernier?.cout_produit_estime ?? produit.cout_livre_estime,
        ),
        pub: s(dernier?.depense_pub),
        frais: s(dernier?.frais_livraison_prevu ?? 1800),
      }}
    />
  );
}
