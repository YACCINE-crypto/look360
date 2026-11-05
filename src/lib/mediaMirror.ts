import "server-only";
import { isMetaMediaHost } from "@/lib/mediaHosts";
import { cdnObjectExists, getUrl, mediaStorageConfigured, storeFromUrl } from "@/lib/mediaStorage";
import type { SpyAd } from "@/lib/spy";

// ============================================================================
// Miroir des créas publicitaires sur Bunny. Les liens Meta (fbcdn) EXPIRENT
// au bout de quelques jours : affichés tels quels, ils deviennent des cadres
// blancs. On copie donc chaque créa dès l'ingestion :
//   - image / miniature  → Bunny Storage (ads/thumb/<id>.jpg)
//   - vidéo              → fichier BRUT sur Bunny Storage (ads/raw/<id>.mp4),
//                          sans transcodage (pas cher). La version HLS n'est
//                          produite qu'à la 1re lecture, DEPUIS ce fichier brut
//                          qui, lui, n'expire jamais.
// Idempotent : clé fixe par pub (ad_archive_id) + vérification d'existence
// avant envoi ; une pub déjà copiée n'est jamais renvoyée. Lien Meta déjà
// expiré → la pub est marquée « média manquant » (jamais affichée cassée).
// ============================================================================

/** Champs ajoutés au SpyAd par le miroir (stockés dans le JSON des pubs). */
export type MirroredAd = SpyAd & {
  /** Fichier vidéo brut archivé sur Bunny Storage (source du transcodage). */
  media_raw_url?: string | null;
  /** Lien Meta d'origine de la miniature (trace, jamais affiché). */
  thumbnail_source_url?: string | null;
  /** Créa introuvable chez Meta au moment du miroir → placeholder. */
  media_missing?: boolean;
  /** Date du dernier passage du miroir (évite de retenter sans fin). */
  mirrored_at?: string;
};

export type MirrorStats = {
  thumbs: number;
  videos: number;
  reused: number;
  missing: number;
  failed: number;
  skipped: number;
  /** Premiers messages d'erreur distincts (diagnostic, sans secret). */
  errors?: string[];
};

export const emptyStats = (): MirrorStats => ({ thumbs: 0, videos: 0, reused: 0, missing: 0, failed: 0, skipped: 0, errors: [] });

/** Note une erreur (max 8 messages distincts) pour le rapport du job. */
function noteError(stats: MirrorStats, where: string, e: unknown) {
  const msg = `${where}: ${e instanceof Error ? `${e.name === "Error" ? "" : e.name + " "}${e.message}` : String(e)}`.slice(0, 160);
  stats.errors ??= [];
  if (stats.errors.length < 8 && !stats.errors.includes(msg)) stats.errors.push(msg);
}

const isMeta = (u: string | null | undefined): u is string => {
  if (!u) return false;
  try {
    return isMetaMediaHost(new URL(u).hostname);
  } catch {
    return false;
  }
};

const safeId = (id: unknown) => String(id).replace(/[^0-9A-Za-z_-]/g, "").slice(0, 64);

/** Erreur « lien Meta expiré / introuvable » (inutile de réessayer). */
const isGone = (e: unknown) => /source_fetch_(403|404|410)/.test(e instanceof Error ? e.message : String(e));

/** Copie avec 1 nouvel essai (2 s) sur erreur transitoire ; jamais sur un lien expiré. */
async function copyOnce(source: string, key: string): Promise<{ url: string; reused: boolean }> {
  if (await cdnObjectExists(key)) return { url: getUrl(key), reused: true };
  try {
    return { url: (await storeFromUrl(source, "", { fixedKey: key })).cdnUrl, reused: false };
  } catch (e) {
    if (isGone(e)) throw e;
    await new Promise((r) => setTimeout(r, 2000));
    return { url: (await storeFromUrl(source, "", { fixedKey: key })).cdnUrl, reused: false };
  }
}

/**
 * Copie les créas d'UNE pub sur Bunny. Ne lève jamais : renvoie la pub mise à
 * jour (ou inchangée) et alimente `stats`. `videos=false` → miniatures seules
 * (rapide, utilisé pendant une recherche ; les vidéos passent juste après).
 */
