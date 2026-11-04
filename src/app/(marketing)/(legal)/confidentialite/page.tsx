import type { Metadata } from "next";
import { LegalPage } from "@/components/landing/LegalPage";

export const metadata: Metadata = {
  title: "Politique de confidentialité — Look360",
};

export default function ConfidentialitePage() {
  return (
    <LegalPage
      title="Politique de confidentialité"
      intro="Comment Look360 collecte, utilise et protège vos données. Chaque compte ne voit que ses propres données ; la vitrine communautaire est 100 % anonymisée."
      sections={[
        "1. Données collectées",
        "2. Finalités du traitement",
        "3. Base légale",
        "4. Partage et sous-traitants",
        "5. Anonymisation de la vitrine communautaire",
        "6. Durée de conservation",
        "7. Vos droits",
        "8. Contact",
      ]}
    />
  );
}
