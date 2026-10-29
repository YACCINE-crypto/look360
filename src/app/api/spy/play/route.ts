import { after, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { accountSuspended } from "@/lib/accountGuard";
import { isAllowedMediaUrl } from "@/lib/mediaHosts";
import { getSubscription } from "@/lib/credits";
import { planLimits } from "@/lib/billing";
import {
  getOrCreateStream,
  streamConfigured,
  streamKey,
  streamStatus,
  uploadStream,
} from "@/lib/bunnyStream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// L'upload vers le service de streaming tourne APRÈS la réponse (after()) et
// dispose de cette durée : téléchargement de la créative + envoi.
export const maxDuration = 120;

/**
 * Résolveur de lecture vidéo (transcodage H.264/HLS côté service de streaming).
 * Les créatives Meta (fbcdn) sont souvent des pistes DASH illisibles en direct
 * (écran noir) : on les transcode une fois, puis tout le monde lit le flux HLS.
 *
 * - GET ?url=<source>[&ad=<ad_archive_id>] → retrouve ou lance le transcodage,
 *   renvoie { configured, guid, ready, hls, failed }. Idempotent (même vidéo
 *   source = même transcodage, voir lib/bunnyStream).
 * - GET ?guid=<id>  → statut d'un transcodage en cours (polling client).
 * - GET ?diag=1     → diagnostic sans aucune valeur secrète.
 *
 * Créer un transcodage coûte : réservé aux offres payantes, ou aux vidéos du
 * feed commun (déjà transcodées par le cron, sinon complétées ici).
 */

const API = "https://video.bunnycdn.com";

async function allowedToTranscode(userId: string, source: string, adId: string | null): Promise<boolean> {
  const sub = await getSubscription(userId);
  if (planLimits(sub?.plan).monthlySearches > 0) return true;
  // Offre gratuite : seulement une créative du feed commun, et la bonne vidéo.
  if (!adId || !/^\d{1,32}$/.test(adId)) return false;
  const admin = createAdminClient();
  const { data } = await admin.from("feed_ads").select("payload").eq("ad_archive_id", adId).maybeSingle();
  const p = (data?.payload ?? null) as { media_url?: string | null; media_source_url?: string | null } | null;
  const key = streamKey(source);
  return Boolean(
    key && p && [p.media_source_url, p.media_url].some((u) => u && streamKey(u) === key),
  );
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (await accountSuspended(userId)) {
    return NextResponse.json({ error: "compte suspendu" }, { status: 403 });
  }
  if (!streamConfigured()) {
    return NextResponse.json({ configured: false });
  }

  const sp = new URL(request.url).searchParams;
  const guidParam = sp.get("guid");
  const source = sp.get("url");
  const adId = sp.get("ad");

  if (sp.get("diag") === "1") {
    let bunnyListStatus = 0;
    try {
      const lib = process.env.BUNNY_STREAM_LIBRARY_ID;
      const r = await fetch(`${API}/library/${lib}/videos?itemsPerPage=1&page=1`, {
        headers: { AccessKey: process.env.BUNNY_STREAM_API_KEY as string, accept: "application/json" },
        cache: "no-store",
      });
      bunnyListStatus = r.status; // 200 = clé+librairie OK · 401 = clé · 404 = librairie
    } catch {
      bunnyListStatus = -1;
    }
    return NextResponse.json({ configured: true, bunnyListStatus });
  }

  try {
    if (guidParam) {
      const info = await streamStatus(guidParam);
      if (!info) return NextResponse.json({ error: "guid invalide" }, { status: 400 });
      return NextResponse.json({ configured: true, ...info });
    }

    if (!source) return NextResponse.json({ error: "url requise" }, { status: 400 });
    if (!isAllowedMediaUrl(source, { archive: true })) {
      return NextResponse.json({ error: "source non autorisée" }, { status: 400 });
    }
    if (!(await allowedToTranscode(userId, source, adId))) {
      // Pas de transcodage pour ce compte : le lecteur tente la lecture directe.
      return NextResponse.json({ configured: true, allowed: false });
    }

    const r = await getOrCreateStream(source);
    if (!r) return NextResponse.json({ configured: true, failed: true }, { status: 502 });
    if (r.needsUpload) {
      const { guid } = r.info;
      after(async () => {
        const ok = await uploadStream(guid, source);
        if (!ok) console.error("[spy/play] upload KO", guid);
      });
    }
    return NextResponse.json({ configured: true, allowed: true, ...r.info });
  } catch {
    return NextResponse.json({ configured: true, failed: true }, { status: 502 });
  }
}
