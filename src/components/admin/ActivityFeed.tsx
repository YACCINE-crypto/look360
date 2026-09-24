"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/Icon";
import { planLabel } from "@/lib/billing";

export type ActivityEvent = {
  type: "signup" | "upgrade" | "pack" | "search";
  ts: string;
  plan: string | null;
  amount: number | null;
  keyword: string | null;
};

const fcfa = (n: number) => new Intl.NumberFormat("fr-FR").format(n) + " FCFA";

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "à l'instant";
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
}

function meta(e: ActivityEvent): {
  icon: React.ComponentProps<typeof Icon>["name"];
  label: string;
  tint: string;
} {
  switch (e.type) {
    case "signup":
      return { icon: "users", label: "Nouvelle inscription", tint: "bg-secondary text-primary" };
    case "upgrade":
      return {
        icon: "trending",
        label: `Passage à l'offre ${planLabel(e.plan)}${e.amount ? ` · ${fcfa(e.amount)}` : ""}`,
        tint: "bg-success-bg text-success",
      };
    case "pack":
      return {
        icon: "store",
        label: `Recharge de crédits${e.amount ? ` · ${fcfa(e.amount)}` : ""}`,
        tint: "bg-success-bg text-success",
      };
    case "search":
      return {
        icon: "search",
        label: `Recherche spy${e.keyword ? ` · « ${e.keyword} »` : ""}`,
        tint: "bg-input text-muted-foreground",
      };
  }
}

export function ActivityFeed({ initial }: { initial: ActivityEvent[] }) {
  const [events, setEvents] = useState<ActivityEvent[]>(initial);
  const [live, setLive] = useState(false);
  const busy = useRef(false);

  const refetch = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const supabase = createClient();
      const { data } = await supabase.rpc("admin_activity");
      if (Array.isArray(data)) setEvents(data as unknown as ActivityEvent[]);
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();

    // Poll de secours (toujours actif) : garantit la fraîcheur même sans Realtime.
    const poll = setInterval(refetch, 10_000);

    // Realtime : refetch immédiat (debounced) sur changement des tables clés.
    let t: ReturnType<typeof setTimeout> | null = null;
    const bump = () => {
      if (t) clearTimeout(t);
      t = setTimeout(refetch, 600);
    };
    const channel = supabase
      .channel("admin-activity")
      .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions" }, bump)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, bump)
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    return () => {
      clearInterval(poll);
      if (t) clearTimeout(t);
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  return (
    <div className="border-border bg-surface shadow-card rounded-2xl border">
      <div className="border-border flex items-center justify-between border-b px-5 py-3.5">
        <p className="text-foreground font-bold">Flux d&apos;activité</p>
        <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
          <span className="relative flex h-2 w-2">
            {live && (
              <span className="bg-success absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" />
            )}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${live ? "bg-success" : "bg-warning"}`} />
          </span>
          {live ? "En direct" : "Rafraîchissement auto"}
        </span>
      </div>

      {events.length === 0 ? (
        <p className="text-muted-foreground p-8 text-center text-sm">
          Aucune activité pour le moment.
        </p>
      ) : (
        <ul className="divide-border divide-y">
          {events.map((e, i) => {
            const m = meta(e);
            return (
              <li key={i} className="flex items-center gap-3 px-5 py-3">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${m.tint}`}>
                  <Icon name={m.icon} size={16} />
                </span>
                <span className="text-foreground min-w-0 flex-1 truncate text-sm">
                  {m.label}
                </span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {timeAgo(e.ts)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
