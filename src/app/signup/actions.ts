"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrigin } from "@/lib/url";
import { allow, clientIp, norm, turnstileOk } from "@/lib/rateLimit";

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

  // Anti création en masse : 5 inscriptions / heure par IP (cybercafés),
  // 3 / heure par email, + Turnstile quand il est configuré.
  const ip = await clientIp();
  if (!(await turnstileOk(formData.get("cf-turnstile-response"), ip))) {
    return "Vérification anti-robot échouée. Recharge la page et réessaie.";
  }
  const ok = await allow([
    { key: `signup:ip:${ip}`, windowSec: 3600, max: 5 },
    { key: `signup:email:${norm(email)}`, windowSec: 3600, max: 3 },
  ]);
  if (!ok) return "Trop de tentatives. Patiente quelques minutes avant de réessayer.";

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
  redirect("/login?sent=1");
}
