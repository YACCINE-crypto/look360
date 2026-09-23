import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getSubscription } from "@/lib/credits";
import { SpyClient } from "./SpyClient";

export const dynamic = "force-dynamic";

export default async function SpyPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  const sub = userId ? await getSubscription(userId) : null;

  return (
    <Suspense fallback={<div className="text-muted-foreground p-4 text-sm">Chargement…</div>}>
      <SpyClient balance={sub?.credits_balance ?? 0} plan={sub?.plan ?? "free"} />
    </Suspense>
  );
}
