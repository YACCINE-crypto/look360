"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrigin } from "@/lib/url";
import { allow, clientIp, norm } from "@/lib/rateLimit";

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

  // Anti envoi en boucle : 3 / heure par email, 10 / heure par IP. Si la limite
  // est atteinte, on affiche quand même « envoyé » (aucune information révélée).
  const ip = await clientIp();
  const ok = await allow([
    { key: `forgot:email:${norm(email)}`, windowSec: 3600, max: 3 },
    { key: `forgot:ip:${ip}`, windowSec: 3600, max: 10 },
  ]);
  if (!ok) redirect("/forgot-password?sent=1");

  const supabase = await createClient();
  const origin = await getOrigin();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/reset-password`,
  });

  redirect("/forgot-password?sent=1");
}
