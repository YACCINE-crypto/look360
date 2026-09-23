import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { storeBuffer, mediaStorageConfigured } from "@/lib/mediaStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024; // 25 Mo
const ALLOWED = /^(image\/|video\/)/;

/**
 * Upload d'un média produit (image ou vidéo) → stockage CDN (b-cdn.net).
 * Supabase ne conserve QUE l'URL renvoyée ici ; jamais le fichier lui-même.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub as string | undefined;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!mediaStorageConfigured()) {
    return NextResponse.json({ error: "stockage_indisponible" }, { status: 503 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "fichier manquant" }, { status: 400 });
  }
  if (!ALLOWED.test(file.type)) {
    return NextResponse.json({ error: "type non supporté" }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "fichier trop volumineux (max 25 Mo)" }, { status: 413 });
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const { cdnUrl } = await storeBuffer(buf, file.type, `produits/${userId}`);
    return NextResponse.json({ url: cdnUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "échec upload";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
