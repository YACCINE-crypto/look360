import Link from "next/link";
import { Icon } from "@/components/Icon";

/** Onglets de « Mes produits » : produits enregistrés / pubs sauvegardées. */
export function ProduitsTabs({
  active,
  produits,
  sauvegardes,
}: {
  active: "produits" | "sauvegardes";
  produits: number;
  sauvegardes: number;
}) {
  const tabs = [
    { key: "produits" as const, href: "/produits", label: "Produits", icon: "pipeline" as const, count: produits },
    { key: "sauvegardes" as const, href: "/produits?tab=sauvegardes", label: "Pubs sauvegardées", icon: "bookmark" as const, count: sauvegardes },
  ];
  return (
    <nav className="border-border flex gap-1 border-b" aria-label="Sections de Mes produits">
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={`-mb-px inline-flex min-h-[44px] items-center gap-2 border-b-2 px-3 text-sm font-semibold transition-colors ${
              on ? "border-accent text-accent" : "text-muted-foreground hover:text-fg border-transparent"
            }`}
          >
            <Icon name={t.icon} size={16} />
            {t.label}
            <span className={`rounded-full px-1.5 py-0.5 text-xs ${on ? "bg-accent text-accent-on" : "bg-input text-muted-foreground"}`}>
              {t.count}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
