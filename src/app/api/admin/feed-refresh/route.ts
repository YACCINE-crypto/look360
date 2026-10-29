import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processFeedMedia, refreshFeed } from "@/lib/feed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Déclenchement MANUEL du rafraîchissement du feed commun depuis le panneau
 * admin (même travail que le cron). Réservé à un superadmin non suspendu.
 * POST ?mode=media → passage média seul (termine les vidéos en cours).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub as string | undefined;
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: p } = await admin.from("profiles").select("role, suspended").eq("id", uid).maybeSingle();
  if (p?.role !== "superadmin" || p.suspended) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const mode = new URL(request.url).searchParams.get("mode");
  try {
    const res =
      mode === "media" ? await processFeedMedia(admin, { budgetMs: 270_000 }) : await refreshFeed(admin);
    return NextResponse.json({ ok: true, mode: mode ?? "refresh", ...res });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "feed_refresh_failed" },
      { status: 500 },
    );
  }
}
