import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runWinnerForConfig } from "@/lib/winnerAgent";
import { WINNER_SEARCH_CAP } from "@/lib/spy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Spy v2 §7 — AI Winner Agent (cron quotidien). Itère les configs actives et
 * délègue à runWinnerForConfig (notif groupée incluse). Budget global partagé :
 * WINNER_SEARCH_CAP recherches Apify max par exécution.
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
  const { data: configs } = await supabase
    .from("winner_agent_config")
    .select("*")
    .eq("active", true);

  if (!configs || configs.length === 0) {
    return NextResponse.json({ ok: true, searches: 0, notified: 0 });
  }

  const start = Date.now();
  let searchesLeft = WINNER_SEARCH_CAP;
  let notified = 0;

  for (const cfg of configs) {
    if (searchesLeft <= 0 || Date.now() - start > 45_000) break;
    const { winners, searches } = await runWinnerForConfig(supabase, cfg, {
      sendPush: true,
      cap: searchesLeft,
      startMs: start,
    });
    searchesLeft -= searches;
    if (winners > 0) notified++;
  }

  return NextResponse.json({ ok: true, notified });
}
