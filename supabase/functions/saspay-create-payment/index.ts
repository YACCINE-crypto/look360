// ===========================================================================
// Edge Function : saspay-create-payment   (verify_jwt = true)
// Crée un checkout hébergé chez le prestataire ACTIF (PAYMENT_PROVIDER, SasPay
// par défaut ici) et renvoie l'URL de paiement.
//   body : { purpose: 'subscription', plan, country? }
//        | { purpose: 'credit_pack', packCredits, country? }
//
// Le MONTANT est calculé côté serveur (plans.ts), jamais fourni par le client.
// Test en LIVE : SASPAY_TEST_AMOUNT (ex. 100) remplace le montant, mais
// UNIQUEMENT pour un superadmin non suspendu — jamais pour un client.
// ===========================================================================

import { json, preflight } from "../_shared/http.ts";
import { adminClient, userClientFrom } from "../_shared/supabase.ts";
import { getProvider } from "../_shared/provider.ts";
import { findPack, isPaidPlan, subscriptionPrice } from "../_shared/plans.ts";

function siteUrl(): string {
  return (Deno.env.get("SITE_URL") ?? "https://look360.io").replace(/\/+$/, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const { data: userData, error: userErr } = await userClientFrom(req).auth.getUser();
  const user = userData?.user;
  if (userErr || !user) return json({ error: "unauthorized" }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const purpose = body.purpose;
  const country =
    typeof body.country === "string" && /^[A-Za-z]{2}$/.test(body.country) ? body.country.toUpperCase() : undefined;

  const admin = adminClient();
  const { data: profile } = await admin.from("profiles").select("nom, role, suspended").eq("id", user.id).maybeSingle();
  if (profile?.suspended) return json({ error: "account_suspended" }, 403);

  // Montant + crédits — SOURCE DE VÉRITÉ SERVEUR.
  let amount: number;
  let plan: string | null = null;
  let credits: number | null = null;
  let description: string;
  if (purpose === "subscription") {
    if (!isPaidPlan(body.plan)) return json({ error: "invalid_plan" }, 400);
    const { data: sub } = await admin.from("subscriptions").select("has_ever_paid").eq("user_id", user.id).maybeSingle();
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

  // Montant de test (LIVE, petit montant) : superadmin uniquement.
  const testAmount = Number(Deno.env.get("SASPAY_TEST_AMOUNT") ?? "");
  const isTest = profile?.role === "superadmin" && Number.isInteger(testAmount) && testAmount > 0;
  if (isTest) amount = testAmount;

  const provider = getProvider();
  const intent = crypto.randomUUID();
  const metadata = { org_id: user.id, plan, purpose, credits, payment_intent: intent, test: isTest };

  let checkoutUrl: string;
  let reference: string;
  try {
    const result = await provider.createPayment({
      amount,
      currency: "XOF",
      description,
      purpose,
      metadata,
      customer: {
        id: user.id,
        email: user.email ?? undefined,
        name: (profile?.nom as string | null) ?? undefined,
        country,
      },
      returnUrl: `${siteUrl()}/offres?pay=return`,
    });
    checkoutUrl = result.checkoutUrl;
    reference = result.providerRef;
  } catch (e) {
    console.error("create-payment failed:", e instanceof Error ? e.message : String(e));
    return json({ error: "payment_init_failed" }, 502);
  }

  // Enregistrement (clé d'idempotence = référence prestataire = id de session).
  const { error: insErr } = await admin.from("payments").insert({
    user_id: user.id,
    provider: provider.name,
    provider_ref: reference,
    purpose,
    plan,
    credits,
    amount,
    currency: "XOF",
    status: "pending",
    metadata,
  });
  if (insErr) {
    console.error("create-payment insert failed:", insErr.message);
    return json({ error: "db_error" }, 500);
  }

  return json({ checkoutUrl, reference });
});
