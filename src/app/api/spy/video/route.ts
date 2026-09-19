import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
  if (!data?.claims?.sub) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const u = new URL(request.url).searchParams.get("url");
  if (!u) return NextResponse.json({ error: "url requise" }, { status: 400 });

  let host = "";
  try {
    host = new URL(u).hostname;
  } catch {
    return NextResponse.json({ error: "url invalide" }, { status: 400 });
  }
  // Anti-SSRF : uniquement les CDN Meta.
  if (!host.endsWith("fbcdn.net") && !host.endsWith("facebook.com")) {
    return NextResponse.json({ error: "hôte non autorisé" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(u);
  } catch {
    return NextResponse.json({ error: "téléchargement impossible" }, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: `amont ${upstream.status}` }, { status: 502 });
  }

  const ct = upstream.headers.get("content-type") || "video/mp4";
  const filename = `look360-pub-${Date.now()}.mp4`;
  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": ct,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
