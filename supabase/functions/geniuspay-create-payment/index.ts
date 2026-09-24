// ===========================================================================
// Edge Function : geniuspay-create-payment
// Crée une intention de paiement chez le prestataire et renvoie l'URL de checkout.
//   body : { purpose: 'subscription', plan, country? }
//        | { purpose: 'credit_pack', packCredits, country? }
//
// Flux (aligné sur le contrat prestataire) : on appelle D'ABORD le prestataire
// (qui génère la référence), PUIS on enregistre le paiement en base avec cette
// référence (clé d'idempotence pour le webhook). Le MONTANT est calculé côté
// serveur (jamais fourni par le client). org_id = user_id.
// ===========================================================================

import { json, preflight } from "../_shared/http.ts";
import { adminClient, userClientFrom } from "../_shared/supabase.ts";
import { getProvider } from "../_shared/provider.ts";
import { findPack, isPaidPlan, subscriptionPrice } from "../_shared/plans.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // 1) Authentifier l'appelant (aucune restriction de rôle : tout compte paie).
  const { data: userData, error: userErr } = await userClientFrom(req).auth.getUser();
  const user = userData?.user;
  if (userErr || !user) return json({ error: "unauthorized" }, 401);

  // 2) Corps + validation.
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const purpose = body.purpose;
  const country =
    typeof body.country === "string" && /^[A-Za-z]{2}$/.test(body.country)
      ? body.country.toUpperCase()
      : undefined;

  const admin = adminClient();

  // 3) Montant + crédits — SOURCE DE VÉRITÉ SERVEUR.
  let amount: number;
  let plan: string | null = null;
  let credits: number | null = null;
  let description: string;

  if (purpose === "subscription") {
    if (!isPaidPlan(body.plan)) return json({ error: "invalid_plan" }, 400);
    const { data: sub } = await admin
      .from("subscriptions")
      .select("has_ever_paid")
      .eq("user_id", user.id)
      .maybeSingle();
    amount = subscriptionPrice(body.plan, Boolean(sub?.has_ever_paid));
    plan = body.plan;
    description = `Look360 — abonnement ${body.plan}`;
  } else if (purpose === "credit_pack") {
    const pack = findPack(Number(body.packCredits));
    if (!pack) return json({ error: "invalid_pack" }, 400);
    amount = pack.price;
    credits = pack.credits;
    description = "Look360 — recharge de crédits";
  } else {
    return json({ error: "invalid_purpose" }, 400);
  }

  // 4) Créer le paiement chez le prestataire (il génère la référence).
  const provider = getProvider();
  let checkoutUrl: string;
  let reference: string;
  try {
    const result = await provider.createPayment({
      amount,
      currency: "XOF",
      description,
      purpose,
      metadata: { org_id: user.id, purpose, plan, credits },
      customer: { id: user.id, email: user.email ?? undefined, country },
    });
    checkoutUrl = result.checkoutUrl;
    reference = result.providerRef;
  } catch (e) {
    // Log l'erreur EXACTE (visible dans les logs de la fonction) — le client
    // ne voit qu'un message générique (aucun nom de prestataire exposé).
    console.error("create-payment failed:", e instanceof Error ? e.message : String(e));
    return json({ error: "payment_init_failed" }, 502);
  }

  // 5) Enregistrer le paiement (clé = référence prestataire) pour le webhook.
  const { error: insErr } = await admin.from("payments").insert({
    user_id: user.id,
    provider: "geniuspay",
    provider_ref: reference,
    purpose,
    plan,
    credits,
    amount,
    currency: "XOF",
    status: "pending",
    metadata: { org_id: user.id, purpose, plan, credits },
  });
  if (insErr) {
    console.error("create-payment insert failed:", insErr.message);
    return json({ error: "db_error" }, 500);
  }

  return json({ checkoutUrl, reference });
});
