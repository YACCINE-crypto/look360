import { Suspense } from "react";
import { SpyClient } from "./SpyClient";

export default function SpyPage() {
  return (
    <Suspense fallback={<div className="text-muted-foreground p-4 text-sm">Chargement…</div>}>
      <SpyClient />
    </Suspense>
  );
}
