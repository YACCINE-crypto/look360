"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizePhone, ONBOARDING_MARKETS, ONBOARDING_NICHES } from "@/lib/onboarding/options";

type Result = { ok: true } | { ok: false; error: string };

type ProfilePatch = {
  onboarding_done_at?: string;
  pref_niches?: string[];
  pref_markets?: string[];
  whatsapp_number?: string | null;
  whatsapp_optin?: boolean;
  whatsapp_optin_at?: string | null;
};

/** Mise à jour de SA propre ligne de profil (session de l'utilisateur, RLS). */
async function updateMe(patch: ProfilePatch): Promise<Result> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub as string | undefined;
  if (!uid) return { ok: false, error: "Session expirée. Reconnecte-toi." };
  const { error } = await (supabase as unknown as {
    from: (t: string) => { update: (v: ProfilePatch) => { eq: (k: string, v: string) => Promise<{ error: { message: string } | null }> } };
  })
    .from("profiles")
    .update(patch)
    .eq("id", uid);
  if (error) {
    console.error("[onboarding] update KO", error.message);
    return { ok: false, error: "Enregistrement impossible pour le moment. Réessaie." };
  }
  return { ok: true };
}

/** Valide le numéro + consentement (jamais de consentement sans numéro). */
function whatsappPatch(rawNumber: string, optin: boolean): ProfilePatch | { error: string } {
  const raw = rawNumber.trim();
  if (!raw) {
    if (optin) return { error: "Ajoute ton numéro WhatsApp pour recevoir les alertes." };
    return { whatsapp_number: null, whatsapp_optin: false, whatsapp_optin_at: null };
  }
  const number = normalizePhone(raw);
  if (!number) return { error: "Numéro invalide : écris-le avec l'indicatif, ex. +225 07 00 00 00 00." };
  return {
    whatsapp_number: number,
    whatsapp_optin: optin,
    whatsapp_optin_at: optin ? new Date().toISOString() : null,
  };
}

/**
 * Fin de l'onboarding (terminé OU passé) : enregistre les choix faits et marque
 * l'onboarding comme vu → il ne réapparaît plus.
 */
export async function finishOnboarding(input: {
  niches?: string[];
  markets?: string[];
  whatsapp?: string;
  optin?: boolean;
}): Promise<Result> {
  const patch: ProfilePatch = { onboarding_done_at: new Date().toISOString() };
  if (input.niches) patch.pref_niches = input.niches.filter((n) => ONBOARDING_NICHES.includes(n)).slice(0, 12);
  if (input.markets) {
    const codes = new Set(ONBOARDING_MARKETS.map((m) => m.code));
    patch.pref_markets = input.markets.filter((c) => codes.has(c)).slice(0, 20);
  }
  if (input.whatsapp !== undefined || input.optin) {
    const w = whatsappPatch(input.whatsapp ?? "", Boolean(input.optin));
    if ("error" in w) return { ok: false, error: w.error as string };
    Object.assign(patch, w);
  }
  const res = await updateMe(patch);
  if (res.ok) revalidatePath("/", "layout");
  return res;
}

/** Paramètres : numéro WhatsApp + consentement (opt-in / opt-out). */
export async function saveWhatsapp(rawNumber: string, optin: boolean): Promise<Result> {
  const w = whatsappPatch(rawNumber, optin);
  if ("error" in w) return { ok: false, error: w.error as string };
  const res = await updateMe(w);
  if (res.ok) revalidatePath("/parametres");
  return res;
}

/** Paramètres : niches et marchés du feed. */
export async function savePreferences(niches: string[], markets: string[]): Promise<Result> {
  const codes = new Set(ONBOARDING_MARKETS.map((m) => m.code));
  const res = await updateMe({
    pref_niches: niches.filter((n) => ONBOARDING_NICHES.includes(n)).slice(0, 12),
    pref_markets: markets.filter((c) => codes.has(c)).slice(0, 20),
  });
  if (res.ok) revalidatePath("/parametres");
  return res;
}
