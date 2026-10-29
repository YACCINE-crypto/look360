import "server-only";
import { isAllowedMediaUrl } from "@/lib/mediaHosts";

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

// Plafond d'un média archivé depuis une URL source (les créas Meta font < 50 Mo).
const MAX_SOURCE_BYTES = 100 * 1024 * 1024;

export type StoredMedia = { cdnUrl: string; key: string };

/** true si le stockage média est configuré (sinon on reste sur les liens Meta). */
export function mediaStorageConfigured(): boolean {
  return Boolean(ZONE && API_KEY && CDN_HOST);
}

// Base CDN nettoyée : accepte "look360-media.b-cdn.net", "http(s)://…" et
// les "/" en trop → toujours "https://look360-media.b-cdn.net".
function cdnBase(): string {
  const h = (CDN_HOST || "").replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  return `https://${h}`;
}

function storageHost(): string {
  // REGION = code court ("", "ny", "la", "sg"…). On tolère aussi le host complet
  // ("storage.bunnycdn.com") ou vide → région principale (Falkenstein).
  const r = (REGION || "").trim().toLowerCase();
  if (!r || r.includes("bunnycdn.com")) return "storage.bunnycdn.com";
  return `${r}.storage.bunnycdn.com`;
}

// Anti-SSRF : on n'archive que les CDN Meta (https, frontière de sous-domaine).
function allowedSource(url: string): boolean {
  return isAllowedMediaUrl(url, { archive: false });
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

  // Pas de redirection suivie (sortirait de la liste d'hôtes) + taille bornée.
  const r = await fetch(sourceUrl, { redirect: "error" });
  if (!r.ok || !r.body) throw new Error(`source_fetch_${r.status}`);
  if (Number(r.headers.get("content-length") || 0) > MAX_SOURCE_BYTES) throw new Error("source_too_large");
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = r.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_SOURCE_BYTES) {
      await reader.cancel();
      throw new Error("source_too_large");
    }
    chunks.push(value);
  }
  const buf = Buffer.concat(chunks);
  const ext = extFromContentType(r.headers.get("content-type"));
  const key = `${keyPrefix}/${crypto.randomUUID()}.${ext}`;

  const put = await fetch(`https://${storageHost()}/${ZONE}/${key}`, {
    method: "PUT",
    headers: { AccessKey: API_KEY as string, "Content-Type": "application/octet-stream" },
    body: buf,
  });
  if (!put.ok) throw new Error(`bunny_put_${put.status}`);

  return { cdnUrl: `${cdnBase()}/${key}`, key };
}

/**
 * Archive un buffer déjà en mémoire (upload utilisateur : image/vidéo produit)
 * sur le stockage CDN. Pas de contrôle de source (le fichier vient du device de
 * l'utilisateur, pas d'une URL distante → aucun risque SSRF). Retourne l'URL CDN.
 */
export async function storeBuffer(
  buf: Buffer,
  contentType: string | null,
  keyPrefix: string,
): Promise<StoredMedia> {
  if (!mediaStorageConfigured()) throw new Error("media_storage_not_configured");
  const ext = extFromContentType(contentType);
  const key = `${keyPrefix}/${crypto.randomUUID()}.${ext}`;

  const put = await fetch(`https://${storageHost()}/${ZONE}/${key}`, {
    method: "PUT",
    headers: { AccessKey: API_KEY as string, "Content-Type": "application/octet-stream" },
    body: new Uint8Array(buf),
  });
  if (!put.ok) throw new Error(`bunny_put_${put.status}`);

  return { cdnUrl: `${cdnBase()}/${key}`, key };
}

/** URL CDN à partir d'une clé stockée. */
export function getUrl(key: string): string {
  return `${cdnBase()}/${key}`;
}

/** Clé de stockage d'une URL de NOTRE CDN (null si l'URL n'en vient pas). */
export function keyFromCdnUrl(url: string | null | undefined): string | null {
  const base = `${cdnBase()}/`;
  if (!CDN_HOST || !url || !url.startsWith(base)) return null;
  const key = url.slice(base.length);
  return key && !key.includes("..") ? key : null;
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
