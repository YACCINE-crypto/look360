import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Rafraîchit la session Supabase à chaque requête et protège les routes.
 * Appelé depuis proxy.ts (l'ancien middleware, renommé en Next.js 16).
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getClaims() vérifie le JWT localement (via JWKS) quand le projet utilise
  // des clés de signature asymétriques → PAS d'appel réseau par navigation
  // (contrairement à getUser()). Rafraîchit aussi la session si nécessaire.
  // IMPORTANT : ne rien exécuter entre createServerClient et cet appel.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims ?? null;

  const { pathname } = request.nextUrl;

  // Routes publiques (pas besoin d'être connecté).
  const isPublic =
    pathname.startsWith("/login") || pathname.startsWith("/auth");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Utilisateur connecté qui visite /login → rediriger vers l'accueil.
  if (user && pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Toujours retourner supabaseResponse pour conserver les cookies rafraîchis.
  return supabaseResponse;
}
