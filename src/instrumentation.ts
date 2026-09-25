// ============================================================================
// Monitoring serveur (Node + Edge) — Sentry.
// Convention Next 16 : `register()` est appelé une fois au démarrage de chaque
// instance serveur ; `onRequestError` remonte les erreurs serveur.
//
// AUCUN secret ici : le DSN vient d'une variable d'environnement définie dans
// Vercel (SENTRY_DSN). Tant qu'elle est absente, le monitoring reste DÉSACTIVÉ
// (Sentry.init n'est pas appelé) — zéro impact en local / avant configuration.
// ============================================================================
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

export function register(): void {
  if (!dsn) return; // Monitoring off tant que le DSN n'est pas fourni.

  Sentry.init({
    dsn,
    // Environnement (production / preview / development) pour trier les erreurs.
    environment:
      process.env.NEXT_PUBLIC_APP_ENV ?? process.env.VERCEL_ENV ?? "development",
    // Échantillonnage des traces de performance (10 %) — ajustable.
    tracesSampleRate: 0.1,
  });
}

// Remonte automatiquement les erreurs des Server Components, Route Handlers,
// Server Actions et du rendu serveur. No-op si Sentry n'est pas initialisé.
export const onRequestError = Sentry.captureRequestError;
