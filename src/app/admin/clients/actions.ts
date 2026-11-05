"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/lib/adminGuard";

/**
 * Chaque action revérifie que l'appelant est superadmin AVANT d'agir
 * (lib/adminGuard). Les fonctions SQL revérifient aussi is_superadmin.
 */
const guard = requireSuperadmin;

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
