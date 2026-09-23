import { createClient } from "@/lib/supabase/server";
import { getSubscription } from "@/lib/credits";
import { PageHeader, Card } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { PLANS, PLAN_ORDER, CREDIT_PACKS, formatCredits, planLabel, type Plan } from "@/lib/billing";

export const dynamic = "force-dynamic";

const fcfa = (n: number) => new Intl.NumberFormat("fr-FR").format(n) + " FCFA";

export default async function OffresPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  const sub = userId ? await getSubscription(userId) : null;
  const current = (sub?.plan ?? "free") as Plan;
  const balance = sub?.credits_balance ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Offres & crédits"
        subtitle="Ton solde et les offres. Les crédits servent aux recherches et analyses."
      />

      {/* Solde */}
      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Solde de crédits</p>
          <p className="text-primary text-3xl font-bold tabular-nums">⚡ {formatCredits(balance)}</p>
        </div>
        <div className="text-right">
          <p className="text-muted-foreground text-xs">Offre actuelle</p>
          <p className="text-lg font-bold">{planLabel(current)}</p>
        </div>
      </Card>

      {/* Offres */}
      <div>
        <h2 className="mb-3 font-semibold">Changer d&apos;offre</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PLAN_ORDER.map((p) => {
            const cfg = PLANS[p];
            const isCurrent = p === current;
            return (
              <Card key={p} className={`flex flex-col gap-3 p-4 ${isCurrent ? "ring-primary ring-2" : ""}`}>
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold">{cfg.label}</h3>
                    {isCurrent && (
                      <span className="bg-success-bg text-success rounded-full px-2 py-0.5 text-[11px] font-semibold">
                        Actuelle
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-2xl font-bold tabular-nums">
                    {cfg.priceNormal === 0 ? "Gratuit" : fcfa(cfg.priceNormal)}
                    {cfg.priceNormal > 0 && <span className="text-muted-foreground text-xs font-normal"> /mois</span>}
                  </p>
                  {cfg.priceFirst != null && (
                    <p className="text-primary text-xs font-medium">1er mois : {fcfa(cfg.priceFirst)}</p>
                  )}
                </div>
                <ul className="text-muted-foreground space-y-1.5 text-sm">
                  <li className="flex items-center gap-1.5">
                    <Icon name="check" size={13} className="text-success shrink-0" />
                    {formatCredits(cfg.monthlyCredits)} crédits / mois
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Icon name="check" size={13} className="text-success shrink-0" />
                    {cfg.competitorSlots === 0 ? "Pas de suivi concurrent" : `${cfg.competitorSlots} concurrent(s) suivis`}
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Icon name={cfg.winnerEnabled ? "check" : "x"} size={13} className={`shrink-0 ${cfg.winnerEnabled ? "text-success" : "text-muted-foreground"}`} />
                    {cfg.winnerEnabled ? `Winner Agent (${cfg.winnerKeywords} mots-clés × ${cfg.winnerCountries} pays)` : "Winner Agent : non"}
                  </li>
                </ul>
                <button
                  type="button"
                  disabled
                  className="bg-input text-muted-foreground mt-auto inline-flex min-h-[40px] w-full items-center justify-center rounded-md text-sm font-semibold"
                  title="Paiement bientôt disponible"
                >
                  {isCurrent ? "Offre actuelle" : "Bientôt disponible"}
                </button>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Packs de recharge */}
      <div>
        <h2 className="mb-3 font-semibold">Recharger des crédits</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {CREDIT_PACKS.map((pack) => (
            <Card key={pack.credits} className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-lg font-bold">⚡ {formatCredits(pack.credits)}</p>
                <p className="text-muted-foreground text-sm">{fcfa(pack.price)}</p>
              </div>
              <button
                type="button"
                disabled
                className="bg-input text-muted-foreground inline-flex min-h-[40px] items-center justify-center rounded-md px-4 text-sm font-semibold"
                title="Paiement bientôt disponible"
              >
                Recharger
              </button>
            </Card>
          ))}
        </div>
        <p className="text-muted-foreground mt-3 text-xs">
          Le paiement mobile arrive très bientôt. Les crédits achetés s&apos;ajoutent à ton
          solde et n&apos;expirent pas.
        </p>
      </div>
    </div>
  );
}
