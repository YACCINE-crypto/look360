import Link from "next/link";

/** Nav flottante de la landing — même modèle sur ordinateur et sur mobile. */
export const NAV_LINKS = [
  { href: "#etapes", label: "Comment ça marche" },
  { href: "#fonctions", label: "Fonctions" },
  { href: "#comparatif", label: "Comparatif" },
  { href: "#tarifs", label: "Tarifs" },
  { href: "#faq", label: "FAQ" },
];

/** `anchorBase="/"` hors landing (pages légales) : les ancres renvoient vers la landing. */
export function NuitNav({ anchorBase = "" }: { anchorBase?: string }) {
  return (
    <nav className="nav" aria-label="Navigation principale">
      <div className="nav-in">
        <Link href="/" className="nav-logo" aria-label="Look360 — accueil">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/look360-logo-light.svg" alt="Look360" width={126} height={34} />
        </Link>
        <div className="nav-links">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={`${anchorBase}${l.href}`}>
              {l.label}
            </a>
          ))}
        </div>
        <div className="nav-r">
          <Link className="btn" href="/login">
            Connexion
          </Link>
          <Link className="btn btn-primary" href="/login?tab=signup">
            <span className="lg">Commencer gratuitement</span>
            <span className="sm">Commencer</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
