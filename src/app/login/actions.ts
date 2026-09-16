"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Connexion email + mot de passe.
 * Retourne un message d'erreur (string) en cas d'échec, sinon redirige.
 */
export async function login(
  _prevState: string | null,
  formData: FormData,
): Promise<string | null> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return "Email et mot de passe requis.";
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return "Identifiants invalides. Vérifie ton email et ton mot de passe.";
  }

  redirect("/");
}

/** Déconnexion. */
export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
