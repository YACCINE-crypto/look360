import { redirect } from "next/navigation";
import { ShopView } from "@/components/shops/ShopView";
import { currentAccess } from "@/lib/access";

export const dynamic = "force-dynamic";

/** Fiche boutique ouverte depuis Top Trend (on reste dans Top Trend). */
export default async function TopTrendShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ domain: string }>;
  searchParams: Promise<{ all?: string }>;
}) {
  if (!(await currentAccess()).paid) redirect("/top-trend");
  const { domain } = await params;
  const sp = await searchParams;
  return (
    <ShopView domain={domain} all={sp.all === "1"} base="/top-trend" backHref="/top-trend" backLabel="Retour à Top Trend" />
  );
}
