import { PaymentProvider } from "./payments.ts";
import { GeniusPayProvider } from "./geniuspay.ts";

// Sélection du prestataire de paiement. Ajouter Flutterwave/Paystack ici plus
// tard sans toucher aux Edge Functions (elles ne parlent qu'à PaymentProvider).
export function getProvider(
  name: string = Deno.env.get("PAYMENT_PROVIDER") ?? "geniuspay",
): PaymentProvider {
  switch (name) {
    case "geniuspay":
      return new GeniusPayProvider();
    default:
      throw new Error(`unknown_provider:${name}`);
  }
}
