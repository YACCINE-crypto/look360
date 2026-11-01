import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// ============================================================================
// Plafond MENSUEL des recherches lancées par le SYSTÈME (feed du matin +
// découverte par mots-clés), en nombre de pubs récupérées chez Apify
// (≈ 0,75 $ / 1 000 pubs). Formule « Économe » : 8 000 pubs / mois (~6 $).
// Les recherches des utilisateurs ne comptent pas ici : elles sont bornées
// par leurs quotas d'abonnement.
// ============================================================================

export const SYSTEM_MONTHLY_ADS = Math.max(0, Number(process.env.APIFY_SYSTEM_MONTHLY_ADS ?? 8000) || 0);

/** Pubs récupérées par le système depuis le 1er du mois (UTC). */
export async function systemAdsThisMonth(): Promise<number> {
  const admin = createAdminClient();
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const { data } = await admin.from("spy_searches").select("raw_count").is("user_id", null).gte("created_at", start).limit(5000);
  return (data ?? []).reduce((s, r) => s + (r.raw_count ?? 0), 0);
}

/** Pubs encore disponibles ce mois-ci pour le système (0 = stop). */
export async function systemAdsLeft(): Promise<number> {
  return Math.max(0, SYSTEM_MONTHLY_ADS - (await systemAdsThisMonth()));
}
