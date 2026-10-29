import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWebPush, type PushPayload, type StoredSubscription } from "@/lib/webpush";
import { runSpySearch } from "@/lib/apify";
import { planConfig } from "@/lib/billing";

type WatchRow = { id: string; user_id: string; created_at: string } & Record<string, unknown>;

/**
 * Ne garde que les lignes couvertes par l'offre EFFECTIVE de leur propriétaire
 * (les N plus anciennes, N = slots ; offre expirée = Gratuit = 0) et jamais
 * celles d'un compte suspendu. Puis les 50 moins récemment vérifiées.
 */
async function entitledRows<T extends WatchRow>(
  supabase: ReturnType<typeof createAdminClient>,
  rows: T[],
): Promise<T[]> {
  const users = Array.from(new Set(rows.map((r) => r.user_id)));
  if (users.length === 0) return [];
  const [{ data: subs }, { data: profs }] = await Promise.all([
    supabase.from("subscriptions").select("user_id, plan, current_period_end").in("user_id", users),
    supabase.from("profiles").select("id, suspended").in("id", users),
  ]);
  const now = Date.now();
  const slots = new Map<string, number>();
  for (const s of (subs ?? []) as { user_id: string; plan: string; current_period_end: string | null }[]) {
    const expired = s.plan !== "free" && s.current_period_end !== null && Date.parse(s.current_period_end) <= now;
    slots.set(s.user_id, planConfig(expired ? "free" : s.plan).competitorSlots);
  }
  for (const p of (profs ?? []) as { id: string; suspended: boolean }[]) {
    if (p.suspended) slots.set(p.id, 0);
  }
  const allowed = new Set<string>();
  const byUser = new Map<string, T[]>();
  for (const r of rows) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r]);
  for (const [uid, list] of byUser) {
    list
      .sort((x, y) => Date.parse(x.created_at) - Date.parse(y.created_at))
      .slice(0, slots.get(uid) ?? 0)
      .forEach((r) => allowed.add(r.id));
  }
  return rows.filter((r) => allowed.has(r.id)).slice(0, 50);
}

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
  const { data: rows, error } = await supabase
    .from("competitors_watch")
    .select("*")
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(2000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const comps = await entitledRows(supabase, rows ?? []);
  if (comps.length === 0) {
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

      // On n'incrémente le badge que s'il y avait déjà une baseline (sinon la
      // 1re vérification compterait toutes les pubs existantes comme nouvelles).
      const badge =
        nouvelles.length > 0 && known.size > 0
          ? (c.new_ads_count ?? 0) + nouvelles.length
          : c.new_ads_count ?? 0;

      await supabase
        .from("competitors_watch")
        .update({ known_ad_ids: union, last_checked_at: nowIso, new_ads_count: badge })
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
