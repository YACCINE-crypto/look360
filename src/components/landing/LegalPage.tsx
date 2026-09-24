import type { ReactNode } from "react";

/** Gabarit commun des pages légales (contenu à fournir par Yaccine). */
export function LegalPage({
  title,
  intro,
  sections,
}: {
  title: string;
  intro: string;
  sections: string[];
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-foreground text-3xl font-extrabold tracking-tight">
        {title}
      </h1>
      <p className="text-muted-foreground mt-3 text-sm">
        Dernière mise à jour : [date à fournir]
      </p>
      <p className="text-muted-foreground mt-6">{intro}</p>

      <div className="mt-8 space-y-6">
        {sections.map((s, i) => (
          <section
            key={i}
            className="border-border bg-surface rounded-xl border p-5"
          >
            <h2 className="text-foreground text-base font-semibold">{s}</h2>
            <PlaceholderBlock />
          </section>
        ))}
      </div>

      <p className="text-muted-foreground mt-10 text-xs">
        Ce document est un gabarit. Le contenu juridique définitif doit être
        rédigé/validé avant la mise en production.
      </p>
    </div>
  );
}

function PlaceholderBlock(): ReactNode {
  return (
    <p className="text-muted-foreground mt-2 text-sm italic">
      [Contenu à fournir]
    </p>
  );
}
