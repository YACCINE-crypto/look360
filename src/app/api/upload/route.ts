import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { storeBuffer, mediaStorageConfigured } from "@/lib/mediaStorage";
import { reserveMedia, releaseMedia, QuotaError } from "@/lib/usage";
import { accountSuspended } from "@/lib/accountGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vercel limite le corps d'une requête à 4,5 Mo : les photos sont réduites
// côté navigateur (lib/uploadMedia) avant l'envoi.
const MAX_BYTES = 4.5 * 1024 * 1024;
// Types acceptés (le SVG est exclu : il peut contenir du script).
const ALLOWED = /^(image\/(jpeg|png|webp|gif|heic|heif)|video\/(mp4|quicktime|webm))$/;

/** Vérifie les premiers octets : le type déclaré par le navigateur est falsifiable. */
function magicOk(b: Buffer, type: string): boolean {
  const hex = b.subarray(0, 12).toString("hex");
  const ascii = b.subarray(0, 12).toString("latin1");
  if (type === "image/jpeg") return hex.startsWith("ffd8ff");
  if (type === "image/png") return hex.startsWith("89504e47");
  if (type === "image/gif") return ascii.startsWith("GIF8");
  if (type === "image/webp") return ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP";
  if (type === "video/webm") return hex.startsWith("1a45dfa3");
  return ascii.slice(4, 8) === "ftyp"; // mp4 / quicktime / heic (iPhone)
}

/**
 * Upload d'un média produit (image ou vidéo) → stockage CDN (b-cdn.net).
 * Supabase ne conserve QUE l'URL renvoyée ici ; jamais le fichier lui-même.
 * Chaque fichier consomme 1 objet du quota de stockage média de l'offre.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub as string | undefined;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (await accountSuspended(userId)) return NextResponse.json({ error: "compte suspendu" }, { status: 403 });

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
    return NextResponse.json({ error: "fichier trop volumineux (max 4 Mo)" }, { status: 413 });
  }

  try {
    await reserveMedia(userId, 1);
  } catch (e) {
    if (e instanceof QuotaError) {
      return NextResponse.json({ error: "limite de stockage atteinte pour ton offre" }, { status: 402 });
    }
    throw e;
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    if (!magicOk(buf, file.type)) {
      await releaseMedia(userId, 1);
      return NextResponse.json({ error: "fichier invalide (contenu ne correspondant pas au type)" }, { status: 415 });
    }
    const { cdnUrl } = await storeBuffer(buf, file.type, `produits/${userId}`);
    return NextResponse.json({ url: cdnUrl });
  } catch (e) {
    await releaseMedia(userId, 1);
    const msg = e instanceof Error ? e.message : "échec upload";
    // 401/403 du stockage = clé ou zone refusée (configuration, pas la photo).
    const denied = /bunny_put_40[13]/.test(msg);
    return NextResponse.json(
      { error: denied ? "stockage refusé (clé du stockage à mettre à jour — voir Admin › Cockpit)" : msg },
      { status: 502 },
    );
  }
}
