"use client";

import { createClient } from "@/lib/supabase/client";

// Démarre un paiement via l'Edge Function (le montant est décidé côté serveur)
// et redirige vers la page de checkout. Aucun nom de prestataire n'apparaît ici.
export type PayBody =
  | { purpose: "subscription"; plan: "starter" | "pro" | "business" }
  | { purpose: "credit_pack"; packCredits: number };

export async function startPayment(
  body: PayBody,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke(
    "geniuspay-create-payment",
    { body },
  );
  if (error) return { ok: false, error: "init_failed" };
  const url = (data as { checkoutUrl?: string })?.checkoutUrl;
  if (!url) return { ok: false, error: "no_url" };
  window.location.href = url;
  return { ok: true };
}
