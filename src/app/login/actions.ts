"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { allow, clientIp, norm } from "@/lib/rateLimit";

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

  // Anti force brute : 5 essais / 15 min par compte, 20 / 15 min par IP.
  const ip = await clientIp();
  const ok = await allow([
    { key: `login:email:${norm(email)}`, windowSec: 900, max: 5 },
    { key: `login:ip:${ip}`, windowSec: 900, max: 20 },
  ]);
  if (!ok) return "Trop de tentatives. Patiente quelques minutes avant de réessayer.";

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
