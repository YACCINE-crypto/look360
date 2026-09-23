import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { countryLabel, cleanField } from "@/lib/spy";
import { getSubscription } from "@/lib/credits";
import { planConfig } from "@/lib/billing";
import { retirerConcurrent } from "./actions";

export const dynamic = "force-dynamic";

// Initiales pour l'avatar (pas de logo stocké — fallback honnête).
function initials(name: string | null): string {
  const n = (name ?? "").trim();
  if (!n) return "FB";
  return n
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function formatAdded(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function SurveillancePage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  const sub = userId ? await getSubscription(userId) : null;
  const slots = planConfig(sub?.plan).competitorSlots;

  const { data } = await supabase
    .from("competitors_watch")
    .select("*")
    .order("new_ads_count", { ascending: false })
    .order("created_at", { ascending: false });
  const rows = data ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Surveillance"
        subtitle={`Concurrents suivis (${rows.length}/${slots}) — un rappel push quand ils lancent une nouvelle pub.`}
      >
        <Link
          href="/spy"
          className="bg-primary text-primary-foreground inline-flex min-h-[40px] items-center gap-1.5 rounded-md px-4 text-sm font-semibold transition-opacity hover:opacity-90"
        >
          <Icon name="eye" size={16} /> Spy Facebook
        </Link>
      </PageHeader>

      {rows.length === 0 ? (
        <div className="border-border bg-surface rounded-xl border border-dashed p-12 text-center">
          <span className="bg-secondary text-primary mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full">
            <Icon name="eye" size={24} />
          </span>
          <p className="font-medium">Aucun concurrent suivi</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
            Depuis le Spy, clique « Surveiller » sur une page pour être alerté
            dès qu&apos;elle lance une nouvelle pub.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {rows.map((c) => {
            const nouvelles = c.new_ads_count ?? 0;
            const pageName = cleanField(c.page_name) ?? "Page Facebook";
            return (
              <Card
                key={c.id}
                className={`relative flex flex-col gap-3 p-4 ${
                  nouvelles > 0 ? "ring-primary/40 ring-1" : ""
                }`}
              >
                {/* Badge "nouvelle pub détectée" */}
                {nouvelles > 0 && (
                  <span className="bg-primary text-primary-foreground absolute -top-2 right-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-sm">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="bg-primary-foreground absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
                      <span className="bg-primary-foreground relative inline-flex h-1.5 w-1.5 rounded-full" />
                    </span>
                    {nouvelles > 1 ? `${nouvelles} nouvelles pubs` : "Nouvelle pub"}
                  </span>
                )}

                <div className="flex items-start gap-3">
                  {/* Avatar initiales */}
                  <span className="bg-secondary text-primary grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-bold">
                    {initials(pageName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold leading-snug">{pageName}</p>
                    {c.domaine && (
                      <p className="text-muted-foreground flex items-center gap-1 truncate text-xs">
                        <Icon name="external" size={12} /> {c.domaine}
                      </p>
                    )}
                    {c.country && (
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {countryLabel(c.country)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Méta */}
                <div className="border-border grid grid-cols-2 gap-2 border-t pt-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Pubs repérées</p>
                    <p className="font-semibold tabular-nums">{c.known_ad_ids?.length ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Ajouté le</p>
                    <p className="font-semibold">{formatAdded(c.created_at)}</p>
                  </div>
                </div>

                {/* Actions intégrées */}
                <div className="flex items-center gap-2 pt-1">
                  <Link
                    href={`/analyse/${encodeURIComponent(c.page_id)}?country=${encodeURIComponent(c.country ?? "FR")}&name=${encodeURIComponent(c.page_name ?? "")}`}
                    className="bg-primary text-primary-foreground inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-semibold transition-opacity hover:opacity-90"
                  >
                    <Icon name="search" size={14} /> Analyser
                  </Link>
                  <form action={retirerConcurrent}>
                    <input type="hidden" name="id" value={c.id} />
                    <button
                      type="submit"
                      aria-label="Retirer de la surveillance"
                      className="text-muted-foreground hover:text-danger hover:bg-danger-bg border-border inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors"
                    >
                      <Icon name="trash" size={14} /> Retirer
                    </button>
                  </form>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
