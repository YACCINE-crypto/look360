import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSubscription } from "@/lib/credits";

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

  if (!inline) {
    // Téléchargement réservé aux offres payantes (Starter et plus).
    const sub = await getSubscription(userId);
    if ((sub?.plan ?? "free") === "free") {
      return NextResponse.redirect(new URL("/offres?locked=video", request.url));
    }
  }

  if (!u) return NextResponse.json({ error: "url requise" }, { status: 400 });

  let host = "";
  try {
    host = new URL(u).hostname;
  } catch {
    return NextResponse.json({ error: "url invalide" }, { status: 400 });
  }
  // Anti-SSRF : CDN Meta + CDN média configuré (archives).
  const cdnHost = process.env.BUNNY_CDN_HOST || "";
  const okHost =
    host.endsWith("fbcdn.net") ||
    host.endsWith("facebook.com") ||
    (cdnHost && host === cdnHost) ||
    host.endsWith("b-cdn.net");
  if (!okHost) {
    return NextResponse.json({ error: "hôte non autorisé" }, { status: 400 });
  }

  // Passe l'en-tête Range pour permettre la lecture progressive / le seek.
  const range = request.headers.get("range");
  let upstream: Response;
  try {
    upstream = await fetch(u, range ? { headers: { Range: range } } : undefined);
  } catch {
    return NextResponse.json({ error: "téléchargement impossible" }, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: `amont ${upstream.status}` }, { status: 502 });
  }

  const ct = upstream.headers.get("content-type") || "video/mp4";
  const headers: Record<string, string> = {
    "Content-Type": ct,
    "Cache-Control": "no-store",
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
    headers["Content-Disposition"] = `attachment; filename="look360-pub-${Date.now()}.mp4"`;
  }
  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
