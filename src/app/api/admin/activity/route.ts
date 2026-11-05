import { NextResponse } from "next/server";
import { AdminGuardError, requireSuperadmin } from "@/lib/adminGuard";

export const dynamic = "force-dynamic";

/** Flux d'activité du cockpit : superadmin vérifié côté serveur, RPC à la session de l'utilisateur. */
export async function GET() {
  try {
    const supabase = await requireSuperadmin();
    const { data, error } = await supabase.rpc("admin_activity");
    if (error) return NextResponse.json({ error: "rpc" }, { status: 500 });
    return NextResponse.json({ events: Array.isArray(data) ? data : [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const status = e instanceof AdminGuardError ? e.status : 500;
    return NextResponse.json({ error: status === 401 ? "unauthenticated" : "forbidden" }, { status });
  }
}
