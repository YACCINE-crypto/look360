import { Icon } from "@/components/Icon";

/* Aperçu d'interface Look360 (grille Spy + verdict testing), construit en HTML
   — pas une image. Remplaçable plus tard par un vrai screenshot. Les chiffres
   sont illustratifs (démonstration de l'interface), pas des statistiques réelles. */
export function HeroPreview() {
  return (
    <div className="relative mx-auto w-full max-w-4xl">
      <div className="border-border bg-surface overflow-hidden rounded-2xl border shadow-xl shadow-primary/5">
        {/* Barre de fenêtre */}
        <div className="border-border bg-background flex items-center gap-2 border-b px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
          <div className="bg-input text-muted-foreground ml-3 inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs">
            <Icon name="eye" size={12} /> Spy Facebook · Côte d&apos;Ivoire
          </div>
        </div>

        {/* Corps : grille spy + panneau verdict */}
        <div className="grid gap-4 p-4 sm:grid-cols-5">
          {/* Grille Spy */}
          <div className="grid grid-cols-2 gap-3 sm:col-span-3">
            {[
              { score: 92, label: "Fort" },
              { score: 78, label: "Bon" },
              { score: 85, label: "Fort" },
              { score: 64, label: "Moyen" },
            ].map((ad, i) => (
              <div
                key={i}
                className="border-border bg-surface overflow-hidden rounded-xl border"
              >
                <div className="bg-input text-muted-foreground flex aspect-video items-center justify-center">
                  <Icon name="image" size={20} />
                </div>
                <div className="p-2">
                  <div className="bg-muted h-2 w-3/4 rounded-full" />
                  <div className="mt-2 flex items-center justify-between">
                    <span className="bg-secondary text-secondary-foreground rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                      Score {ad.score}
                    </span>
                    <span className="text-success">
                      <Icon name="trending" size={13} />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Panneau Testing / verdict */}
          <div className="border-border bg-surface flex flex-col gap-3 rounded-xl border p-4 sm:col-span-2">
            <div className="flex items-center gap-1.5">
              <span className="text-primary">
                <Icon name="flask" size={14} />
              </span>
              <p className="text-muted-foreground text-xs font-medium">
                Testing COD
              </p>
            </div>

            <div className="space-y-2.5">
              <StatRow label="Commandes reçues" value="14" />
              <StatRow label="Taux de closing" value="62 %" accent />
              <StatRow label="Marge nette" value="+48 %" accent />
            </div>

            <div className="bg-success-bg text-success mt-1 inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1 text-sm font-bold">
              <Icon name="check" size={14} strokeWidth={3} /> Rentable
            </div>
          </div>
        </div>
      </div>

      <p className="text-muted-foreground mt-3 text-center text-xs">
        Aperçu de l&apos;interface Look360
      </p>
    </div>
  );
}

function StatRow({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span
        className={`text-sm font-bold tabular-nums ${
          accent ? "text-primary" : "text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
