"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrigin } from "@/lib/url";

/**
 * Envoie un email de réinitialisation. Le lien passe par /auth/confirm (qui
 * pose la session de récupération) puis /reset-password. On ne révèle jamais si
 * l'email existe (anti-énumération) : succès affiché dans tous les cas.
 */
export async function forgotPassword(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return "Email requis.";

  const supabase = await createClient();
  const origin = await getOrigin();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/reset-password`,
  });

  redirect("/forgot-password?sent=1");
}
