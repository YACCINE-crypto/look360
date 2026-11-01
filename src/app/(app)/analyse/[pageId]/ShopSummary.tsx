"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { ShopProductCard } from "@/components/shops/ShopCards";
import { formatPrice, type Shop, type ShopProduct } from "@/lib/shops";

const nf = new Intl.NumberFormat("fr-FR");

/** Bloc « Boutique » de l'analyse : catalogue public de la boutique de l'annonceur. */
export function ShopSummary({ domain }: { domain: string }) {
  const [data, setData] = useState<{ shop: Shop | null; products?: ShopProduct[] } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/shops/summary?domain=${encodeURIComponent(domain)}`)
      .then((r) => r.json())
      .then((j) => alive && setData(j))
      .catch(() => alive && setData({ shop: null }));
    return () => {
      alive = false;
    };
  }, [domain]);

  if (!data?.shop) return null;
  const s = data.shop;
  const href = `/boutiques/${encodeURIComponent(s.domain)}`;

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Boutique · {s.domain}</h2>
          <p className="text-muted-foreground text-xs">
            {s.status === "ok"
              ? [
                  s.product_count != null ? `${nf.format(s.product_count)} produits` : null,
                  s.price_min != null ? `dès ${formatPrice(s.price_min, s.currency)}` : null,
                  s.catalog_type ? (s.catalog_type === "mono" ? "mono-produit" : "multi-produits") : null,
                  s.cod_apps.length ? "paiement à la livraison" : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "Catalogue indisponible (pas Shopify ou catalogue fermé)"}
          </p>
        </div>
        <Link href={href} className="border-border hover:bg-input inline-flex min-h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium">
          Voir la boutique <Icon name="chevronRight" size={14} />
        </Link>
      </div>
      {data.products && data.products.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {data.products.map((p) => (
            <ShopProductCard key={p.id} product={p} shop={s} />
          ))}
        </div>
      )}
    </Card>
  );
}
