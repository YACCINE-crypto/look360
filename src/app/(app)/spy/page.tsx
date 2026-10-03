import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getSubscription } from "@/lib/credits";
import { getFeed } from "@/lib/feed";
import { SpyClient } from "./SpyClient";

export const dynamic = "force-dynamic";

export default async function SpyPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  const [sub, feed] = await Promise.all([
    userId ? getSubscription(userId) : Promise.resolve(null),
    getFeed(supabase, { limit: 48 }), // feed commun (lecture RLS authenticated)
  ]);

  return (
    <Suspense fallback={<div className="text-muted-foreground p-4 text-sm">Chargement…</div>}>
      <SpyClient balance={sub?.credits_balance ?? 0} plan={sub?.plan ?? "free"} initialFeed={feed} />
    </Suspense>
  );
}
