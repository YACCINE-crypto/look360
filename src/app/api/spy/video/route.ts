import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { consumeDownload, QuotaError } from "@/lib/usage";
import { isAllowedMediaUrl } from "@/lib/mediaHosts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Télécharge à la volée la vidéo d'une pub depuis media_url (CDN Meta) et la
 * renvoie en pièce jointe. Passe par le serveur pour éviter CORS/expiration.
 * Aucun stockage permanent.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const u = params.get("url");
  // Mode lecture (inline) : autorisé à tous, proxy même origine avec Range pour
  // une lecture fiable in-app. Mode téléchargement (défaut) : offres payantes.
  const inline = params.get("inline") === "1";

  if (!u) return NextResponse.json({ error: "url requise" }, { status: 400 });

  // Anti-SSRF / anti-XSS : https uniquement, CDN Meta (frontière de
  // sous-domaine) ou EXACTEMENT notre CDN d'archive configuré.
  if (!isAllowedMediaUrl(u, { archive: true })) {
    return NextResponse.json({ error: "hôte non autorisé" }, { status: 400 });
  }

  // Passe l'en-tête Range pour permettre la lecture progressive / le seek.
  const range = request.headers.get("range");
  let upstream: Response;
  try {
    // Pas de redirection suivie : elle pourrait sortir de la liste d'hôtes.
    upstream = await fetch(u, { redirect: "error", ...(range ? { headers: { Range: range } } : {}) });
  } catch {
    return NextResponse.json({ error: "téléchargement impossible" }, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: `amont ${upstream.status}` }, { status: 502 });
  }

  // Ne JAMAIS refléter un Content-Type amont arbitraire (text/html, image/svg+xml…
  // exécuteraient du script sur notre origine) : seul video/* passe, sinon
  // video/mp4. nosniff + CSP sandbox en défense en profondeur.
  const upCt = (upstream.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const ct = /^video\/[a-z0-9.+-]+$/.test(upCt) ? upCt : "video/mp4";
  const headers: Record<string, string> = {
    "Content-Type": ct,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "sandbox; default-src 'none'",
  };
  // Recopie les en-têtes utiles à la lecture progressive.
  for (const h of ["content-length", "content-range", "accept-ranges"]) {
    const v = upstream.headers.get(h);
    if (v) headers[h] = v;
  }
  if (inline) {
    headers["Content-Disposition"] = "inline";
    headers["Accept-Ranges"] = headers["accept-ranges"] || "bytes";
  } else {
    // Téléchargement = consomme 1 du quota mensuel (free = 0 → bloqué). Compté
    // seulement une fois l'amont confirmé OK, pour ne pas débiter un échec.
    try {
      await consumeDownload(userId);
    } catch (e) {
      if (e instanceof QuotaError) {
        return NextResponse.redirect(new URL("/offres?locked=video", request.url));
      }
      throw e;
    }
    headers["Content-Disposition"] = `attachment; filename="look360-pub-${Date.now()}.mp4"`;
  }
  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
