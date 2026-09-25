"use client";

// ============================================================================
// Boundary d'erreur globale (racine). Capture les erreurs de rendu React côté
// client et les remonte à Sentry (no-op si le monitoring n'est pas configuré).
// Remplace tout le layout : on doit rendre <html> et <body>.
// ============================================================================
import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="fr">
      <body className="bg-background flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-foreground text-xl font-bold">Une erreur est survenue</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Un problème inattendu s&apos;est produit. Notre équipe a été notifiée.
            Réessaie dans un instant.
          </p>
          <button
            onClick={() => reset()}
            className="bg-primary text-primary-foreground mt-5 inline-flex min-h-[46px] items-center justify-center rounded-full px-6 text-sm font-semibold"
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
