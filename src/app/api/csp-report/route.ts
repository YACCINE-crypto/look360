import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { allow, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Réception des rapports CSP (en-tête Content-Security-Policy-Report-Only).
 * Accepte les deux formats navigateur :
 *  - ancien `report-uri` : application/csp-report → { "csp-report": {...} }
 *  - Reporting API `report-to` : application/reports+json → [{ type, body }]
 * Agrège en base (csp_reports : directive × source × page, compteur) et envoie
 * un avertissement à Sentry (si configuré). Ne renvoie jamais d'erreur au
 * navigateur. Aucune donnée personnelle : la page est réduite à son chemin.
 */

type Violation = { directive: string; blocked: string; page: string; sample: Record<string, unknown> };

const MAX_BODY = 64 * 1024;

/** Réduit une URL à origine + chemin (pas de query : jetons, e-mails…). */
function strip(u: unknown): string {
  const s = typeof u === "string" ? u : "";
  if (!s) return "(vide)";
  if (!/^https?:|^wss?:/i.test(s)) return s.slice(0, 60); // inline, eval, data, blob…
  try {
    const x = new URL(s);
    return `${x.origin}${x.pathname}`.slice(0, 300);
  } catch {
    return s.slice(0, 60);
  }
}
const pathOf = (u: unknown) => {
  try {
    return new URL(String(u)).pathname.replace(/\/[0-9a-f-]{16,}|\/\d{5,}/gi, "/:id").slice(0, 200);
  } catch {
    return "(inconnue)";
  }
};

function normalize(body: unknown): Violation[] {
  const out: Violation[] = [];
  const push = (r: Record<string, unknown>) => {
    const directive = String(r["effective-directive"] ?? r.effectiveDirective ?? r["violated-directive"] ?? r.violatedDirective ?? "?")
      .split(" ")[0];
    const blocked = strip(r["blocked-uri"] ?? r.blockedURL ?? r.blockedUri);
    const page = pathOf(r["document-uri"] ?? r.documentURL ?? r.documentUri);
    out.push({
      directive,
      blocked,
      page,
      sample: {
        disposition: r.disposition ?? null,
        source: strip(r["source-file"] ?? r.sourceFile),
        line: r["line-number"] ?? r.lineNumber ?? null,
        sample: typeof r["script-sample"] === "string" ? String(r["script-sample"]).slice(0, 80) : typeof r.sample === "string" ? String(r.sample).slice(0, 80) : null,
      },
    });
  };
  if (Array.isArray(body)) {
    for (const item of body.slice(0, 20)) {
      const b = (item as { type?: string; body?: Record<string, unknown> }) ?? {};
      if (b.type === "csp-violation" && b.body) push(b.body);
    }
  } else if (body && typeof body === "object" && "csp-report" in body) {
    push((body as { "csp-report": Record<string, unknown> })["csp-report"]);
  }
  return out;
}

export async function POST(request: Request) {
  try {
    // Route publique : on borne le volume par IP (rapports en rafale ou abus).
    if (!(await allow([{ key: `csp:ip:${await clientIp()}`, windowSec: 60, max: 60 }]))) {
      return new NextResponse(null, { status: 204 });
    }
    const text = await request.text();
    if (text.length > MAX_BODY) return new NextResponse(null, { status: 204 });
    const list = normalize(JSON.parse(text));
    if (list.length) {
      const admin = createAdminClient();
      await Promise.all(
        list.map((v) =>
          admin.rpc("csp_report_hit", { p_directive: v.directive, p_blocked: v.blocked, p_page: v.page, p_sample: v.sample }),
        ),
      );
      for (const v of list) {
        console.warn(`[csp-report-only] ${v.directive} ← ${v.blocked} (page ${v.page})`);
        Sentry.captureMessage(`CSP (observation) ${v.directive} ← ${v.blocked}`, {
          level: "warning",
          tags: { csp_directive: v.directive },
          extra: { page: v.page, ...v.sample },
        });
      }
    }
  } catch {
    /* rapport illisible : ignoré */
  }
  return new NextResponse(null, { status: 204 });
}
