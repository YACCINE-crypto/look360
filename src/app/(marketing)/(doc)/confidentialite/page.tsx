import type { Metadata } from "next";
import { LegalDoc } from "@/components/legal/LegalDoc";
import { CONFIDENTIALITE } from "@/content/legal/confidentialite";

export const metadata: Metadata = {
  title: "Politique de confidentialité · Look360",
  description:
    "Comment Look360 collecte, utilise, conserve et protège tes données : compte, recherches, testing, paiements, cookies, durée de conservation et tes droits.",
  alternates: { canonical: "https://look360.io/confidentialite" },
};

export default function ConfidentialitePage() {
  return <LegalDoc raw={CONFIDENTIALITE} title="Politique de confidentialité" />;
}
