"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSuperadmin } from "@/lib/adminGuard";

type Rpc = { rpc: (f: string, p?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> };

/** Retrait payé (mobile money envoyé à la main) ou refusé. Rôle revérifié en base. */
export async function processPayout(id: string, status: "paid" | "rejected", note: string): Promise<{ ok: boolean; error?: string }> {
  await requireSuperadmin();
  const supabase = (await createClient()) as unknown as Rpc;
  const { data, error } = await supabase.rpc("admin_process_payout", { p_id: id, p_status: status, p_note: note.trim() || null });
  if (error) return { ok: false, error: error.message };
  if (data !== status) return { ok: false, error: data === "already_processed" ? "Déjà traité." : "Demande introuvable." };
  revalidatePath("/admin/parrainage");
  return { ok: true };
}

/** Règles du programme (taux ou montant fixe, nombre de paiements, validité, seuil). */
export async function saveSettings(form: {
  commission_type: "percent" | "fixed";
  rate_pct: number;
  fixed_amount: number;
  months: number;
  attribution_days: number;
  min_payout: number;
}): Promise<{ ok: boolean; error?: string }> {
  await requireSuperadmin();
  const n = (v: number, lo: number, hi: number) => Number.isFinite(v) && v >= lo && v <= hi;
  if (!n(form.rate_pct, 0, 100) || !n(form.fixed_amount, 0, 1_000_000) || !n(form.months, 0, 36) || !n(form.attribution_days, 1, 365) || !n(form.min_payout, 0, 10_000_000))
    return { ok: false, error: "Valeurs hors limites." };
  const supabase = (await createClient()) as unknown as Rpc;
  const { error } = await supabase.rpc("admin_update_referral_settings", {
    p_commission_type: form.commission_type,
    p_rate_pct: form.rate_pct,
    p_fixed_amount: Math.round(form.fixed_amount),
    p_months: Math.round(form.months),
    p_attribution_days: Math.round(form.attribution_days),
    p_min_payout: Math.round(form.min_payout),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/parrainage");
  return { ok: true };
}
