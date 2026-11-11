"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/onboarding/options";

type Res = { ok: true; amount: number } | { ok: false; error: string };

const ERR: Record<string, string> = {
  method: "Choisis un moyen de paiement.",
  phone: "Numéro invalide : écris-le avec l'indicatif, ex. +225 07 00 00 00 00.",
  already_requested: "Tu as déjà une demande de retrait en cours.",
  below_minimum: "Le seuil de retrait n'est pas encore atteint.",
};

/** Demande de retrait : tout le disponible, si ≥ seuil (vérifié en base). */
export async function requestPayout(method: string, rawPhone: string): Promise<Res> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return { ok: false, error: ERR.phone };
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as {
    rpc: (f: string, p: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  }).rpc("request_referral_payout", { p_method: method, p_phone: phone });
  if (error) return { ok: false, error: "Demande impossible pour le moment. Réessaie plus tard." };
  const r = data as { ok: boolean; error?: string; amount?: number };
  if (!r.ok) return { ok: false, error: ERR[r.error ?? ""] ?? "Demande refusée." };
  revalidatePath("/parrainage");
  return { ok: true, amount: r.amount ?? 0 };
}
