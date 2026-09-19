import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { countryLabel, MAX_COMPETITORS } from "@/lib/spy";
import { retirerConcurrent } from "./actions";

export const dynamic = "force-dynamic";

function formatDate(iso: string | null): string {
  if (!iso) return "jamais";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function SurveillancePage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("competitors_watch")
    .select("*")
    .order("created_at", { ascending: false });
  const rows = data ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Surveillance"
        subtitle={`Concurrents suivis (${rows.length}/${MAX_COMPETITORS}) — un rappel push quand ils lancent une nouvelle pub.`}
      >
        <Link
          href="/spy"
          className="bg-primary text-primary-foreground inline-flex min-h-[40px] items-center gap-1.5 rounded-md px-4 text-sm font-semibold transition-opacity hover:opacity-90"
        >
          <Icon name="eye" size={16} /> Spy Facebook
        </Link>
      </PageHeader>

      {rows.length === 0 ? (
        <div className="border-border bg-surface rounded-xl border border-dashed p-12 text-center">
          <span className="bg-secondary text-primary mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full">
            <Icon name="eye" size={24} />
          </span>
          <p className="font-medium">Aucun concurrent suivi</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
            Depuis le Spy, clique « Surveiller » sur une page pour être alerté
            dès qu&apos;elle lance une nouvelle pub.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((c) => (
            <Card key={c.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{c.page_name ?? "Page Facebook"}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {c.domaine ? `${c.domaine} · ` : ""}
                  {c.country ? `${countryLabel(c.country)} · ` : ""}
                  {c.known_ad_ids?.length ?? 0} pub(s) connues · vérifié{" "}
                  {formatDate(c.last_checked_at)}
                </p>
              </div>
              <Link
                href={`/spy?pageId=${encodeURIComponent(c.page_id)}&country=${encodeURIComponent(c.country ?? "FR")}&name=${encodeURIComponent(c.page_name ?? "")}`}
                className="bg-input text-foreground inline-flex min-h-[38px] items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors hover:bg-muted"
              >
                <Icon name="search" size={14} /> Analyser
              </Link>
              <form action={retirerConcurrent}>
                <input type="hidden" name="id" value={c.id} />
                <button
                  type="submit"
                  className="text-danger hover:bg-danger-bg inline-flex min-h-[38px] items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors"
                >
                  <Icon name="trash" size={14} /> Retirer
                </button>
              </form>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
