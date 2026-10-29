import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron quotidien : repasse en Gratuit les abonnements payants dont la période
 * est terminée (expire_subscription, SQL definer). Les droits sont déjà
 * appliqués à l'usage (effective_plan) ; ce job remet la base à l'état réel
 * pour l'admin, les relances et les statistiques.
 * Vercel Cron envoie `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("subscriptions")
    .select("user_id")
    .neq("plan", "free")
    .lte("current_period_end", new Date().toISOString())
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let expired = 0;
  const failed: string[] = [];
  for (const s of data ?? []) {
    const { error: e } = await admin.rpc("expire_subscription", { p_user: s.user_id });
    if (e) failed.push(s.user_id);
    else expired++;
  }
  if (failed.length) console.error("expire_subscription failed for", failed.length, "users");
  return NextResponse.json({ ok: true, expired, failed: failed.length });
}
