import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProduitDetailView } from "./ProduitDetailView";
import type { Test } from "@/lib/testing";
import type { Produit } from "@/lib/produits";

export default async function ProduitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: produit }, { data: testsData }] = await Promise.all([
    supabase.from("produits").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("tests")
      .select("*")
      .eq("produit_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!produit) notFound();

  return <ProduitDetailView p={produit as Produit} tests={(testsData ?? []) as Test[]} />;
}
