import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { CODE_RE, REF_COOKIE, REF_MAX_AGE, signRef, VISITOR_COOKIE } from "@/lib/referral";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Clic sur un lien de parrainage (look360.io/?ref=CODE). Pose le cookie signé
 * d'attribution (dernier clic gagnant, 30 j) et compte le clic (1 par
 * visiteur et par jour). Code inconnu → rien n'est posé.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { code?: unknown };
  const code = String(body.code ?? "").trim().toUpperCase();
  if (!CODE_RE.test(code)) return NextResponse.json({ ok: false }, { status: 400 });

  const cookieHeader = request.headers.get("cookie") ?? "";
  const existingVid = /(?:^|;\s*)l360_vid=([A-Za-z0-9_-]{8,64})/.exec(cookieHeader)?.[1];
  const visitor = existingVid ?? randomBytes(12).toString("base64url");

  const admin = createAdminClient() as unknown as {
    rpc: (f: string, p: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
  };
  const { data: known } = await admin.rpc("referral_log_click", { p_code: code, p_visitor: visitor });
  if (known !== true) return NextResponse.json({ ok: false }, { status: 404 });

  const signed = signRef(code, Date.now());
  const res = NextResponse.json({ ok: true });
  const base = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" };
  if (signed) res.cookies.set(REF_COOKIE, signed, { ...base, maxAge: REF_MAX_AGE });
  if (!existingVid) res.cookies.set(VISITOR_COOKIE, visitor, { ...base, maxAge: 365 * 24 * 3600 });
  return res;
}
