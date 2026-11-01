import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getSubscription } from "@/lib/credits";

/** Nombre d'éléments visibles sans abonnement (Feed, Produits gagnants, Boutiques). */
export const FREE_PREVIEW = 5;

/** Utilisateur courant + offre effective (payante ou non). */
export async function currentAccess(): Promise<{ userId: string | null; plan: string; paid: boolean }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = (data?.claims?.sub as string | undefined) ?? null;
  const sub = userId ? await getSubscription(userId) : null;
  const plan = sub?.plan ?? "free";
  return { userId, plan, paid: plan !== "free" };
}
