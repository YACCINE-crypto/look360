import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWebPush, type PushPayload, type StoredSubscription } from "@/lib/webpush";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Date de planning la plus proche (à travailler / lancement test), échéant
 *  au plus tard dans 2 jours (inclut le retard). */
function echeanceDue(
  p: { date_a_travailler: string | null; date_lancement_testing: string | null },
  limite: string,
): string | null {
  const dates = [p.date_a_travailler, p.date_lancement_testing].filter(
    (d): d is string => !!d && d <= limite,
  );
  if (dates.length === 0) return null;
  return dates.sort()[0];
}

export async function GET(request: Request) {
  // Sécurité : Vercel Cron envoie "Authorization: Bearer $CRON_SECRET".
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const supabase = createAdminClient();
  const today = new Date();
  const limite = iso(new Date(today.getTime() + 2 * 86_400_000)); // aujourd'hui + 2j

  const { data: produits, error } = await supabase
    .from("produits")
    .select("id, nom, soumis_par, date_a_travailler, date_lancement_testing, statut")
    .eq("notif_envoyee", false)
    .not("soumis_par", "is", null)
    .not("statut", "in", "(valide,production,abandonne)");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Un seul produit à traiter par utilisateur : le prochain dû (échéance la + proche).
  const parUser = new Map<string, { id: string; nom: string | null; due: string }>();
  for (const p of produits ?? []) {
    const due = echeanceDue(p, limite);
    if (!due || !p.soumis_par) continue;
    const cur = parUser.get(p.soumis_par);
    if (!cur || due < cur.due) {
      parUser.set(p.soumis_par, { id: p.id, nom: p.nom, due });
    }
  }

  if (parUser.size === 0) {
    return NextResponse.json({ ok: true, envoyees: 0, note: "rien à rappeler" });
  }

  const webpush = getWebPush();
  let envoyees = 0;

  for (const [userId, prod] of parUser) {
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, keys")
      .eq("user_id", userId);

    if (!subs || subs.length === 0) continue;

    const payload: PushPayload = {
      title: "Un produit à traiter aujourd'hui",
      body: prod.nom ? `${prod.nom} — c'est le moment de t'en occuper.` : "Un produit t'attend.",
      url: "/recherche",
      tag: "look360-rappel",
    };

    let delivered = false;
    for (const s of subs) {
      const subscription = {
        endpoint: s.endpoint,
        keys: s.keys,
      } as unknown as StoredSubscription;
      try {
        await webpush.sendNotification(
          subscription as never,
          JSON.stringify(payload),
        );
        delivered = true;
      } catch (e: unknown) {
        const code = (e as { statusCode?: number }).statusCode;
        // Abonnement expiré/invalide -> on le supprime.
        if (code === 404 || code === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", s.id);
        }
      }
    }

    if (delivered) {
      await supabase
        .from("produits")
        .update({ notif_envoyee: true })
        .eq("id", prod.id);
      envoyees++;
    }
  }

  return NextResponse.json({ ok: true, envoyees });
}
