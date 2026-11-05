import { NuitNav } from "@/components/landing/nuit/NuitNav";
import { Footer } from "@/components/landing/nuit/Sections";
import "../nuit.css";

/**
 * Coquille des pages légales au thème « Nuit » de la landing (conditions,
 * confidentialité) : même nav et même pied de page, contenu en colonne de lecture.
 */
export default function DocLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="nuit">
      <NuitNav anchorBase="/" />
      <main className="layer">{children}</main>
      <Footer anchorBase="/" />
    </div>
  );
}
