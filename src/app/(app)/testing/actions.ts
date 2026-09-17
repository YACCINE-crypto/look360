"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { verdictTierFromInput, type TestInsert } from "@/lib/testing";

function num(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? "").trim().replace(",", ".");
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function int(formData: FormData, key: string): number | null {
  const n = num(formData, key);
  return n === null ? null : Math.round(n);
}

function str(formData: FormData, key: string): string | null {
  const raw = String(formData.get(key) ?? "").trim();
  return raw === "" ? null : raw;
}

/** Enregistre un test pour un produit (calcule et stocke le verdict). */
export async function saveTest(formData: FormData): Promise<void> {
  const produitId = String(formData.get("produit_id") ?? "");
  if (!produitId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const input = {
    prix_vente_prevu: num(formData, "prix_vente_prevu"),
    commandes_recues: int(formData, "commandes_recues"),
    commandes_confirmees: int(formData, "commandes_confirmees"),
    depense_pub: num(formData, "depense_pub"),
    cout_produit_estime: num(formData, "cout_produit_estime"),
    frais_livraison_prevu: num(formData, "frais_livraison_prevu"),
  };

  const payload: TestInsert = {
    produit_id: produitId,
    marche: str(formData, "marche"),
    ...input,
    verdict: verdictTierFromInput(input),
    notes_test: str(formData, "notes_test"),
  };

  const { error } = await supabase.from("tests").insert(payload);
  if (error) {
    redirect(`/testing/${produitId}?error=save`);
  }

  revalidatePath(`/testing/${produitId}`);
  redirect(`/testing/${produitId}?ok=1`);
}

/** Supprime un test. */
export async function deleteTest(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const produitId = String(formData.get("produit_id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("tests").delete().eq("id", id);
  revalidatePath(`/testing/${produitId}`);
}

/** Valider le produit (statut -> valide). */
export async function validerProduit(formData: FormData): Promise<void> {
  const id = String(formData.get("produit_id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("produits").update({ statut: "valide" }).eq("id", id);
  revalidatePath("/testing");
  revalidatePath("/recherche");
  redirect("/testing");
}

/** Abandonner le produit (statut -> abandonne). */
export async function abandonnerProduit(formData: FormData): Promise<void> {
  const id = String(formData.get("produit_id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("produits").update({ statut: "abandonne" }).eq("id", id);
  revalidatePath("/testing");
  revalidatePath("/recherche");
  redirect("/testing");
}
