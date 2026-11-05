import type { Metadata } from "next";
import { LegalDoc } from "@/components/legal/LegalDoc";
import { CONDITIONS } from "@/content/legal/conditions";

export const metadata: Metadata = {
  title: "Conditions générales d'utilisation · Look360",
  description:
    "Conditions d'utilisation de Look360 : compte, recherche de publicités, produits et boutiques, testing, abonnements et quotas, obligations, responsabilité et droit applicable.",
  alternates: { canonical: "https://look360.io/conditions" },
};

export default function ConditionsPage() {
  return <LegalDoc raw={CONDITIONS} title="Conditions générales d'utilisation" />;
}
