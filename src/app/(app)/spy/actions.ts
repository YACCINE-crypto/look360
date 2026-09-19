"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MARCHES, type ProduitInsert } from "@/lib/produits";

function str(formData: FormData, key: string): string | null {
  const raw = String(formData.get(key) ?? "").trim();
  return raw === "" ? null : raw;
}

/**
 * Pont Spy → Pipeline (§6) : crée une ligne `produits` pré-remplie depuis une
 * pub espionnée, puis ouvre la fiche produit pour compléter le sourcing.
 * RLS : soumis_par = utilisateur courant.
 */
export async function ajouterAuxProduits(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub as string | undefined;
  if (!userId) redirect("/login");

  const pays = (str(formData, "marche") ?? "").toUpperCase();
  const marche = MARCHES.some((m) => m.code === pays) ? pays : null;

  const payload: ProduitInsert = {
    nom: str(formData, "nom") ?? "Produit espionné",
    soumis_par: userId,
    image_url: str(formData, "image_url"),
    lien_concurrent: str(formData, "landing_url"),
    lien_ad_library: str(formData, "ad_library_url"),
    angle_marketing: str(formData, "ad_text"),
    marche,
    statut: "idee",
  };

  const { data, error } = await supabase
    .from("produits")
    .insert(payload)
    .select("id")
    .single();

  if (error || !data) {
    redirect("/spy?error=add");
  }

  revalidatePath("/recherche");
  redirect(`/produits/${data.id}`);
}
