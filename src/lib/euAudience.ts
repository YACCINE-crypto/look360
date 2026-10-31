// ============================================================================
// Audience UE d'une pub (transparence DSA, champ « AAA Info » de l'actor).
// Pour les pubs diffusées dans l'UE, Meta publie la portée réelle répartie par
// âge, sexe et pays, le ciblage déclaré et le payeur / bénéficiaire.
// Lecture tolérante : les clés varient selon les versions de l'actor ; toute
// donnée absente reste absente (jamais de valeur inventée).
// ============================================================================

export type AgeRow = { range: string; male: number; female: number; unknown: number };

export type EuAudience = {
  /** Portée par tranche d'âge et sexe (toutes zones UE confondues). */
  ages: AgeRow[];
  /** Portée par pays (code ISO-2), triée décroissante. */
  countries: { code: string; reach: number }[];
  /** Ciblage déclaré par l'annonceur. */
  target_age: string | null;
  target_gender: string | null;
  target_locations: string[];
  payer: string | null;
  beneficiary: string | null;
};

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return 0;
}
function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

const GENDER_FR: Record<string, string> = {
  all: "Tous",
  women: "Femmes",
  female: "Femmes",
  men: "Hommes",
  male: "Hommes",
};

/** Extrait l'audience UE détaillée ; null si Meta ne publie rien d'exploitable. */
export function parseEuAudience(aaaRaw: unknown, euTRaw: unknown): EuAudience | null {
  const aaa = obj(aaaRaw);
  const euT = obj(euTRaw);
  const pick = (k: string) => aaa[k] ?? euT[k];

  // Répartition âge × sexe × pays.
  const ageMap = new Map<string, AgeRow>();
  const countryMap = new Map<string, number>();
  for (const c of arr(pick("age_country_gender_reach_breakdown"))) {
    const co = obj(c);
    const code = (str(co.country) ?? "").toUpperCase();
    let countryTotal = 0;
    for (const b of arr(co.age_gender_breakdowns ?? co.age_gender_breakdown)) {
      const bo = obj(b);
      const range = str(bo.age_range) ?? "?";
      const male = num(bo.male);
      const female = num(bo.female);
      const unknown = num(bo.unknown);
      const row = ageMap.get(range) ?? { range, male: 0, female: 0, unknown: 0 };
      row.male += male;
      row.female += female;
      row.unknown += unknown;
      ageMap.set(range, row);
      countryTotal += male + female + unknown;
    }
    if (code && countryTotal > 0) countryMap.set(code, (countryMap.get(code) ?? 0) + countryTotal);
  }
  const ages = [...ageMap.values()]
    .filter((r) => r.male + r.female + r.unknown > 0)
    .sort((a, b) => a.range.localeCompare(b.range, "fr", { numeric: true }));
  const countries = [...countryMap.entries()]
    .map(([code, reach]) => ({ code, reach }))
    .sort((a, b) => b.reach - a.reach);

  // Ciblage déclaré.
  const ageAud = obj(pick("age_audience"));
  const minA = num(ageAud.min);
  const maxA = num(ageAud.max);
  const target_age = minA || maxA ? `${minA || 13}–${maxA >= 65 || !maxA ? "65+" : maxA}` : null;
  const g = str(pick("gender_audience"));
  const target_gender = g ? (GENDER_FR[g.toLowerCase()] ?? g) : null;
  const target_locations = arr(pick("location_audience"))
    .map((l) => obj(l))
    .filter((l) => l.excluded !== true)
    .map((l) => str(l.name))
    .filter((n): n is string => Boolean(n))
    .slice(0, 12);

  // Payeur / bénéficiaire.
  const pb = obj(
    arr(pick("payer_beneficiary_data"))[0] ?? arr(pick("beneficiary_payers"))[0],
  );
  const payer = str(pb.payer) ?? str(pick("payer"));
  const beneficiary = str(pb.beneficiary) ?? str(pick("beneficiary"));

  if (
    ages.length === 0 &&
    countries.length === 0 &&
    !target_age &&
    !target_gender &&
    target_locations.length === 0 &&
    !payer &&
    !beneficiary
  ) {
    return null;
  }
  return { ages, countries, target_age, target_gender, target_locations, payer, beneficiary };
}

/** Somme les audiences de plusieurs pubs (fiche Analyser d'un annonceur). */
export function mergeEuAudiences(list: (EuAudience | null | undefined)[]): EuAudience | null {
  const items = list.filter((a): a is EuAudience => Boolean(a));
  if (items.length === 0) return null;
  const ageMap = new Map<string, AgeRow>();
  const countryMap = new Map<string, number>();
  for (const a of items) {
    for (const r of a.ages) {
      const row = ageMap.get(r.range) ?? { range: r.range, male: 0, female: 0, unknown: 0 };
      row.male += r.male;
      row.female += r.female;
      row.unknown += r.unknown;
      ageMap.set(r.range, row);
    }
    for (const c of a.countries) countryMap.set(c.code, (countryMap.get(c.code) ?? 0) + c.reach);
  }
  const most = (vals: (string | null)[]) => {
    const m = new Map<string, number>();
    for (const v of vals) if (v) m.set(v, (m.get(v) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  };
  return {
    ages: [...ageMap.values()].sort((a, b) => a.range.localeCompare(b.range, "fr", { numeric: true })),
    countries: [...countryMap.entries()]
      .map(([code, reach]) => ({ code, reach }))
      .sort((a, b) => b.reach - a.reach),
    target_age: most(items.map((a) => a.target_age)),
    target_gender: most(items.map((a) => a.target_gender)),
    target_locations: [...new Set(items.flatMap((a) => a.target_locations))].slice(0, 12),
    payer: most(items.map((a) => a.payer)),
    beneficiary: most(items.map((a) => a.beneficiary)),
  };
}
