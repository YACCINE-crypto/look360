"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrigin } from "@/lib/url";

/**
 * Inscription email + mot de passe. Le trigger DB crée un profil `owner`
 * (compte isolé). Un email de confirmation est envoyé ; la session n'est
 * active qu'après clic sur le lien (si la confirmation email est activée).
 */
export async function signup(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const nom = String(formData.get("nom") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email) return "Email requis.";
  if (password.length < 8) return "Mot de passe : 8 caractères minimum.";

  const supabase = await createClient();
  const origin = await getOrigin();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { nom: nom || email.split("@")[0] },
      emailRedirectTo: `${origin}/auth/confirm?next=/bienvenue`,
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already"))
      return "Un compte existe déjà avec cet email. Connecte-toi.";
    return error.message;
  }

  // Confirmation email désactivée → session déjà active : on entre directement
  // sur l'onboarding. Sinon → écran "vérifie ta boîte mail".
  if (data.session) redirect("/bienvenue");
  redirect("/signup?sent=1");
}
