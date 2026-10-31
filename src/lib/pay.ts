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
  // Fonction générique : le prestataire ACTIF est choisi côté serveur
  // (PAYMENT_PROVIDER = saspay | geniuspay).
  const { data, error } = await supabase.functions.invoke(
    "saspay-create-payment",
    { body },
  );
  if (error) return { ok: false, error: "init_failed" };
  const url = (data as { checkoutUrl?: string })?.checkoutUrl;
  if (!url) return { ok: false, error: "no_url" };
  window.location.href = url;
  return { ok: true };
}

/**
 * Filet de sécurité au retour du checkout : demande au serveur de vérifier
 * les paiements en attente (statut réel chez le prestataire, livraison sur
 * SUCCESS uniquement, idempotent avec le webhook). Erreurs ignorées.
 */
export async function verifyPendingPayments(): Promise<void> {
  try {
    await createClient().functions.invoke("saspay-verify", { body: {} });
  } catch {
    /* le webhook reste la voie principale */
  }
}
