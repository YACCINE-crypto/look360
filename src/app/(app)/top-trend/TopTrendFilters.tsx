"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Select } from "@/components/Select";

export function TopTrendFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const region = params.get("region") || "all";
  const days = params.get("days") || "30";
  const q = params.get("q") || "";

  function update(patch: Record<string, string>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    router.push(`/top-trend?${sp.toString()}`);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        update({ q: String(fd.get("q") ?? "") });
      }}
      className="flex flex-wrap items-end gap-3"
    >
      <div className="flex w-36 flex-col gap-1.5">
        <span className="text-muted-foreground text-xs font-medium">Région</span>
        <Select
          value={region}
          onChange={(v) => update({ region: v })}
          ariaLabel="Région"
          options={[
            { value: "all", label: "Toutes" },
            { value: "africa", label: "Afrique" },
            { value: "europe", label: "Europe" },
          ]}
        />
      </div>
      <div className="flex w-44 flex-col gap-1.5">
        <span className="text-muted-foreground text-xs font-medium">Période</span>
        <Select
          value={days}
          onChange={(v) => update({ days: v })}
          ariaLabel="Période"
          options={[
            { value: "7", label: "7 derniers jours" },
            { value: "30", label: "30 derniers jours" },
          ]}
        />
      </div>
      <label className="flex flex-1 flex-col gap-1.5">
        <span className="text-muted-foreground text-xs font-medium">Niche / mot-clé</span>
        <div className="border-border bg-input flex min-h-[40px] items-center gap-2 rounded-md border px-3">
          <Icon name="search" size={16} className="text-muted-foreground" />
          <input name="q" defaultValue={q} placeholder="filtrer…" className="w-full bg-transparent text-sm outline-none" />
        </div>
      </label>
    </form>
  );
}
