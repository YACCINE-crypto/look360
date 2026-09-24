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
  starter: { priceNormal: 7500, priceFirst: 5000 },
  pro: { priceNormal: 15000, priceFirst: 10000 },
  business: { priceNormal: 25000, priceFirst: 17500 },
};

export function isPaidPlan(p: unknown): p is PaidPlan {
  return p === "starter" || p === "pro" || p === "business";
}

/** Prix d'un abonnement : tarif de bienvenue si jamais payé, sinon normal. */
export function subscriptionPrice(plan: PaidPlan, hasEverPaid: boolean): number {
  const p = PLAN_PRICING[plan];
  return hasEverPaid ? p.priceNormal : p.priceFirst;
}

// Packs de recharge — crédits INTERNES (affichés ×100 : 50 000 / 120 000 / 300 000).
export const CREDIT_PACKS: { credits: number; price: number }[] = [
  { credits: 500, price: 3000 },
  { credits: 1200, price: 6000 },
  { credits: 3000, price: 13000 },
];

/** Retrouve un pack par ses crédits internes (valeur validée, non falsifiable). */
export function findPack(creditsInternal: number) {
  return CREDIT_PACKS.find((p) => p.credits === creditsInternal) ?? null;
}
