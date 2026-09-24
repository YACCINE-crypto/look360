export const dynamic = "force-dynamic";

export default function AdminCockpitPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-extrabold tracking-tight">
          Cockpit
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Vue d&apos;ensemble de Look360 — données réelles en direct.
        </p>
      </div>

      <div className="border-border text-muted-foreground rounded-2xl border border-dashed p-10 text-center">
        <p className="text-foreground font-semibold">KPIs & graphiques</p>
        <p className="mt-1 text-sm">Sections à construire — STEP 1 → 3.</p>
      </div>
    </div>
  );
}
