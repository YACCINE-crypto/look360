import { LandingNav } from "@/components/landing/LandingNav";
import { LandingFooter } from "@/components/landing/LandingFooter";

/**
 * Coquille des pages publiques (landing + pages légales) :
 * nav sticky en haut, pied de page en bas. La coquille de l'app connectée
 * reste séparée (groupe (app)).
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <LandingNav />
      <main className="flex-1">{children}</main>
      <LandingFooter />
    </div>
  );
}
