// ===========================================================================
// Tarifs & crédits — SOURCE DE VÉRITÉ CÔTÉ SERVEUR (Edge Functions).
// Miroir de src/lib/billing.ts. Le client n'impose jamais un montant ni un
// nombre de crédits : il envoie seulement un identifiant (plan / pack), et
// c'est ce fichier qui décide le prix (FCFA) et les crédits INTERNES à créditer.
//
// UNITÉ DES CRÉDITS : interne (ce que stocke la base). L'affichage ×100 est
// purement front. On crédite donc l'unité interne — marge inchangée.
// ===========================================================================

export type PaidPlan = "starter" | "pro" | "business";

export const PLAN_PRICING: Record<
  PaidPlan,
  { priceNormal: number; priceFirst: number }
> = {
  // Offres v3 : prix FIXES (le prix bas EST l'offre de lancement, plus de
  // tarif de bienvenue). priceFirst = priceNormal pour ne rien changer ailleurs.
  starter: { priceNormal: 5000, priceFirst: 5000 },
  pro: { priceNormal: 10000, priceFirst: 10000 },
  business: { priceNormal: 15000, priceFirst: 15000 },
};

export function isPaidPlan(p: unknown): p is PaidPlan {
  return p === "starter" || p === "pro" || p === "business";
}

/** Prix d'un abonnement : tarif de bienvenue si jamais payé, sinon normal. */
export function subscriptionPrice(plan: PaidPlan, hasEverPaid: boolean): number {
  const p = PLAN_PRICING[plan];
  return hasEverPaid ? p.priceNormal : p.priceFirst;
}

// Packs de recharge : SUPPRIMÉS (modèle 100 % abonnement). Liste vide →
// findPack renvoie null → toute demande de pack est refusée (invalid_pack).
export const CREDIT_PACKS: { credits: number; price: number }[] = [];

/** Retrouve un pack par ses crédits internes (valeur validée, non falsifiable). */
export function findPack(creditsInternal: number) {
  return CREDIT_PACKS.find((p) => p.credits === creditsInternal) ?? null;
}
