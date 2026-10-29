import { after, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mediaStorageConfigured, storeFromUrl } from "@/lib/mediaStorage";
import { getOrCreateStream, hlsUrlFor, uploadStream } from "@/lib/bunnyStream";
import { reserveMedia, releaseMedia, QuotaError } from "@/lib/usage";
import { accountSuspended } from "@/lib/accountGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Inclut l'envoi de la vidéo au transcodage, après la réponse (after()).
export const maxDuration = 120;

/**
 * Sauvegarde une pub espionnée (Spy v2 §5). Insère la ligne, puis archive
 * best-effort la créative + la miniature sur le CDN (Bunny) si configuré.
 * En cas d'échec d'archivage → on garde les liens source (media_stored=false).
 * Chaque objet archivé consomme le quota de stockage média de l'offre
 * (reserve_media, atomique) ; quota atteint → pas d'archivage, liens source.
 * Écritures via service_role : le client n'a plus de droit d'écriture direct
 * sur spy_saved_ads (0032), donc ni sur media_stored ni sur les URLs CDN.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (await accountSuspended(userId)) return NextResponse.json({ error: "compte suspendu" }, { status: 403 });

  let ad: Record<string, unknown>;
  try {
    ad = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const str = (k: string) => {
    const v = ad[k];
    return typeof v === "string" && v.trim() ? v : null;
  };
  const num = (k: string) => {
    const v = ad[k];
    return typeof v === "number" ? v : null;
  };

  // Une pub = un ad_archive_id (clé d'unicité) : sans lui, chaque appel créerait
  // une nouvelle ligne et un nouvel archivage.
  const adArchiveId = str("ad_archive_id");
  if (!adArchiveId || !/^\d{1,32}$/.test(adArchiveId)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const mediaSource = str("media_url");
  const thumbSource = str("thumbnail_url");

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("spy_saved_ads")
    .upsert(
      {
        user_id: userId,
        ad_archive_id: adArchiveId,
        page_id: str("page_id"),
        page_name: str("page_name"),
        ad_text: str("ad_text"),
        landing_url: str("landing_url"),
        ad_library_url: str("ad_library_url"),
        start_date: str("start_date"),
        variants_count: num("variants_count"),
        reach_estimate: num("reach"),
        platforms: Array.isArray(ad.platforms) ? (ad.platforms as string[]) : null,
        is_active: typeof ad.is_active === "boolean" ? (ad.is_active as boolean) : null,
        media_type: str("media_type"),
        media_source_url: mediaSource,
        thumbnail_source_url: thumbSource,
        score: num("score"),
        pays_cible: str("country"),
      },
      { onConflict: "user_id,ad_archive_id" },
    )
    .select("id, media_stored")
    .single();

  if (error || !row) {
    return NextResponse.json({ error: error?.message || "save_failed" }, { status: 500 });
  }

  // Déjà archivé lors d'une sauvegarde précédente : ne pas re-télécharger.
  if (row.media_stored) {
    return NextResponse.json({ ok: true, id: row.id, media_stored: true, already: true });
  }

  let mediaCdn: string | null = null;
  let thumbCdn: string | null = null;
  let quotaReached = false;
  const wanted = (mediaSource ? 1 : 0) + (thumbSource ? 1 : 0);
  let reserved = 0;
  if (mediaStorageConfigured() && wanted > 0) {
    try {
      await reserveMedia(userId, wanted);
      reserved = wanted;
    } catch (e) {
      if (!(e instanceof QuotaError)) throw e;
      quotaReached = true;
    }
  }
  if (reserved > 0) {
    if (mediaSource) {
      if (str("media_type") === "video") {
        // Vidéo : transcodage H.264/HLS (les pistes Meta DASH restent noires en
        // lecture directe). L'URL HLS est stable ; le fichier part après la
        // réponse (after) et le lecteur attend la fin de l'encodage si besoin.
        try {
          const s = await getOrCreateStream(mediaSource);
          if (s) {
            mediaCdn = hlsUrlFor(s.info.guid);
            if (s.needsUpload) {
              const { guid } = s.info;
              after(async () => {
                await uploadStream(guid, mediaSource);
              });
            }
          }
        } catch {
          /* fallback: lien source */
        }
      } else {
        try {
          mediaCdn = (await storeFromUrl(mediaSource, `spy/${userId}/media`)).cdnUrl;
        } catch {
          /* fallback: lien source */
        }
      }
    }
    if (thumbSource) {
      try {
        thumbCdn = (await storeFromUrl(thumbSource, `spy/${userId}/thumb`)).cdnUrl;
      } catch {
        /* fallback: lien source */
      }
    }
    // Rend le quota des objets qui n'ont pas pu être archivés.
    await releaseMedia(userId, reserved - (mediaCdn ? 1 : 0) - (thumbCdn ? 1 : 0));
    if (mediaCdn || thumbCdn) {
      await admin
        .from("spy_saved_ads")
        .update({
          media_cdn_url: mediaCdn,
          thumbnail_cdn_url: thumbCdn,
          media_stored: Boolean(mediaCdn),
        })
        .eq("id", row.id);
    }
  }

  return NextResponse.json({
    ok: true,
    id: row.id,
    media_stored: Boolean(mediaCdn),
    archived_thumb: Boolean(thumbCdn),
    ...(quotaReached ? { quota: "media" } : {}),
  });
}
