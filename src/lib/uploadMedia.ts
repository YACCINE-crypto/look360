"use client";

// ============================================================================
// Envoi d'un média produit vers /api/upload (CDN). Les photos sont d'abord
// converties en JPEG et réduites (1600 px max) dans le navigateur : les photos
// de téléphone (HEIC, 5-10 Mo) passent toujours, s'affichent partout et
// s'envoient vite sur une connexion mobile. Les vidéos partent telles quelles.
// ============================================================================

const MAX_SIDE = 1600;

async function decode(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file);
    } catch {
      /* repli <img> (ex. HEIC sur Safari) */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Photo → JPEG ≤ 1600 px. Autre type (vidéo, GIF) ou échec → fichier d'origine. */
export async function prepareImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const src = await decode(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(src.width, src.height));
    const w = Math.max(1, Math.round(src.width * scale));
    const h = Math.max(1, Math.round(src.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(src, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    if (!blob) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/** Envoie le fichier ; renvoie l'URL CDN, ou lève une erreur au message lisible. */
export async function uploadMedia(file: File): Promise<string> {
  const ready = await prepareImage(file);
  const fd = new FormData();
  fd.append("file", ready);
  let r: Response;
  try {
    r = await fetch("/api/upload", { method: "POST", body: fd });
  } catch {
    throw new Error("Connexion impossible. Vérifie ton réseau et réessaie.");
  }
  // Vercel refuse un corps > 4,5 Mo avant même d'appeler la route.
  if (r.status === 413) {
    throw new Error(
      ready.type.startsWith("video/")
        ? "Vidéo trop lourde (4 Mo max). Envoie une version plus courte ou compressée."
        : "Image trop lourde. Réessaie avec une autre photo.",
    );
  }
  const data = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!r.ok || !data.url) {
    throw new Error(data.error ? `Échec de l'envoi : ${data.error}.` : "Échec de l'envoi. Réessaie.");
  }
  return data.url;
}
