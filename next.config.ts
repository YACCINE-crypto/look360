import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

// En-têtes de sécurité (audit 2026-11-04, contrôle 18). HSTS est déjà posé par Vercel.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" }, // pas d'intégration en iframe (clickjacking)
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Reporting-Endpoints", value: 'csp="/api/csp-report"' },
];

// Content-Security-Policy en MODE OBSERVATION (Report-Only) : rien n'est bloqué,
// les violations sont envoyées à /api/csp-report pour affiner la liste avant de
// passer à l'en-tête bloquant. Sources ajoutées à la liste de départ (vues dans
// le code) : Shopify et Facebook pour les visuels, Bunny en connect-src (lecteur
// HLS), Sentry hors US (*.sentry.io), workers blob: (hls.js).
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://www.googletagmanager.com https://www.google-analytics.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://*.b-cdn.net https://*.supabase.co https://cdn.shopify.com https://*.fbcdn.net",
  "media-src 'self' blob: https://*.b-cdn.net https://*.fbcdn.net",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.ingest.sentry.io https://*.sentry.io https://www.google-analytics.com https://challenges.cloudflare.com https://*.b-cdn.net",
  "worker-src 'self' blob:",
  "frame-src https://challenges.cloudflare.com https://accounts.google.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
  "report-uri /api/csp-report",
  "report-to csp",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [...securityHeaders, { key: "Content-Security-Policy-Report-Only", value: csp }],
      },
    ];
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
