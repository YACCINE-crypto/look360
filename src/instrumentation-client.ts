// ============================================================================
// Monitoring client (navigateur) — Sentry.
// S'exécute après le chargement du HTML et AVANT l'hydratation React, ce qui
// permet de capturer les erreurs dès le début du cycle de vie.
//
// Le DSN public (NEXT_PUBLIC_SENTRY_DSN) est destiné au navigateur : ce n'est
// pas un secret. Tant qu'il est absent, le monitoring client reste DÉSACTIVÉ.
// ============================================================================
import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "@/lib/sentryScrub";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_APP_ENV ?? "development",
    tracesSampleRate: 0.1,
    // Pas de Session Replay par défaut (perf + vie privée).
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    // Jamais d'IP, cookies ni en-têtes d'authentification ; filtre des secrets
    // et données personnelles sur chaque événement (lib/sentryScrub).
    dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
    beforeSend: scrubEvent,
  });
}

// Traces des navigations de l'App Router. No-op si Sentry n'est pas initialisé.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
