"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSubscription } from "@/lib/credits";
import { planConfig } from "@/lib/billing";

/** Suit un concurrent (page Facebook). Plafond = nb de slots de l'offre. */
export async function suivreConcurrent(input: {
  page_id: string;
  page_name?: string | null;
  domaine?: string | null;
  country?: string | null;
}): Promise<{ ok: boolean; reason?: "limit" | "no_page" | "db" | "auth"; slots?: number }> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return { ok: false, reason: "auth" };
  if (!input.page_id) return { ok: false, reason: "no_page" };

  // Slots de suivi selon l'offre (Gratuit 0, Starter 1, Pro 3, Business 10).
  const sub = await getSubscription(userId);
  const slots = planConfig(sub?.plan).competitorSlots;

  const { count } = await supabase
    .from("competitors_watch")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if ((count ?? 0) >= slots) return { ok: false, reason: "limit", slots };

  const { error } = await supabase.from("competitors_watch").upsert(
    {
      user_id: userId,
      page_id: input.page_id,
      page_name: input.page_name ?? null,
      domaine: input.domaine ?? null,
      country: input.country ?? null,
    },
    { onConflict: "user_id,page_id" },
  );
  if (error) return { ok: false, reason: "db" };

  revalidatePath("/surveillance");
  return { ok: true };
}

/** Retire un concurrent suivi. */
export async function retirerConcurrent(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("competitors_watch").delete().eq("id", id);
  revalidatePath("/surveillance");
}
