"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Crée un compte agent (réservé à l'admin). Utilise la clé service_role
 * pour créer l'utilisateur confirmé ; le trigger handle_new_user crée le
 * profil avec le rôle 'agent'.
 * Retourne un message d'erreur, ou null en cas de succès.
 */
export async function creerAgent(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub as string | undefined;
  if (!userId) return "Non connecté.";

  const { data: prof } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (prof?.role !== "admin") return "Réservé à l'administrateur.";

  const nom = String(formData.get("nom") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email) return "Email requis.";
  if (password.length < 6) return "Mot de passe : 6 caractères minimum.";

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nom: nom || email.split("@")[0] },
  });
  if (error) return error.message;

  revalidatePath("/equipe");
  return null;
}
