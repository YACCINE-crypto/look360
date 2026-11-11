import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { readRef, REF_COOKIE } from "@/lib/referral";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Après inscription / connexion : rattache le compte au parrain du cookie.
 * Toutes les règles sont vérifiées en base (claim_referral, session de
 * l'utilisateur). Le cookie est supprimé quel que soit le résultat.
 */
export async function POST() {
  const jar = await cookies();
  const ref = readRef(jar.get(REF_COOKIE)?.value);
  const res = (status: string) => {
    const r = NextResponse.json({ status });
    r.cookies.set(REF_COOKIE, "", { path: "/", maxAge: 0 });
    return r;
  };
  if (!ref) return res("no_cookie");
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ status: "not_authenticated" }, { status: 401 });
  const { data, error } = await (supabase as unknown as {
    rpc: (f: string, p: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  }).rpc("claim_referral", { p_code: ref.code, p_clicked_at: ref.clickedAt.toISOString() });
  return res(error ? "error" : String(data));
}
