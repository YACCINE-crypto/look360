import { PaymentProvider } from "./payments.ts";
import { GeniusPayProvider } from "./geniuspay.ts";
import { SasPayProvider } from "./saspay.ts";

// Sélection du prestataire de paiement ACTIF via PAYMENT_PROVIDER
// (« saspay » | « geniuspay »). GeniusPay reste en dormance, rien n'est
// supprimé : repasser PAYMENT_PROVIDER=geniuspay suffit à le réactiver.
export function getProvider(
  name: string = Deno.env.get("PAYMENT_PROVIDER") ?? "geniuspay",
): PaymentProvider {
  switch (name) {
    case "saspay":
      return new SasPayProvider();
    case "geniuspay":
      return new GeniusPayProvider();
    default:
      throw new Error(`unknown_provider:${name}`);
  }
}