export async function mirrorAd(ad: MirroredAd, stats: MirrorStats, opts: { videos: boolean }): Promise<MirroredAd> {
  if (!ad?.ad_archive_id || !mediaStorageConfigured()) {
    stats.skipped++;
    return ad;
  }
  const id = safeId(ad.ad_archive_id);
  const out: MirroredAd = { ...ad };
  let touched = false;

  // 1) Image / miniature.
  if (isMeta(out.thumbnail_url)) {
    const src = out.thumbnail_url;
    try {
      const r = await copyOnce(src, `ads/thumb/${id}.jpg`);
      out.thumbnail_source_url = src;
      out.thumbnail_url = r.url;
      // Pub image : le visuel affiché EST la miniature.
      if (out.media_type !== "video" && out.media_url === src) out.media_url = r.url;
      if (r.reused) stats.reused++;
      else stats.thumbs++;
    } catch (e) {
      if (isGone(e)) {
        out.thumbnail_url = null;
        if (out.media_type !== "video") out.media_missing = true;
        stats.missing++;
      } else {
        stats.failed++;
        noteError(stats, "miniature", e);
        console.error("[mirror] miniature KO", id, e instanceof Error ? e.message : e);
      }
    }
    touched = true;
  }
  // Pub image dont le visuel diffère de la miniature.
  if (out.media_type === "image" && isMeta(out.media_url)) {
    const src = out.media_url;
    try {
      const r = await copyOnce(src, `ads/image/${id}.jpg`);
      out.media_url = r.url;
      if (r.reused) stats.reused++;
      else stats.thumbs++;
    } catch (e) {
      if (isGone(e)) {
        out.media_url = out.thumbnail_url;
        if (!out.thumbnail_url) out.media_missing = true;
        stats.missing++;
      } else {
        stats.failed++;
        noteError(stats, "image", e);
      }
    }
    touched = true;
  }

  // 2) Vidéo : fichier brut, sans transcodage.
  if (opts.videos && out.media_type === "video" && !out.media_raw_url && !out.media_hls_url) {
    const src = isMeta(out.media_source_url) ? out.media_source_url : isMeta(out.media_url) ? out.media_url : null;
    if (src) {
      try {
        const r = await copyOnce(src, `ads/raw/${id}.mp4`);
        out.media_raw_url = r.url;
        // Le transcodage (1re lecture) et le lecteur partent désormais du
        // fichier archivé, plus jamais du lien Meta.
        out.media_source_url = r.url;
        out.media_url = r.url;
        if (r.reused) stats.reused++;
        else stats.videos++;
      } catch (e) {
        if (isGone(e)) {
          out.media_missing = true;
          stats.missing++;
        } else {
          stats.failed++;
          noteError(stats, "vidéo", e);
          console.error("[mirror] vidéo KO", id, e instanceof Error ? e.message : e);
        }
      }
      touched = true;
    }
  }

  if (touched) out.mirrored_at = new Date().toISOString();
  return out;
}

/** true si la pub a encore une créa à copier (miniature Meta ou vidéo non archivée). */
export function needsMirror(ad: MirroredAd, videos: boolean): boolean {
  if (!ad?.ad_archive_id || ad.media_missing) return false;
  if (isMeta(ad.thumbnail_url)) return true;
  if (ad.media_type === "image" && isMeta(ad.media_url)) return true;
  return (
    videos &&
    ad.media_type === "video" &&
    !ad.media_raw_url &&
    !ad.media_hls_url &&
    (isMeta(ad.media_source_url) || isMeta(ad.media_url))
  );
}

/**
 * Copie les créas d'une liste de pubs (6 en parallèle), dans un budget de
 * temps : ce qui n'a pas pu être traité reste tel quel et sera repris par le
 * job de rattrapage. Renvoie la liste dans le même ordre.
 */
export async function mirrorAds(
  ads: MirroredAd[],
  opts: { videos: boolean; budgetMs: number; stats?: MirrorStats },
): Promise<{ ads: MirroredAd[]; stats: MirrorStats; complete: boolean }> {
  const stats = opts.stats ?? emptyStats();
  const deadline = Date.now() + opts.budgetMs;
  const out = ads.slice();
  let next = 0;
  let complete = true;
  const worker = async () => {
    while (next < out.length) {
      const i = next++;
      if (!needsMirror(out[i], opts.videos)) continue;
      if (Date.now() > deadline) {
        complete = false;
        return;
      }
      out[i] = await mirrorAd(out[i], stats, opts);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  return { ads: out, stats, complete };
}
