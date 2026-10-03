import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getSubscription } from "@/lib/credits";
import { getUsage } from "@/lib/usage";
import { planLimits } from "@/lib/billing";
import { SpyClient } from "./SpyClient";

export const dynamic = "force-dynamic";

export default async function SpyPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  const [sub, usage] = await Promise.all([
    userId ? getSubscription(userId) : Promise.resolve(null),
    userId ? getUsage(userId) : Promise.resolve(null),
  ]);
  const plan = sub?.plan ?? "free";
  const lim = planLimits(plan);

  // Le feed commun (gratuit) vit sur « Recherche ». Ici = recherche perso (payante).
  return (
    <Suspense fallback={<div className="text-muted-foreground p-4 text-sm">Chargement…</div>}>
      <SpyClient
        plan={plan}
        searchesUsed={usage?.searches_used ?? 0}
        searchesLimit={lim.monthlySearches}
        maxMarkets={lim.maxMarkets}
      />
    </Suspense>
  );
}
