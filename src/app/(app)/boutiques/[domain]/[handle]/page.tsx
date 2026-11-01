import { ProductView } from "@/components/shops/ProductView";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ domain: string; handle: string }> }) {
  const { domain, handle } = await params;
  return <ProductView domain={domain} handle={handle} base="/boutiques" />;
}
