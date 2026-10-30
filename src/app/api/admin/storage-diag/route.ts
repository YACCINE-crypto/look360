import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { storageDiag } from "@/lib/mediaStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Test du stockage média (superadmin) : écriture + suppression d'un fichier. */
export async function POST() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub as string | undefined;
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data: p } = await admin.from("profiles").select("role, suspended").eq("id", uid).maybeSingle();
  if (p?.role !== "superadmin" || p.suspended) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return NextResponse.json(await storageDiag());
}
