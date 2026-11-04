import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { mediaStorageConfigured, storeFromUrl } from "@/lib/mediaStorage";
import type { Json } from "@/lib/database.types";

type Admin = ReturnType<typeof createAdminClient>;
type AdLike = { ad_archive_id?: string; page_id?: string | null; start_date?: string | null; thumbnail_url?: string | null } & Record<
  string,
  unknown
>;

/**
 * Les miniatures Meta (fbcdn) sont des liens signés qui expirent (paramètre
 * `oe`, quelques jours). Retourne true si le lien est encore utilisable.
 */
export function metaUrlAlive(url: string | null | undefined, marginMs = 3_600_000): boolean {
  if (!url) return false;
  const m = /[?&]oe=([0-9A-Fa-f]+)/.exec(url);
  if (!m) return true; // pas de signature : on tente
  return parseInt(m[1], 16) * 1000 > Date.now() + marginMs;
}

/**
 * Remplit l'historique d'un concurrent à partir des recherches Spy déjà en
 * cache (aucun appel Apify) : utile au 1er suivi et quand Apify est
 * indisponible. Les pubs existantes ne sont pas touchées.
 */
export async function seedFromSpyCache(admin: Admin, pageId: string): Promise<number> {
  const { data: rows } = await admin
    .from("spy_searches")
    .select("results, created_at")
    .filter("results", "cs", JSON.stringify([{ page_id: pageId }]))
    .order("created_at", { ascending: false })
    .limit(60);
  const byId = new Map<string, { ad: AdLike; first: string; last: string }>();
  for (const r of rows ?? []) {
    for (const ad of ((r.results as unknown as AdLike[]) ?? [])) {
      if (ad?.page_id !== pageId || !ad.ad_archive_id) continue;
      const prev = byId.get(ad.ad_archive_id);
      if (!prev) byId.set(ad.ad_archive_id, { ad, first: r.created_at, last: r.created_at });
      else if (r.created_at < prev.first) prev.first = r.created_at; // lignes triées du plus récent au plus ancien
    }
  }
  if (byId.size === 0) return 0;
  const { error } = await admin.from("competitor_ads").upsert(
    [...byId.values()].map(({ ad, first, last }) => ({
      page_id: pageId,
      ad_archive_id: ad.ad_archive_id as string,
      payload: ad as unknown as Json,
      start_date: ad.start_date ?? null,
      first_seen: first,
      last_seen: last,
      baseline: true,
    })),
    { onConflict: "page_id,ad_archive_id", ignoreDuplicates: true },
  );
  return error ? 0 : byId.size;
}

/**
 * Archive sur le CDN (Bunny) les miniatures encore valides d'un concurrent qui
 * n'ont pas de copie : les pubs coupées gardent ainsi leur aperçu.
 * `fresh` = pubs tout juste renvoyées par Meta (liens neufs) à privilégier.
 */
export async function archiveThumbs(
  admin: Admin,
  pageId: string,
  opts: { fresh?: AdLike[]; max?: number; deadline?: number } = {},
): Promise<number> {
  if (!mediaStorageConfigured()) return 0;
  const max = opts.max ?? 20;
  const { data: rows } = await admin
    .from("competitor_ads")
    .select("ad_archive_id, payload")
    .eq("page_id", pageId)
    .is("payload->>thumbnail_cdn_url", null)
    .order("last_seen", { ascending: false })
    .limit(400);
  const freshById = new Map((opts.fresh ?? []).filter((a) => a.ad_archive_id).map((a) => [a.ad_archive_id as string, a]));
  let done = 0;
  for (const r of rows ?? []) {
    if (done >= max || (opts.deadline && Date.now() > opts.deadline)) break;
    const stored = r.payload as unknown as AdLike;
    const fresh = freshById.get(r.ad_archive_id);
    const src = [fresh?.thumbnail_url, stored?.thumbnail_url].find((u) => metaUrlAlive(u));
    if (!src) continue;
    try {
      const { cdnUrl } = await storeFromUrl(src, `competitors/${pageId}`);
      await admin
        .from("competitor_ads")
        .update({ payload: { ...(stored ?? {}), ...(fresh ?? {}), thumbnail_cdn_url: cdnUrl } as unknown as Json })
        .eq("page_id", pageId)
        .eq("ad_archive_id", r.ad_archive_id);
      done++;
    } catch {
      /* source refusée ou stockage indisponible : on garde le lien Meta */
    }
  }
  return done;
}
