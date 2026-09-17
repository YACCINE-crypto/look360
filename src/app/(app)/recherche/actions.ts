"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ProduitInsert, Statut } from "@/lib/produits";
import { STATUTS } from "@/lib/produits";

/** "12,5" | "12.5" | "" -> number | null */
function num(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? "").trim().replace(",", ".");
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** "" -> null, sinon la chaîne nettoyée */
function str(formData: FormData, key: string): string | null {
  const raw = String(formData.get(key) ?? "").trim();
  return raw === "" ? null : raw;
}

/** Création d'un produit (panneau ou page). */
export async function createProduit(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const backTo = String(formData.get("redirect_to") ?? "/recherche");
  const nom = str(formData, "nom");
  if (!nom) {
    redirect(`${backTo}?error=nom`);
  }

  const payload: ProduitInsert = {
    nom,
    soumis_par: user.id,
    categorie: str(formData, "categorie"),
    image_url: str(formData, "image_url"),
    lien_source: str(formData, "lien_source"),
    lien_concurrent: str(formData, "lien_concurrent"),
    lien_ad_library: str(formData, "lien_ad_library"),
    date_debut_pub_concurrent: str(formData, "date_debut_pub_concurrent"),
    angle_marketing: str(formData, "angle_marketing"),
    emotion_tag: str(formData, "emotion_tag"),
    marche: str(formData, "marche"),
    // Le design saisit un "Coût livré" direct : stocké dans prix_sourcing
    // (poids/frais optionnels) => la colonne générée cout_livre_estime le reflète.
    prix_sourcing: num(formData, "prix_sourcing"),
    poids_kg: num(formData, "poids_kg"),
    frais_logistiques_kilo: num(formData, "frais_logistiques_kilo"),
    statut: (str(formData, "statut") as Statut | null) ?? "idee",
    date_a_travailler: str(formData, "date_a_travailler"),
    date_lancement_testing: str(formData, "date_lancement_testing"),
    notes: str(formData, "notes"),
  };

  const { error } = await supabase.from("produits").insert(payload);
  if (error) {
    redirect(`${backTo}?error=save`);
  }

  revalidatePath("/recherche");
  revalidatePath("/pipeline");
  redirect(backTo.split("?")[0]);
}

/** Change le statut d'un produit (ex. "Envoyer en test" -> en_test). */
export async function setStatut(id: string, statut: Statut): Promise<void> {
  if (!STATUTS.includes(statut)) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("produits")
    .update({ statut })
    .eq("id", id);
  if (!error) {
    revalidatePath("/recherche");
    revalidatePath("/testing");
  }
}

/** Bouton "Envoyer en test" (carte produit). */
export async function envoyerEnTest(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (id) await setStatut(id, "en_test");
}

/** Bouton "Production" (Pipeline, colonne Validé). */
export async function passerEnProduction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (id) {
    await setStatut(id, "production");
    revalidatePath("/pipeline");
  }
}

/** Suppression d'un produit. */
export async function deleteProduit(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  const { error } = await supabase.from("produits").delete().eq("id", id);
  if (!error) revalidatePath("/recherche");
}
