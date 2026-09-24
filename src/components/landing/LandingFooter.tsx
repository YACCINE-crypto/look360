import Link from "next/link";

/* eslint-disable @next/next/no-img-element */

// Contacts officiels Look360.
const WHATSAPP_URL = "https://wa.me/2250502952588";
const SUPPORT_EMAIL = "look360app@gmail.com";

const COLS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Produit",
    links: [
      { label: "Fonctions", href: "/#fonctions" },
      { label: "Tarifs", href: "/#tarifs" },
      { label: "Vitrine", href: "/#vitrine" },
    ],
  },
  {
    title: "Ressources",
    links: [
      { label: "FAQ", href: "/#faq" },
      { label: "Support", href: `mailto:${SUPPORT_EMAIL}` },
    ],
  },
  {
    title: "Légal",
    links: [
      { label: "CGU", href: "/cgu" },
      { label: "Confidentialité", href: "/confidentialite" },
      { label: "Remboursement", href: "/remboursement" },
    ],
  },
];

/** Pied de page de la landing (texte STEP 10) + bouton WhatsApp flottant. */
export function LandingFooter() {
  return (
    <>
      <footer className="border-border bg-surface border-t">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
            {/* Marque + slogan */}
            <div>
              <img
                src="/look360-logo.svg"
                alt="Look360"
                className="h-10 w-auto"
              />
              <p className="text-foreground mt-3 text-sm font-semibold">
                Trouve. Teste. Valide.
              </p>
              <p className="text-muted-foreground mt-3 max-w-xs text-sm">
                Pensé en Afrique, pour les dropshippers africains.
              </p>
            </div>

            {/* Colonnes de liens */}
            {COLS.map((col) => (
              <div key={col.title}>
                <p className="text-foreground text-sm font-semibold">
                  {col.title}
                </p>
                <ul className="mt-3 space-y-2">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      {l.href.startsWith("/") && !l.href.startsWith("/#") ? (
                        <Link
                          href={l.href}
                          className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                        >
                          {l.label}
                        </Link>
                      ) : (
                        <a
                          href={l.href}
                          className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                        >
                          {l.label}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Bas de footer */}
          <div className="border-border mt-10 flex flex-col items-start justify-between gap-3 border-t pt-6 sm:flex-row sm:items-center">
            <p className="text-muted-foreground text-xs">
              © {new Date().getFullYear()} Look360. Tous droits réservés.
            </p>
            <div className="flex items-center gap-4">
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-muted-foreground hover:text-foreground text-xs transition-colors"
              >
                {SUPPORT_EMAIL}
              </a>
              <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                <span className="relative flex h-2 w-2">
                  <span className="bg-success absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" />
                  <span className="bg-success relative inline-flex h-2 w-2 rounded-full" />
                </span>
                Système opérationnel
              </span>
            </div>
          </div>
        </div>
      </footer>

      {/* Bouton WhatsApp flottant */}
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Nous contacter sur WhatsApp"
        className="fixed bottom-5 right-5 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-110 active:scale-95"
      >
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M17.5 14.4c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.53.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.22 3.08.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35zM12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.32l-.34-.2-3.57.94.95-3.48-.22-.36a9.44 9.44 0 0 1-1.44-5.02c0-5.2 4.24-9.44 9.46-9.44 2.53 0 4.9.99 6.69 2.78a9.38 9.38 0 0 1 2.77 6.68c0 5.2-4.24 9.44-9.45 9.44zm8.04-17.48A11.36 11.36 0 0 0 12.05.5C5.8.5.72 5.58.72 11.82c0 2 .52 3.95 1.52 5.68L.62 23.5l6.14-1.61a11.3 11.3 0 0 0 5.29 1.35h.01c6.24 0 11.32-5.08 11.33-11.32a11.26 11.26 0 0 0-3.3-7.99z" />
        </svg>
      </a>
    </>
  );
}
