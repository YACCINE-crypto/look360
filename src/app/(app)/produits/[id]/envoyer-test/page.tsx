import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EnvoyerTestForm } from "./EnvoyerTestForm";

export const dynamic = "force-dynamic";

export default async function EnvoyerTestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: produit } = await supabase
    .from("produits")
    .select(
      "id, nom, type_approvisionnement, prix_fournisseur, prix_achat_local, poids_kg, mode_transit, frais_transit_kilo, cbm, frais_transit_cbm",
    )
    .eq("id", id)
    .maybeSingle();

  if (!produit) notFound();

  return <EnvoyerTestForm produit={produit} />;
}
