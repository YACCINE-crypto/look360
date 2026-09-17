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
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub as string | undefined;
  if (!userId) redirect("/login");

  const backTo = String(formData.get("redirect_to") ?? "/recherche");
  const nom = str(formData, "nom");
  if (!nom) {
    redirect(`${backTo}?error=nom`);
  }

  const mode = str(formData, "mode_transit") === "maritime" ? "maritime" : "aerien";
  const typeAppro = str(formData, "type_approvisionnement") === "local" ? "local" : "import";

  const payload: ProduitInsert = {
    nom,
    soumis_par: userId,
    categorie: str(formData, "categorie"),
    image_url: str(formData, "image_url"),
    lien_source: str(formData, "lien_source"),
    lien_concurrent: str(formData, "lien_concurrent"),
    lien_ad_library: str(formData, "lien_ad_library"),
    angle_marketing: str(formData, "angle_marketing"),
    marche: str(formData, "marche"),
    // Sourcing / transit — la colonne générée cout_livre_estime est calculée
    // en base selon le type d'appro puis le mode de transit.
    type_approvisionnement: typeAppro,
    prix_achat_local: typeAppro === "local" ? num(formData, "prix_achat_local") : null,
    prix_fournisseur: typeAppro === "local" ? null : num(formData, "prix_fournisseur"),
    poids_kg: typeAppro === "local" ? null : num(formData, "poids_kg"),
    mode_transit: mode,
    frais_transit_kilo: typeAppro === "local" ? null : num(formData, "frais_transit_kilo"),
    cbm: typeAppro === "local" ? null : num(formData, "cbm"),
    frais_transit_cbm: typeAppro === "local" ? null : num(formData, "frais_transit_cbm"),
    // Planning
    date_a_travailler: str(formData, "date_a_travailler"),
    date_lancement_testing: str(formData, "date_lancement_testing"),
    statut: (str(formData, "statut") as Statut | null) ?? "idee",
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

/** Suppression d'un produit (RLS : propriétaire ou admin uniquement). */
export async function deleteProduit(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  const { error } = await supabase.from("produits").delete().eq("id", id);
  if (!error) {
    revalidatePath("/recherche");
    revalidatePath("/pipeline");
    revalidatePath("/aujourdhui");
  }
}

/**
 * Planifie un produit : dates "à travailler" / "lancement testing".
 * Réarme la notif (notif_envoyee -> false) pour que le rappel reparte sur
 * la nouvelle échéance. RLS : propriétaire ou admin uniquement.
 */
export async function updatePlanning(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("produits")
    .update({
      date_a_travailler: str(formData, "date_a_travailler"),
      date_lancement_testing: str(formData, "date_lancement_testing"),
      notif_envoyee: false,
    })
    .eq("id", id);
  if (!error) {
    revalidatePath("/recherche");
    revalidatePath("/aujourdhui");
    revalidatePath(`/testing/${id}`);
  }
}
