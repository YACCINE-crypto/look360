"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Définit le nouveau mot de passe. Nécessite la session de récupération posée
 * par /auth/confirm (via le lien email). Sans session valide → erreur.
 */
export async function resetPassword(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return "Mot de passe : 8 caractères minimum.";
  if (password !== confirm) return "Les deux mots de passe ne correspondent pas.";

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return "Lien expiré ou invalide. Redemande un email de réinitialisation.";
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return error.message;

  redirect("/login?reset=1");
}
