import type { ErrorEvent, EventHint } from "@sentry/nextjs";

// Filtre appliqué à chaque événement AVANT envoi à Sentry (navigateur + serveur) :
// retire les secrets et les données personnelles que les erreurs peuvent porter.

const SECRET_PATTERNS: RegExp[] = [
  /sk_(live|test)_[A-Za-z0-9]+/g, // SasPay / Stripe-like
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g, // JWT (sessions, clés Supabase)
  /sb_(secret|publishable)_[A-Za-z0-9_-]+/g, // nouvelles clés Supabase
  /apify_api_[A-Za-z0-9]+/g,
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, // e-mails
  /(\+?\d[\d .-]{8,}\d)/g, // numéros de téléphone
];
const SENSITIVE_KEYS = /authorization|cookie|password|passwd|secret|token|api[-_]?key|access[-_]?key|session|email|phone|signature/i;

function scrubString(s: string): string {
  let out = s;
  for (const re of SECRET_PATTERNS) out = out.replace(re, "[filtré]");
  return out;
}

function scrubDeep(v: unknown, depth = 0): unknown {
  if (depth > 6 || v == null) return v;
  if (typeof v === "string") return scrubString(v);
  if (Array.isArray(v)) return v.map((x) => scrubDeep(x, depth + 1));
  if (typeof v === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      o[k] = SENSITIVE_KEYS.test(k) ? "[filtré]" : scrubDeep(val, depth + 1);
    }
    return o;
  }
  return v;
}

/** URL sans query string (jetons de récupération, e-mails, recherches). */
function stripQuery(u: string | undefined): string | undefined {
  if (!u) return u;
  const i = u.indexOf("?");
  return i === -1 ? u : `${u.slice(0, i)}?[filtré]`;
}

export function scrubEvent(event: ErrorEvent, _hint?: EventHint): ErrorEvent {
  void _hint;
  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
    if (event.request.headers) event.request.headers = scrubDeep(event.request.headers) as Record<string, string>;
    event.request.url = stripQuery(event.request.url);
    event.request.query_string = undefined;
  }
  if (event.user) event.user = event.user.id ? { id: event.user.id } : undefined; // jamais e-mail / IP
  if (event.message) event.message = scrubString(event.message);
  for (const ex of event.exception?.values ?? []) {
    if (ex.value) ex.value = scrubString(ex.value);
  }
  if (event.extra) event.extra = scrubDeep(event.extra) as Record<string, unknown>;
  if (event.contexts) event.contexts = scrubDeep(event.contexts) as typeof event.contexts;
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((b) => ({
      ...b,
      message: b.message ? scrubString(b.message) : b.message,
      data: b.data ? (scrubDeep(b.data) as typeof b.data) : b.data,
    }));
  }
  return event;
}
