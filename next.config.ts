import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

// En-têtes de sécurité (audit 2026-11-04, contrôle 18). HSTS est déjà posé par Vercel.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" }, // pas d'intégration en iframe (clickjacking)
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
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
