import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safeNext";

export const dynamic = "force-dynamic";

/**
 * Retour de la connexion Google (OAuth, flux PKCE) : échange le `code` contre
 * une session (cookies posés côté serveur), puis redirige.
 *  - nouveau compte → /bienvenue (même onboarding qu'un compte e-mail : profil
 *    et abonnement Gratuit créés par les triggers sur auth.users)
 *  - compte existant → `next` (chemin interne) ou /
 * Erreurs (refus Google, code expiré…) → /login?error=oauth : jamais de jeton
 * ni de message brut du fournisseur dans l'URL.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const fail = () => NextResponse.redirect(new URL("/login?error=oauth", url.origin));

  // Refus ou erreur côté Google / Supabase (?error=access_denied&error_description=…).
  if (url.searchParams.get("error") || !code) return fail();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return fail();

  // Compte créé à l'instant (premier passage) → onboarding.
  const created = Date.parse(data.user.created_at ?? "");
  const isNew = Number.isFinite(created) && Date.now() - created < 2 * 60_000;
  const dest = isNew ? "/bienvenue" : safeNext(url.searchParams.get("next"), "/");
  return NextResponse.redirect(new URL(dest, url.origin));
}
