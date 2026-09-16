import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// En Next.js 16, l'ancien "middleware" a été renommé "proxy" (même rôle).
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match toutes les routes SAUF :
     * - _next/static (fichiers statiques)
     * - _next/image (optimisation d'images)
     * - favicon.ico, sw.js, manifest et fichiers images
     */
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
