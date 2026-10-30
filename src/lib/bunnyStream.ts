import "server-only";
import { createHash } from "crypto";
import { fetchAllowedMedia, isAllowedMediaUrl } from "@/lib/mediaHosts";

// ============================================================================
// Transcodage vidéo via le service de streaming (Bunny Stream). Les créatives
// Meta (fbcdn) sont souvent des pistes DASH illisibles en direct (écran noir) :
// on envoie les octets au service, qui les transcode en H.264/HLS, et on lit
// ensuite le flux HLS (hls.js côté client).
//
// Idempotence : 1 vidéo source = 1 vidéo Stream, retrouvée par un titre
// déterministe = hash du CHEMIN de l'URL source. Les liens fbcdn changent de
// signature (query) et d'hôte d'edge à chaque scrape, mais le chemin du fichier
// reste le même → on ne ré-uploade jamais deux fois la même créative.
// Config = variables d'env serveur uniquement.
// ============================================================================

const API = "https://video.bunnycdn.com";
const LIBRARY = process.env.BUNNY_STREAM_LIBRARY_ID;
const KEY = process.env.BUNNY_STREAM_API_KEY;
const CDN_RAW = process.env.BUNNY_STREAM_CDN_HOST; // ex. vz-xxxx.b-cdn.net
const CDN = (CDN_RAW || "").replace(/^https?:\/\//i, "").replace(/\/+$/, "");

// Plafond d'une vidéo source envoyée au transcodage (les créas font < 50 Mo).
const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

export type StreamInfo = {
  guid: string;
  status: number | null;
  ready: boolean;
  failed: boolean;
  hls: string | null;
  thumb: string | null;
};

export function streamConfigured(): boolean {
  return Boolean(LIBRARY && KEY && CDN);
}

export function streamCdnHost(): string {
  return CDN.toLowerCase();
}

/** URL HLS d'une vidéo transcodée. */
export function hlsUrlFor(guid: string): string {
  return `https://${CDN}/${guid}/playlist.m3u8`;
}
/** Miniature générée par le service (disponible une fois l'encodage fini). */
export function thumbUrlFor(guid: string): string {
  return `https://${CDN}/${guid}/thumbnail.jpg`;
}

/** URL déjà servie par NOTRE CDN de streaming (flux HLS transcodé). */
export function isStreamUrl(url: string | null | undefined): boolean {
  if (!url || !CDN) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.toLowerCase() === streamCdnHost();
  } catch {
    return false;
  }
}

/** Clé stable d'une vidéo source (hash du chemin, sans query ni hôte d'edge). */
export function streamKey(sourceUrl: string): string | null {
  try {
    const u = new URL(sourceUrl);
    return createHash("sha1").update(u.pathname).digest("hex");
  } catch {
    return null;
  }
}
function titleFor(key: string): string {
  return `look360:v2:${key}`;
}

function headers(json = true): Record<string, string> {
  return {
    AccessKey: KEY as string,
    accept: "application/json",
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

// Statuts du service : 0 créée · 1 uploadée · 2 traitement · 3 transcodage ·
// 4 terminée · 5 erreur · 6 échec d'upload. Une vidéo « terminée » de largeur 0
// n'a pas de piste image (source Meta expirée, son seul) → échec, jamais lue.
function infoFrom(guid: string, status: number | null, width?: number | null): StreamInfo {
  const noImage = status === 4 && typeof width === "number" && width <= 0;
  const ready = status === 4 && !noImage;
  return {
    guid,
    status,
    ready,
    failed: status === 5 || status === 6 || noImage,
    hls: ready ? hlsUrlFor(guid) : null,
    thumb: ready ? thumbUrlFor(guid) : null,
  };
}

/** Statut d'une vidéo par GUID (null si inconnue). */
export async function streamStatus(guid: string): Promise<StreamInfo | null> {
  if (!/^[0-9a-f-]{36}$/i.test(guid)) return null;
  const r = await fetch(`${API}/library/${LIBRARY}/videos/${guid}`, {
    headers: headers(false),
    cache: "no-store",
  });
  if (!r.ok) return null;
  const j = (await r.json()) as { status?: number; width?: number };
  return infoFrom(guid, typeof j.status === "number" ? j.status : null, j.width);
}

/** Supprime une vidéo du service (upload inutilisable). Best-effort. */
async function deleteStream(guid: string): Promise<void> {
  try {
    await fetch(`${API}/library/${LIBRARY}/videos/${guid}`, { method: "DELETE", headers: headers(false) });
  } catch {
    /* best-effort */
  }
}

/**
 * Le fichier MP4 contient-il une piste IMAGE ? (boîte `hdlr` de type `vide`).
 * Les liens Meta assemblent à la volée une piste vidéo ÉPHÉMÈRE et une piste
 * audio permanente : une fois la vidéo expirée, Meta ne sert plus que le son
 * (écran noir). Inconnu (pas de `hdlr` lisible) → on laisse passer.
 */
export function mp4HasVideoTrack(buf: Buffer): boolean {
  let seen = false;
  let i = buf.indexOf("hdlr");
  while (i !== -1) {
    seen = true;
    if (buf.toString("latin1", i + 12, i + 16) === "vide") return true;
    i = buf.indexOf("hdlr", i + 4);
  }
  return !seen;
}

async function findByTitle(
  title: string,
): Promise<{ guid: string; status: number | null; width: number | null } | null> {
  try {
    const r = await fetch(
      `${API}/library/${LIBRARY}/videos?search=${encodeURIComponent(title)}&itemsPerPage=20&page=1`,
      { headers: headers(false), cache: "no-store" },
    );
    if (!r.ok) return null;
    const j = (await r.json()) as {
      items?: { guid?: string; title?: string; status?: number; width?: number }[];
    };
    const hit = (j.items || []).find((v) => v.title === title && v.guid);
    return hit?.guid
      ? {
          guid: hit.guid,
          status: typeof hit.status === "number" ? hit.status : null,
          width: typeof hit.width === "number" ? hit.width : null,
        }
      : null;
  } catch {
    return null;
  }
}

/** Télécharge la source (hôtes autorisés à chaque redirection, taille bornée). */
async function downloadSource(sourceUrl: string): Promise<Buffer | null> {
  try {
    const r = await fetchAllowedMedia(sourceUrl, { headers: { "User-Agent": UA } }, { archive: true });
    if (!r.ok || !r.body) return null;
    if (Number(r.headers.get("content-length") || 0) > MAX_UPLOAD_BYTES) return null;
    const chunks: Uint8Array[] = [];
    let total = 0;
    const reader = r.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_UPLOAD_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    return total > 0 ? Buffer.concat(chunks) : null;
  } catch {
    return null;
  }
}

/**
 * Envoie la vidéo au service : upload direct des octets (notre serveur sait
 * lire fbcdn), sinon récupération par le service lui-même depuis l'URL.
 * Source sans piste image (lien Meta expiré) → la vidéo Stream est supprimée
 * et l'envoi échoue : on ne transcode jamais un écran noir.
 */
async function uploadTo(guid: string, sourceUrl: string): Promise<boolean> {
  const buf = await downloadSource(sourceUrl);
  if (buf && !mp4HasVideoTrack(buf)) {
    console.error("[stream] source sans image (son seul)", guid);
    await deleteStream(guid);
    return false;
  }
  if (buf) {
    const put = await fetch(`${API}/library/${LIBRARY}/videos/${guid}`, {
      method: "PUT",
      headers: { AccessKey: KEY as string, "Content-Type": "application/octet-stream" },
      body: new Uint8Array(buf),
    });
    if (put.ok) return true;
    console.error("[stream] upload KO", put.status);
  }
  const fetchRes = await fetch(`${API}/library/${LIBRARY}/videos/${guid}/fetch`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ url: sourceUrl, headers: { "User-Agent": UA } }),
  });
  if (!fetchRes.ok) console.error("[stream] fetch KO", fetchRes.status);
  return fetchRes.ok;
}

