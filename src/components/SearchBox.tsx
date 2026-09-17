"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Icon } from "./Icon";

export function SearchBox() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function submit(value: string) {
    const next = new URLSearchParams(params.toString());
    if (value.trim()) next.set("q", value.trim());
    else next.delete("q");
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="border-border bg-input flex min-h-[44px] items-center gap-2 rounded-md border px-3 py-2">
      <Icon name="search" size={16} className="text-muted-foreground" />
      <input
        defaultValue={params.get("q") ?? ""}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit((e.target as HTMLInputElement).value);
        }}
        onBlur={(e) => submit(e.target.value)}
        placeholder="Rechercher un produit…"
        className="w-48 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
