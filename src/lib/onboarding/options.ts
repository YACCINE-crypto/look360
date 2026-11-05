// Choix proposés à l'onboarding et dans Paramètres (partagés client/serveur).
import { FEED_NICHES } from "@/lib/feed-niches";

export const ONBOARDING_NICHES: string[] = FEED_NICHES.map((n) => n.niche);

/** Marchés proposés : Afrique francophone d'abord, puis l'Europe francophone. */
export const ONBOARDING_MARKETS: { code: string; label: string }[] = [
  { code: "CI", label: "Côte d'Ivoire" },
  { code: "SN", label: "Sénégal" },
  { code: "CM", label: "Cameroun" },
  { code: "BJ", label: "Bénin" },
  { code: "TG", label: "Togo" },
  { code: "BF", label: "Burkina Faso" },
  { code: "ML", label: "Mali" },
  { code: "GN", label: "Guinée" },
  { code: "GA", label: "Gabon" },
  { code: "CD", label: "RD Congo" },
  { code: "CG", label: "Congo" },
  { code: "MA", label: "Maroc" },
  { code: "FR", label: "France" },
  { code: "BE", label: "Belgique" },
];

/** Communauté WhatsApp Look360 (lien d'invitation). */
export const WHATSAPP_COMMUNITY_URL = "https://chat.whatsapp.com/HXFLm4XHmL3AGFbGE4MAEK";

/** Normalise un numéro saisi (espaces, tirets, 00…) en +XXXXXXXX, ou null si invalide. */
export function normalizePhone(raw: string): string | null {
  let s = raw.replace(/[\s().-]/g, "");
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  if (!s.startsWith("+")) return null;
  return /^\+[1-9][0-9]{7,14}$/.test(s) ? s : null;
}
