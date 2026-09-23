import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// ============================================================================
// Accès serveur au moteur de crédits. TOUT passe par le service_role + les
// fonctions SQL SECURITY DEFINER (apply_credits) : le client ne peut jamais
// modifier son solde. Le userId doit venir d'une session vérifiée (getClaims).
// ============================================================================

export class InsufficientCreditsError extends Error {
  constructor() {
    super("insufficient_credits");
    this.name = "InsufficientCreditsError";
  }
}

export type Subscription = {
  plan: string;
  status: string;
  monthly_credits: number;
  pack_credits: number;
  credits_balance: number;
  current_period_end: string | null;
  has_ever_paid: boolean;
};

/** Abonnement + solde d'un compte (via service_role — lecture fiable). */
export async function getSubscription(userId: string): Promise<Subscription | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("subscriptions")
    .select("plan, status, monthly_credits, pack_credits, credits_balance, current_period_end, has_ever_paid")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as Subscription | null) ?? null;
}

/**
 * Débite `amount` crédits (>0) du compte. Atomique et tracé. Lève
 * InsufficientCreditsError si le solde est insuffisant.
 */
export async function consumeCredits(
  userId: string,
  amount: number,
  reason: string,
  reference?: string,
): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("apply_credits", {
    p_user: userId,
    p_delta: -Math.abs(amount),
    p_type: "consumption",
    p_reason: reason,
    p_reference: reference ?? null,
  });
  if (error) {
    if (error.message.includes("insufficient_credits")) throw new InsufficientCreditsError();
    throw new Error(error.message);
  }
  return data as number;
}

/** Recrédite `amount` (>0) — ex. remboursement d'une recherche qui a échoué. */
export async function refundCredits(userId: string, amount: number, reason: string): Promise<void> {
  const admin = createAdminClient();
  await admin.rpc("apply_credits", {
    p_user: userId,
    p_delta: Math.abs(amount),
    p_type: "refund",
    p_reason: reason,
    p_reference: null,
  });
}
