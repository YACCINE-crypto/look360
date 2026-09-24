import { createClient } from "@/lib/supabase/server";
import { getSubscription } from "@/lib/credits";
import { type Plan } from "@/lib/billing";
import OffresClient from "./OffresClient";

export const dynamic = "force-dynamic";

export default async function OffresPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  const sub = userId ? await getSubscription(userId) : null;
  const current = (sub?.plan ?? "free") as Plan;
  const balance = sub?.credits_balance ?? 0;

  const sp = await searchParams;
  const payReturnRef =
    sp.pay === "return" && typeof sp.ref === "string" ? sp.ref : null;

  return (
    <OffresClient current={current} balance={balance} payReturnRef={payReturnRef} />
  );
}
