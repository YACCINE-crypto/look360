import { redirect } from "next/navigation";
import { ProductView } from "@/components/shops/ProductView";
import { currentAccess } from "@/lib/access";

export const dynamic = "force-dynamic";

/** Fiche produit ouverte depuis Top Trend (on reste dans Top Trend). */
export default async function TopTrendProductPage({ params }: { params: Promise<{ domain: string; handle: string }> }) {
  if (!(await currentAccess()).paid) redirect("/top-trend");
  const { domain, handle } = await params;
  return <ProductView domain={domain} handle={handle} base="/top-trend" />;
}
