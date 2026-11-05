import { NextResponse } from "next/server";
import { dispatchWhatsApp } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Vide la file d'alertes WhatsApp par PETIT LOT. Planifié plusieurs fois par
 * jour, espacé (~45 min, voir vercel.json) : envois étalés, jamais en rafale.
 * Vercel Cron : `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const res = await dispatchWhatsApp({ budgetMs: 240_000 });
  return NextResponse.json({ ok: true, ...res });
}
