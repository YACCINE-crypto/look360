import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWebPush, type PushPayload, type StoredSubscription } from "@/lib/webpush";
import { runSpySearch } from "@/lib/apify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron quotidien : pour chaque concurrent suivi (les moins récemment vérifiés
 * d'abord), relance une recherche Apify de ses pubs actives et détecte les
 * NOUVELLES pubs (anti-doublon via known_ad_ids). Nouvelle pub → push PWA.
 * Budget de temps ~45s (une requête Apify/concurrent) pour rester sous la
 * limite serverless ; les concurrents non traités passent au prochain run.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const supabase = createAdminClient();
  const { data: comps, error } = await supabase
    .from("competitors_watch")
    .select("*")
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!comps || comps.length === 0) {
    return NextResponse.json({ ok: true, checked: 0, notified: 0 });
  }

  const webpush = getWebPush();
  const start = Date.now();
  let checked = 0;
  let notified = 0;

  for (const c of comps) {
    if (Date.now() - start > 45_000) break; // budget serverless

    const nowIso = new Date().toISOString();
    try {
      const { ads } = await runSpySearch({
        q: "",
        country: c.country || "FR",
        pageId: c.page_id,
        statut: "active",
        limit: 30,
      });
      const ids = ads.map((a) => a.ad_archive_id).filter(Boolean);
      const known = new Set(c.known_ad_ids ?? []);
      const nouvelles = ids.filter((id) => !known.has(id));
      // On garde l'union (borne à 500 ids pour éviter une croissance infinie).
      const union = Array.from(new Set([...(c.known_ad_ids ?? []), ...ids])).slice(-500);

      await supabase
        .from("competitors_watch")
        .update({ known_ad_ids: union, last_checked_at: nowIso })
        .eq("id", c.id);
      checked++;

      // On ne notifie que s'il y avait déjà une baseline (évite de notifier
      // toutes les pubs existantes lors de la 1re vérification).
      if (nouvelles.length > 0 && known.size > 0) {
        const { data: subs } = await supabase
          .from("push_subscriptions")
          .select("id, endpoint, keys")
          .eq("user_id", c.user_id);

        if (subs && subs.length > 0) {
          const payload: PushPayload = {
            title: `${c.page_name || "Un concurrent"} a lancé une nouvelle pub`,
            body:
              nouvelles.length > 1
                ? `${nouvelles.length} nouvelles pubs détectées.`
                : "1 nouvelle pub détectée.",
            url: `/spy?pageId=${encodeURIComponent(c.page_id)}&country=${encodeURIComponent(c.country || "FR")}&name=${encodeURIComponent(c.page_name || "")}`,
            tag: `spy-comp-${c.page_id}`,
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
                await supabase.from("push_subscriptions").delete().eq("id", s.id);
              }
            }
          }
          notified++;
        }
      }
    } catch {
      // Échec Apify pour ce concurrent : on marque quand même la date et on continue.
      await supabase.from("competitors_watch").update({ last_checked_at: nowIso }).eq("id", c.id);
    }
  }

  return NextResponse.json({ ok: true, checked, notified });
}
