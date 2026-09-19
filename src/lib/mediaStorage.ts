import "server-only";

// ============================================================================
// Couche de stockage média abstraite (Spy v2 §2). Implémentation active :
// Bunny.net (Storage + CDN Pull Zone). Interface générique pour pouvoir
// basculer sur Cloudflare R2 ou autre plus tard sans réécrire l'app.
// Config = variables d'env SERVEUR uniquement.
// ============================================================================

const ZONE = process.env.BUNNY_STORAGE_ZONE;
const API_KEY = process.env.BUNNY_STORAGE_API_KEY;
const REGION = process.env.BUNNY_STORAGE_REGION; // "" (Falkenstein) | "ny" | "la" | "sg" | "syd" | "uk" | "se" | "br" | "jh"
const CDN_HOST = process.env.BUNNY_CDN_HOST; // ex. look360.b-cdn.net

export type StoredMedia = { cdnUrl: string; key: string };

/** true si le stockage média est configuré (sinon on reste sur les liens Meta). */
export function mediaStorageConfigured(): boolean {
  return Boolean(ZONE && API_KEY && CDN_HOST);
}

function storageHost(): string {
  return REGION ? `${REGION}.storage.bunnycdn.com` : `storage.bunnycdn.com`;
}

// Anti-SSRF : on n'archive que les CDN Meta.
function allowedSource(url: string): boolean {
  try {
    const h = new URL(url).hostname;
    return h.endsWith("fbcdn.net") || h.endsWith("facebook.com");
  } catch {
    return false;
  }
}

function extFromContentType(ct: string | null): string {
  const c = (ct || "").toLowerCase();
  if (c.includes("video")) return "mp4";
  if (c.includes("png")) return "png";
  if (c.includes("webp")) return "webp";
  if (c.includes("gif")) return "gif";
  return "jpg";
}

/**
 * Télécharge un média depuis son URL source (Meta) et l'archive sur Bunny.
 * Retourne l'URL CDN stable + la clé. Lève si non configuré / source interdite
 * / échec — l'appelant gère le fallback (garder le lien source).
 */
export async function storeFromUrl(sourceUrl: string, keyPrefix: string): Promise<StoredMedia> {
  if (!mediaStorageConfigured()) throw new Error("media_storage_not_configured");
  if (!allowedSource(sourceUrl)) throw new Error("source_not_allowed");

  const r = await fetch(sourceUrl);
  if (!r.ok) throw new Error(`source_fetch_${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const ext = extFromContentType(r.headers.get("content-type"));
  const key = `${keyPrefix}/${crypto.randomUUID()}.${ext}`;

  const put = await fetch(`https://${storageHost()}/${ZONE}/${key}`, {
    method: "PUT",
    headers: { AccessKey: API_KEY as string, "Content-Type": "application/octet-stream" },
    body: buf,
  });
  if (!put.ok) throw new Error(`bunny_put_${put.status}`);

  return { cdnUrl: `https://${CDN_HOST}/${key}`, key };
}

/** URL CDN à partir d'une clé stockée. */
export function getUrl(key: string): string {
  return `https://${CDN_HOST}/${key}`;
}

/** Supprime un objet du stockage (best-effort). */
export async function deleteKey(key: string): Promise<void> {
  if (!mediaStorageConfigured()) return;
  try {
    await fetch(`https://${storageHost()}/${ZONE}/${key}`, {
      method: "DELETE",
      headers: { AccessKey: API_KEY as string },
    });
  } catch {
    /* best-effort */
  }
}
