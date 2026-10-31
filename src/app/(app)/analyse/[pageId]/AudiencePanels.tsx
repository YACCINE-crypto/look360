import { Card } from "@/components/ui";
import { CountryFlag, MeterBar } from "@/components/dataviz";
import { countryLabel, formatReach } from "@/lib/spy";
import type { EuAudience } from "@/lib/euAudience";

const nf = new Intl.NumberFormat("fr-FR");
const pct = (n: number, t: number) => (t > 0 ? Math.round((n / t) * 100) : 0);

function Title({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-2">
      <h2 className="text-fg text-sm font-semibold">{children}</h2>
      {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
    </div>
  );
}

/** Audience UE réelle (Meta, transparence DSA) : âge × sexe, sexe, pays, ciblage. */
export function AudiencePanels({ audience, totalReach }: { audience: EuAudience | null; totalReach: number | null }) {
  if (!audience || (audience.ages.length === 0 && audience.countries.length === 0)) {
    return (
      <Card className="p-5">
        <Title>Audience</Title>
        <p className="text-muted-foreground text-sm">
          Meta ne publie la répartition de l&apos;audience (âge, sexe, pays) que pour les pubs
          diffusées dans l&apos;Union européenne. Aucune donnée détaillée pour ces pubs.
        </p>
      </Card>
    );
  }

  const male = audience.ages.reduce((s, r) => s + r.male, 0);
  const female = audience.ages.reduce((s, r) => s + r.female, 0);
  const unknown = audience.ages.reduce((s, r) => s + r.unknown, 0);
  const total = male + female + unknown;
  const maxAge = Math.max(1, ...audience.ages.map((r) => r.male + r.female + r.unknown));
  const countryTotal = audience.countries.reduce((s, c) => s + c.reach, 0);

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      {/* Âge × sexe */}
      <Card className="p-5 lg:col-span-2">
        <Title hint={totalReach ? `${formatReach(totalReach)} personnes touchées dans l'UE` : undefined}>
          Audience par âge et sexe
        </Title>
        <div className="text-muted-foreground mb-3 flex gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="bg-accent h-2.5 w-2.5 rounded-sm" /> Femmes
          </span>
          <span className="flex items-center gap-1.5">
            <span className="bg-fg-2 h-2.5 w-2.5 rounded-sm" /> Hommes
          </span>
          {unknown > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="bg-border h-2.5 w-2.5 rounded-sm" /> Non précisé
            </span>
          )}
        </div>
        <ul className="space-y-2">
          {audience.ages.map((r) => {
            const rowTotal = r.male + r.female + r.unknown;
            return (
              <li key={r.range} className="grid grid-cols-[3.5rem_1fr_4.5rem] items-center gap-3 text-xs">
                <span className="text-fg-2 font-medium tabular-nums">{r.range}</span>
                <div
                  className="bg-input flex h-3 overflow-hidden rounded-full"
                  title={`${r.range} : ${nf.format(r.female)} femmes, ${nf.format(r.male)} hommes`}
                  style={{ width: `${Math.max(4, (rowTotal / maxAge) * 100)}%` }}
                >
                  <span className="bg-accent h-full" style={{ width: `${pct(r.female, rowTotal)}%` }} />
                  <span className="bg-fg-2 h-full" style={{ width: `${pct(r.male, rowTotal)}%` }} />
                  <span className="bg-border h-full flex-1" />
                </div>
                <span className="text-muted-foreground text-right tabular-nums">
                  {pct(rowTotal, total)} %
                </span>
              </li>
            );
          })}
        </ul>
        <div className="border-border-soft mt-4 grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-3">
          <Stat label="Femmes" value={`${pct(female, total)} %`} />
          <Stat label="Hommes" value={`${pct(male, total)} %`} />
          {audience.target_age && <Stat label="Âge ciblé" value={audience.target_age} />}
        </div>
      </Card>

      {/* Pays + ciblage */}
      <Card className="p-5">
        <Title>Pays touchés</Title>
        {audience.countries.length > 0 ? (
          <ul className="space-y-3">
            {audience.countries.slice(0, 6).map((c) => (
              <li key={c.code}>
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="text-fg flex min-w-0 items-center gap-1.5 font-medium">
                    <CountryFlag code={c.code} /> <span className="truncate">{countryLabel(c.code)}</span>
                  </span>
                  <span className="text-muted-foreground tabular-nums">{pct(c.reach, countryTotal)} %</span>
                </div>
                <MeterBar value={pct(c.reach, countryTotal)} tone="primary" height={6} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">Répartition par pays non publiée.</p>
        )}

        {(audience.target_gender || audience.target_locations.length > 0 || audience.payer || audience.beneficiary) && (
          <dl className="border-border-soft mt-4 space-y-2 border-t pt-4 text-xs">
            {audience.target_gender && <Row label="Sexe ciblé" value={audience.target_gender} />}
            {audience.target_locations.length > 0 && (
              <Row label="Zones ciblées" value={audience.target_locations.slice(0, 4).join(", ")} />
            )}
            {audience.payer && <Row label="Payé par" value={audience.payer} />}
            {audience.beneficiary && audience.beneficiary !== audience.payer && (
              <Row label="Bénéficiaire" value={audience.beneficiary} />
            )}
          </dl>
        )}
        <p className="text-muted-foreground mt-4 text-xs">Source : Meta, transparence UE (DSA).</p>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-fg text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className="text-fg-2 truncate text-right font-medium" title={value}>
        {value}
      </dd>
    </div>
  );
}
