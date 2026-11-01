import { ShopView } from "@/components/shops/ShopView";

export const dynamic = "force-dynamic";

export default async function ShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ domain: string }>;
  searchParams: Promise<{ all?: string }>;
}) {
  const { domain } = await params;
  const sp = await searchParams;
  return (
    <ShopView
      domain={domain}
      all={sp.all === "1"}
      base="/boutiques"
      backHref="/boutiques?tab=boutiques"
      backLabel="Retour aux boutiques"
    />
  );
}
