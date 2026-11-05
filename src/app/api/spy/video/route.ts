import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { accountSuspended } from "@/lib/accountGuard";
import { consumeDownload, QuotaError } from "@/lib/usage";
import { fetchAllowedMedia, isAllowedMediaUrl } from "@/lib/mediaHosts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Télécharge à la volée la vidéo (ou l'image, `kind=image`) d'une pub et la
 * renvoie en pièce jointe. Passe par le serveur pour éviter CORS/expiration.
 * Ouvert à TOUTES les offres ; seul garde-fou : 100 téléchargements / jour /
 * compte (anti-scripts, protection bande passante), appliqué en base.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (await accountSuspended(userId)) {
    return NextResponse.json({ error: "compte suspendu" }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const u = params.get("url");
  // Mode lecture (inline) : autorisé à tous, proxy même origine avec Range pour
  // une lecture fiable in-app. Mode téléchargement (défaut) : offres payantes.
  const inline = params.get("inline") === "1";
  const image = params.get("kind") === "image";

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
    // Redirections suivies seulement vers des hôtes autorisés (revérifiés).
    upstream = await fetchAllowedMedia(u, range ? { headers: { Range: range } } : {}, { archive: true });
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
  // Image : uniquement des formats raster (jamais de SVG, qui peut contenir du script).
  const ct = image
    ? /^image\/(jpeg|png|webp|gif)$/.test(upCt) ? upCt : "image/jpeg"
    : /^video\/[a-z0-9.+-]+$/.test(upCt) ? upCt : "video/mp4";
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
    // Téléchargement : garde-fou anti-abus de 100 / jour (toutes offres). Compté
    // seulement une fois l'amont confirmé OK, pour ne pas débiter un échec.
    try {
      await consumeDownload(userId);
    } catch (e) {
      if (e instanceof QuotaError) {
        return NextResponse.json(
          { error: "Limite de 100 téléchargements par jour atteinte. Réessaie demain." },
          { status: 429 },
        );
      }
      throw e;
    }
    const ext = image ? (ct === "image/png" ? "png" : ct === "image/webp" ? "webp" : ct === "image/gif" ? "gif" : "jpg") : "mp4";
    headers["Content-Disposition"] = `attachment; filename="look360-pub-${Date.now()}.${ext}"`;
  }
  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
