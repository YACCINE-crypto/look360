import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getWebPush, type PushPayload, type StoredSubscription } from "@/lib/webpush";
import { searchSpyWithCache } from "@/lib/spyCache";
import { WINNER_SEARCH_CAP, type SpyAd } from "@/lib/spy";
import type { Database, Json } from "@/lib/database.types";

type Admin = SupabaseClient<Database>;
type Config = Database["public"]["Tables"]["winner_agent_config"]["Row"];

/**
 * Exécute le Winner Agent pour UNE config : recherches (mots-clés × pays),
 * filtre score, exclut le déjà-vu, enregistre le top N du jour. Retourne le
 * nombre de gagnants trouvés et de recherches consommées. `sendPush` envoie la
 * notif groupée (cron) ; à false pour un déclenchement manuel.
 */
export async function runWinnerForConfig(
  admin: Admin,
  cfg: Config,
  opts: { sendPush?: boolean; cap?: number; startMs?: number } = {},
): Promise<{ winners: number; searches: number }> {
  const cap = opts.cap ?? WINNER_SEARCH_CAP;
  const start = opts.startMs ?? Date.now();
  let searches = 0;

  const { data: seenRows } = await admin
    .from("winner_agent_seen")
    .select("ad_archive_id")
    .eq("user_id", cfg.user_id);
  const seen = new Set((seenRows ?? []).map((r) => r.ad_archive_id));

  const keywords = cfg.keywords.length ? cfg.keywords : [""];
  const countries = cfg.countries.length ? cfg.countries : ["FR"];
  const found = new Map<string, SpyAd>();

  outer: for (const country of countries) {
    for (const kw of keywords) {
      if (searches >= cap || Date.now() - start > 45_000) break outer;
      searches++;
      try {
        const { ads } = await searchSpyWithCache(
          {
            q: kw,
            country,
            statut: "active",
            ancienneteMin: cfg.anciennete_min,
            reachMin: cfg.reach_min,
            tri: "score",
            limit: 50,
          },
          cfg.user_id,
        );
        for (const ad of ads) {
          if (ad.ad_archive_id && ad.score >= cfg.score_min && !seen.has(ad.ad_archive_id)) {
            const prev = found.get(ad.ad_archive_id);
            if (!prev || ad.score > prev.score) found.set(ad.ad_archive_id, ad);
          }
        }
      } catch {
        /* skip */
      }
    }
  }

  const winners = [...found.values()].sort((a, b) => b.score - a.score).slice(0, cfg.results_max);
  if (winners.length === 0) return { winners: 0, searches };

  const today = new Date().toISOString().slice(0, 10);
  await admin.from("winner_daily").insert(
    winners.map((w) => ({
      user_id: cfg.user_id,
      day: today,
      ad_archive_id: w.ad_archive_id,
      score: w.score,
      payload: w as unknown as Json,
    })),
  );
  await admin.from("winner_agent_seen").upsert(
    winners.map((w) => ({ user_id: cfg.user_id, ad_archive_id: w.ad_archive_id })),
    { onConflict: "user_id,ad_archive_id" },
  );

  if (opts.sendPush) {
    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, keys")
      .eq("user_id", cfg.user_id);
    if (subs && subs.length > 0) {
      const webpush = getWebPush();
      const payload: PushPayload = {
        title: `${winners.length} winner${winners.length > 1 ? "s" : ""} du jour repéré${winners.length > 1 ? "s" : ""}`,
        body: "Ouvre la vue Winners du jour pour les découvrir.",
        url: "/winners",
        tag: "winner-daily",
      };
      for (const s of subs) {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: s.keys } as unknown as StoredSubscription as never,
            JSON.stringify(payload),
          );
        } catch (e: unknown) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) {
            await admin.from("push_subscriptions").delete().eq("id", s.id);
          }
        }
      }
    }
  }

  return { winners: winners.length, searches };
}
