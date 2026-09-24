import type { Metadata } from "next";
import { LegalPage } from "@/components/landing/LegalPage";

export const metadata: Metadata = {
  title: "Conditions générales d'utilisation — Look360",
};

export default function CGUPage() {
  return (
    <LegalPage
      title="Conditions générales d'utilisation"
      intro="Les présentes conditions encadrent l'accès et l'utilisation de Look360."
      sections={[
        "1. Objet et acceptation",
        "2. Compte et éligibilité",
        "3. Offres, crédits et paiement",
        "4. Utilisation autorisée",
        "5. Propriété intellectuelle",
        "6. Responsabilité",
        "7. Résiliation",
        "8. Droit applicable",
      ]}
    />
  );
}