/**
 * Retrouve la vidéo Stream d'une source, ou la crée SANS fichier (rapide).
 * `needsUpload` = il faut (r)envoyer le fichier (nouvelle vidéo, ou upload
 * précédent jamais arrivé / échoué). Null si non configuré ou source interdite.
 */
export async function getOrCreateStream(
  sourceUrl: string,
): Promise<{ info: StreamInfo; needsUpload: boolean } | null> {
  if (!streamConfigured()) return null;
  if (!isAllowedMediaUrl(sourceUrl, { archive: true })) return null;
  const key = streamKey(sourceUrl);
  if (!key) return null;
  const title = titleFor(key);

  const known = await findByTitle(title);
  if (known) {
    const info = infoFrom(known.guid, known.status, known.width);
    // Ancienne vidéo sans image (son seul) : on la jette et on recommence.
    if (!(info.failed && known.status === 4)) {
      return { info, needsUpload: known.status === 0 || known.status === 6 };
    }
    await deleteStream(known.guid);
  }
  const create = await fetch(`${API}/library/${LIBRARY}/videos`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ title }),
  });
  if (!create.ok) {
    console.error("[stream] create KO", create.status);
    return null;
  }
  const { guid } = (await create.json()) as { guid: string };
  return { info: infoFrom(guid, 0), needsUpload: true };
}

/** Envoie le fichier source d'une vidéo Stream (à lancer via after() ou un cron). */
export async function uploadStream(guid: string, sourceUrl: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(guid)) return false;
  if (!isAllowedMediaUrl(sourceUrl, { archive: true })) return false;
  return uploadTo(guid, sourceUrl);
}

/**
 * Retrouve ou crée la version transcodée d'une vidéo source, upload compris
 * (synchrone : pour un cron). Aucun ré-upload si elle existe déjà.
 */
export async function ensureStream(sourceUrl: string): Promise<StreamInfo | null> {
  const r = await getOrCreateStream(sourceUrl);
  if (!r) return null;
  if (!r.needsUpload) return r.info;
  const ok = await uploadStream(r.info.guid, sourceUrl);
  return infoFrom(r.info.guid, ok ? 1 : 6);
}

/** Recherche seule (sans créer) : statut de la version transcodée si elle existe. */
export async function findStream(sourceUrl: string): Promise<StreamInfo | null> {
  if (!streamConfigured()) return null;
  const key = streamKey(sourceUrl);
  if (!key) return null;
  const known = await findByTitle(titleFor(key));
  return known ? infoFrom(known.guid, known.status, known.width) : null;
}

/** Miniature d'une vidéo transcodée à partir de son URL HLS (null sinon). */
export function streamThumbFromHls(url: string | null | undefined): string | null {
  if (!url || !isStreamUrl(url) || !/\/playlist\.m3u8(\?|$)/.test(url)) return null;
  return url.replace(/\/playlist\.m3u8(\?.*)?$/, "/thumbnail.jpg");
}
