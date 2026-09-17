"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { StatutRevue } from "@/lib/produits";

/** Met à jour le statut de revue (RLS + trigger réservent ça à l'admin). */
async function setRevue(id: string, statut_revue: StatutRevue): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("produits")
    .update({ statut_revue })
    .eq("id", id);
  if (!error) {
    revalidatePath("/validation");
    revalidatePath("/recherche");
  }
}

export async function approuver(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (id) await setRevue(id, "approuve");
}

export async function rejeter(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (id) await setRevue(id, "rejete");
}

export async function mettreEnAnalyse(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (id) await setRevue(id, "en_analyse");
}
