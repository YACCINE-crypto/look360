import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  /* config options here */
};

// Sentry : l'enrobage est inoffensif tant que les variables ne sont pas
// définies (aucun upload de source maps sans SENTRY_AUTH_TOKEN, monitoring
// runtime désactivé sans DSN). Tous les secrets restent en variables d'env.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Pas de bruit dans les logs de build hors CI.
  silent: !process.env.CI,
  // Élargit l'upload des source maps côté client pour de meilleures stacktraces.
  widenClientFileUpload: true,
  // Pas de télémétrie Sentry au build.
  telemetry: false,
});
