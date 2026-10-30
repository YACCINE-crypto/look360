// ===========================================================================
// Edge Function : saspay-selftest   (verify_jwt = true)
// Valide la configuration SasPay sans rien encaisser :
//   GET /countries/        (public)
//   GET /pricing/my-rates/ (authentifié → prouve que SASPAY_API_KEY marche)
// Ne renvoie AUCUN secret : statuts HTTP, type de clé (live/test), pays et
// réseaux disponibles.
// ===========================================================================

import { json, preflight } from "../_shared/http.ts";
import { feeMode, saspayError, saspayFetch } from "../_shared/saspay.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const key = Deno.env.get("SASPAY_API_KEY") ?? "";
  const keyMode = key.startsWith("sk_live_") ? "live" : key.startsWith("sk_test_") ? "test" : key ? "unknown" : "missing";

  const countries = await saspayFetch("/countries/", { auth: false });
  let rates = { status: 0, body: {} as Record<string, unknown> };
  if (key) rates = await saspayFetch("/pricing/my-rates/");

  const list = (b: Record<string, unknown>): unknown[] => {
    const d = b.data ?? b.results ?? b;
    return Array.isArray(d) ? d : Array.isArray((d as Record<string, unknown>)?.results) ? (d as { results: unknown[] }).results : [];
  };
  const pick = (o: unknown, keys: string[]) =>
    Object.fromEntries(keys.filter((k) => o && typeof o === "object" && k in (o as object)).map((k) => [k, (o as Record<string, unknown>)[k]]));

  return json({
    keyMode,
    feeMode: feeMode(),
    webhookSecret: Boolean(Deno.env.get("SASPAY_WEBHOOK_SECRET")),
    paymentProvider: Deno.env.get("PAYMENT_PROVIDER") ?? "(non défini → geniuspay)",
    countries: {
      status: countries.status,
      items: list(countries.body).slice(0, 40).map((c) => pick(c, ["code", "name", "currency"])),
      error: countries.status === 200 ? undefined : saspayError(countries),
    },
    myRates: {
      status: rates.status,
      ok: rates.status === 200,
      items: list(rates.body).slice(0, 60).map((r) =>
        pick(r, ["country", "network", "currency", "method", "otp_required", "fee_percent", "fee_fixed"])
      ),
      error: rates.status === 200 ? undefined : saspayError(rates),
    },
  });
});
