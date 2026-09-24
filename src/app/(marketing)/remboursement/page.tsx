import type { Metadata } from "next";
import { LegalPage } from "@/components/landing/LegalPage";

export const metadata: Metadata = {
  title: "Politique de remboursement — Look360",
};

export default function RemboursementPage() {
  return (
    <LegalPage
      title="Politique de remboursement"
      intro="Conditions de remboursement des abonnements et des recharges de crédits Look360."
      sections={[
        "1. Abonnements mensuels",
        "2. Recharges de crédits",
        "3. Crédits déjà consommés",
        "4. Délais et modalités",
        "5. Comment faire une demande",
      ]}
    />
  );
}
