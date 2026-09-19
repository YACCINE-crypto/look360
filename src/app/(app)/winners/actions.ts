"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runWinnerForConfig } from "@/lib/winnerAgent";
import { WINNER_DEFAULTS } from "@/lib/spy";

function list(formData: FormData, key: string, upper = false): string[] {
  return String(formData.get(key) ?? "")
    .split(/[\n,]/)
    .map((s) => (upper ? s.trim().toUpperCase() : s.trim()))
    .filter(Boolean);
}
function int(formData: FormData, key: string, def: number): number {
  const n = Number(formData.get(key));
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : def;
}

/** Enregistre la config Winner Agent de l'utilisateur. */
export async function enregistrerConfigWinner(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return;

  await supabase.from("winner_agent_config").upsert(
    {
      user_id: userId,
      active: formData.get("active") === "on",
      keywords: list(formData, "keywords"),
      countries: list(formData, "countries", true),
      anciennete_min: int(formData, "anciennete_min", WINNER_DEFAULTS.anciennete_min),
      reach_min: int(formData, "reach_min", 0),
      score_min: int(formData, "score_min", WINNER_DEFAULTS.score_min),
      results_max: int(formData, "results_max", WINNER_DEFAULTS.results_max),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  revalidatePath("/winners");
}

/** Déclenche le Winner Agent tout de suite (sans attendre le cron). */
export async function lancerWinnerMaintenant(): Promise<void> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return;

  // Charge la config, ou crée-la avec des valeurs par défaut.
  let { data: cfg } = await supabase
    .from("winner_agent_config")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (!cfg) {
    const { data: created } = await supabase
      .from("winner_agent_config")
      .upsert({ user_id: userId, ...WINNER_DEFAULTS }, { onConflict: "user_id" })
      .select("*")
      .single();
    cfg = created;
  }
  if (cfg) {
    const admin = createAdminClient();
    await runWinnerForConfig(admin, cfg, { sendPush: false });
  }
  revalidatePath("/winners");
}
