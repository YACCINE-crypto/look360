"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/Icon";

const inputCls =
  "min-h-[40px] rounded-md border border-border bg-input px-3 text-sm outline-none focus:border-primary";

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
      <label className="flex flex-col gap-1.5">
        <span className="text-muted-foreground text-xs font-medium">Région</span>
        <select value={region} onChange={(e) => update({ region: e.target.value })} className={inputCls}>
          <option value="all">Toutes</option>
          <option value="africa">Afrique</option>
          <option value="europe">Europe</option>
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-muted-foreground text-xs font-medium">Période</span>
        <select value={days} onChange={(e) => update({ days: e.target.value })} className={inputCls}>
          <option value="7">7 derniers jours</option>
          <option value="30">30 derniers jours</option>
        </select>
      </label>
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
