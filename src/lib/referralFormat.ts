/** Montants en francs CFA (affichage). */
export const fcfa = (n: number) => `${new Intl.NumberFormat("fr-FR").format(Math.round(n))} F`;

export const PAYOUT_METHODS = [
  { id: "wave", label: "Wave" },
  { id: "orange", label: "Orange Money" },
  { id: "mtn", label: "MTN MoMo" },
  { id: "moov", label: "Moov Money" },
] as const;
export type PayoutMethod = (typeof PAYOUT_METHODS)[number]["id"];

export const methodLabel = (m: string) => PAYOUT_METHODS.find((x) => x.id === m)?.label ?? m;

export function referralLink(code: string): string {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://look360.io").replace(/\/+$/, "");
  return `${site}/?ref=${code}`;
}

export type ReferralSettings = {
  commission_type: "percent" | "fixed";
  rate_pct: number;
  fixed_amount: number;
  months: number;
  attribution_days: number;
  min_payout: number;
};

/** « 30 % de ses 2 premiers paiements » / « 2 000 F sur ses 2 premiers paiements ». */
export function ruleText(s: ReferralSettings): string {
  const what = s.commission_type === "fixed" ? fcfa(s.fixed_amount) : `${Number(s.rate_pct)} %`;
  const n = s.months === 1 ? "son 1er paiement" : `ses ${s.months} premiers paiements mensuels`;
  return s.commission_type === "fixed" ? `${what} sur ${n}` : `${what} de ${n}`;
}
