import { PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { ReferralView, type Dashboard } from "./ReferralView";

export const dynamic = "force-dynamic";

/** Parrainage : lien perso, résultats, gains et retrait (tout lu en base, session de l'utilisateur). */
export default async function ParrainagePage() {
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as {
    rpc: (f: string) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  }).rpc("my_referral_dashboard");

  if (error || !data) {
    return (
      <div className="space-y-4">
        <PageHeader title="Parrainage" />
        <p className="border-border bg-surface text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
          Le programme de parrainage n&apos;est pas encore disponible. Réessaie dans quelques minutes.
        </p>
      </div>
    );
  }
  return <ReferralView d={data as Dashboard} />;
}

