"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { suivreConcurrent } from "../../surveillance/actions";

export function SuivreButton({
  pageId,
  pageName,
  domaine,
  country,
}: {
  pageId: string;
  pageName: string | null;
  domaine: string | null;
  country: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [followed, setFollowed] = useState(false);

  function follow() {
    startTransition(async () => {
      const r = await suivreConcurrent({ page_id: pageId, page_name: pageName, domaine, country });
      if (r.ok) setFollowed(true);
      else if (r.reason === "limit") alert("Limite de 20 concurrents suivis atteinte.");
    });
  }

  return (
    <button
      onClick={follow}
      disabled={followed || pending}
      className="bg-input text-foreground hover:bg-muted inline-flex min-h-[40px] items-center gap-1.5 rounded-md px-4 text-sm font-semibold transition-colors disabled:opacity-60"
    >
      <Icon name={followed ? "check" : "bell"} size={16} />
      {followed ? "Surveillé" : pending ? "…" : "Surveiller"}
    </button>
  );
}
