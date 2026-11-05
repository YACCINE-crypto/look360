import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getQuota } from "@/lib/usage";
import { planLimits } from "@/lib/billing";
import { SpyClient } from "./SpyClient";

export const dynamic = "force-dynamic";

export default async function SpyPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  // Quota lu EN BASE sur le plan effectif (période anniversaire / mois civil).
  const quota = userId ? await getQuota(userId) : null;
  const plan = quota?.plan ?? "free";

  return (
    <Suspense fallback={<div className="text-muted-foreground p-4 text-sm">Chargement…</div>}>
      <SpyClient
        plan={plan}
        searchesUsed={quota?.used ?? 0}
        searchesLimit={quota?.limit ?? 0}
        maxMarkets={planLimits(plan).maxMarkets}
      />
    </Suspense>
  );
}
