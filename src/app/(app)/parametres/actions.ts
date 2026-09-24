"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Met à jour la préférence de partage vitrine du compte connecté (RLS: own row). */
export async function setVitrineShare(value: boolean): Promise<void> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub as string | undefined;
  if (!uid) return;
  await supabase.from("profiles").update({ vitrine_share: value }).eq("id", uid);
  revalidatePath("/parametres");
}
