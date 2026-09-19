import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mediaStorageConfigured, storeFromUrl } from "@/lib/mediaStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Sauvegarde une pub espionnée (Spy v2 §5). Insère la ligne, puis archive
 * best-effort la créative + la miniature sur le CDN (Bunny) si configuré.
 * En cas d'échec d'archivage → on garde les liens source (media_stored=false).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

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

  const mediaSource = str("media_url");
  const thumbSource = str("thumbnail_url");

  const { data: row, error } = await supabase
    .from("spy_saved_ads")
    .upsert(
      {
        user_id: userId,
        ad_archive_id: str("ad_archive_id"),
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
  if (mediaStorageConfigured()) {
    if (mediaSource) {
      try {
        mediaCdn = (await storeFromUrl(mediaSource, `spy/${userId}/media`)).cdnUrl;
      } catch {
        /* fallback: lien source */
      }
    }
    if (thumbSource) {
      try {
        thumbCdn = (await storeFromUrl(thumbSource, `spy/${userId}/thumb`)).cdnUrl;
      } catch {
        /* fallback: lien source */
      }
    }
    if (mediaCdn || thumbCdn) {
      await supabase
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
  });
}
