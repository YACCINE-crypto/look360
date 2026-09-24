"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Garde serveur : revérifie que l'appelant est superadmin AVANT toute action.
 * (Les fonctions SQL revérifient aussi is_superadmin — double barrière.)
 */
async function guard(): Promise<SupabaseClient> {
  const supabase = await createClient();
  const { data: c } = await supabase.auth.getClaims();
  const uid = c?.claims?.sub as string | undefined;
  if (!uid) throw new Error("unauthenticated");
  const { data: p } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", uid)
    .maybeSingle();
  if (p?.role !== "superadmin") throw new Error("forbidden");
  return supabase;
}

export async function grantCredits(formData: FormData): Promise<void> {
  const supabase = await guard();
  const user = String(formData.get("user") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const reason = String(formData.get("reason") ?? "").trim() || "Crédits offerts (admin)";
  if (!user || !(amount > 0)) return;
  await supabase.rpc("admin_grant_credits", {
    p_user: user,
    p_amount: Math.round(amount),
    p_reason: reason,
  });
  revalidatePath(`/admin/clients/${user}`);
}

export async function setPlan(formData: FormData): Promise<void> {
  const supabase = await guard();
  const user = String(formData.get("user") ?? "");
  const plan = String(formData.get("plan") ?? "");
  if (!user || !["free", "starter", "pro", "business"].includes(plan)) return;
  await supabase.rpc("admin_set_plan", { p_user: user, p_plan: plan });
  revalidatePath(`/admin/clients/${user}`);
}

export async function setSuspended(formData: FormData): Promise<void> {
  const supabase = await guard();
  const user = String(formData.get("user") ?? "");
  const suspend = String(formData.get("suspend") ?? "") === "1";
  if (!user) return;
  await supabase.rpc("admin_set_suspended", { p_user: user, p_bool: suspend });
  revalidatePath(`/admin/clients/${user}`);
}
