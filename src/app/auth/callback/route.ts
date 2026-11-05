import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
  const accepted = url.searchParams.get("terms") === "1";
  const meta = (data.user.user_metadata ?? {}) as { terms_accepted_at?: string };

  // Nouveau compte Google SANS la case des conditions cochée (bouton Google de
  // l'onglet connexion) : le compte n'est pas créé. On l'annule aussitôt et on
  // renvoie vers l'inscription. Un compte existant n'est jamais concerné.
  if (isNew && !accepted && !meta.terms_accepted_at) {
    await supabase.auth.signOut();
    await createAdminClient().auth.admin.deleteUser(data.user.id);
    return NextResponse.redirect(new URL("/login?tab=signup&error=terms", url.origin));
  }
  // Trace de l'acceptation (date) sur le compte.
  if (accepted && !meta.terms_accepted_at) {
    await supabase.auth.updateUser({ data: { terms_accepted_at: new Date().toISOString() } });
  }
  const dest = isNew ? "/bienvenue" : safeNext(url.searchParams.get("next"), "/");
  return NextResponse.redirect(new URL(dest, url.origin));
}
