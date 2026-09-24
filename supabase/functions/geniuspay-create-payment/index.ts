// ===========================================================================
// Edge Function : geniuspay-create-payment
// Crée une intention de paiement et renvoie l'URL de checkout.
//   body : { purpose: 'subscription', plan: 'starter'|'pro'|'business',
//            country?: 'CI' }
//        | { purpose: 'credit_pack', packCredits: 500|1200|3000, country?: 'CI' }
//
// Le MONTANT est calculé CÔTÉ SERVEUR (jamais fourni par le client) :
//   • subscription → tarif de bienvenue si has_ever_paid=false, sinon normal.
//   • credit_pack  → prix du pack correspondant.
// L'appelant est identifié par son JWT (verify_jwt=true). org_id = user_id.
// ===========================================================================

import { json, preflight } from "../_shared/http.ts";
import { adminClient, userClientFrom } from "../_shared/supabase.ts";
import { getProvider } from "../_shared/provider.ts";
import {
  findPack,
  isPaidPlan,
  subscriptionPrice,
} from "../_shared/plans.ts";

function siteUrl(req: Request): string {
  const env = Deno.env.get("SITE_URL");
  if (env) return env.replace(/\/+$/, "");
  const origin = req.headers.get("origin");
  if (origin) return origin.replace(/\/+$/, "");
  return "https://look360.io";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // 1) Authentifier l'appelant.
  const { data: userData, error: userErr } = await userClientFrom(req).auth
    .getUser();
  const user = userData?.user;
  if (userErr || !user) return json({ error: "unauthorized" }, 401);

  // 2) Lire et valider le corps.
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const purpose = body.purpose;
  const country = typeof body.country === "string" &&
      /^[A-Za-z]{2}$/.test(body.country)
    ? body.country.toUpperCase()
    : undefined;

  const admin = adminClient();

  // 3) Déterminer montant + crédits (SOURCE DE VÉRITÉ SERVEUR).
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
    const hasEverPaid = Boolean(sub?.has_ever_paid);
    amount = subscriptionPrice(body.plan, hasEverPaid);
    plan = body.plan;
    description = `Abonnement ${body.plan}`;
  } else if (purpose === "credit_pack") {
    const pc = Number(body.packCredits);
    const pack = findPack(pc);
    if (!pack) return json({ error: "invalid_pack" }, 400);
    amount = pack.price;
    credits = pack.credits;
    description = "Recharge de crédits";
  } else {
    return json({ error: "invalid_purpose" }, 400);
  }

  // 4) Coordonnées client (email = auth.users ; nom = profiles.nom).
  const { data: profile } = await admin
    .from("profiles")
    .select("nom")
    .eq("id", user.id)
    .maybeSingle();

  // 5) Référence marchande unique = clé d'idempotence.
  const reference = `l360_${purpose === "subscription" ? "sub" : "pack"}_${
    crypto.randomUUID()
  }`;

  // 6) Enregistrer le paiement en 'pending' AVANT d'appeler le prestataire.
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
  if (insErr) return json({ error: "db_error" }, 500);

  // 7) Créer le paiement chez le prestataire.
  const provider = getProvider();
  try {
    const result = await provider.createPayment({
      amount,
      currency: "XOF",
      description,
      reference,
      returnUrl: `${siteUrl(req)}/offres?pay=return&ref=${reference}`,
      callbackUrl: `${Deno.env.get("SUPABASE_URL")}/functions/v1/geniuspay-webhook`,
      purpose,
      metadata: { org_id: user.id, plan, credits, purpose },
      customer: {
        id: user.id,
        email: user.email ?? undefined,
        name: (profile?.nom as string | undefined) ?? undefined,
        country,
      },
    });

    await admin
      .from("payments")
      .update({ provider_txn: result.providerRef, updated_at: new Date().toISOString() })
      .eq("provider", "geniuspay")
      .eq("provider_ref", reference);

    return json({ checkoutUrl: result.checkoutUrl, reference });
  } catch (_e) {
    await admin
      .from("payments")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("provider", "geniuspay")
      .eq("provider_ref", reference);
    // Message générique — aucun nom de prestataire exposé au client.
    return json({ error: "payment_init_failed" }, 502);
  }
});
