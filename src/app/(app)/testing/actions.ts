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
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect("/login");

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
  revalidatePath("/produits");
  redirect("/testing");
}

/** Abandonner le produit (statut -> abandonne). */
export async function abandonnerProduit(formData: FormData): Promise<void> {
  const id = String(formData.get("produit_id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("produits").update({ statut: "abandonne" }).eq("id", id);
  revalidatePath("/testing");
  revalidatePath("/produits");
  redirect("/testing");
}

/**
 * Enregistrement AUTOMATIQUE des chiffres du test (sans bouton) : met à jour
 * le dernier test s'il date de moins de 12 h, sinon en crée un nouveau
 * (l'historique reste lisible sans une ligne par frappe).
 */
export async function autosaveTest(input: {
  produit_id: string;
  marche: string | null;
  prix_vente_prevu: number | null;
  commandes_recues: number | null;
  commandes_confirmees: number | null;
  depense_pub: number | null;
  cout_produit_estime: number | null;
  frais_livraison_prevu: number | null;
}): Promise<{ ok: boolean; savedAt?: string }> {
  if (!input.produit_id) return { ok: false };
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) return { ok: false };

  const clean = (v: number | null) => (v == null || !Number.isFinite(v) ? null : v);
  const values = {
    prix_vente_prevu: clean(input.prix_vente_prevu),
    commandes_recues: input.commandes_recues == null ? null : Math.round(input.commandes_recues),
    commandes_confirmees: input.commandes_confirmees == null ? null : Math.round(input.commandes_confirmees),
    depense_pub: clean(input.depense_pub),
    cout_produit_estime: clean(input.cout_produit_estime),
    frais_livraison_prevu: clean(input.frais_livraison_prevu),
  };
  const verdict = verdictTierFromInput(values);

  const { data: last } = await supabase
    .from("tests")
    .select("id, created_at")
    .eq("produit_id", input.produit_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const recent = last && Date.now() - Date.parse(last.created_at) < 12 * 3600_000;
  const { error } = recent
    ? await supabase.from("tests").update({ ...values, verdict }).eq("id", last.id)
    : await supabase.from("tests").insert({ produit_id: input.produit_id, marche: input.marche, ...values, verdict });
  if (error) return { ok: false };
  revalidatePath("/testing");
  return { ok: true, savedAt: new Date().toISOString() };
}
