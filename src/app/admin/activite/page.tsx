import { createClient } from "@/lib/supabase/server";
import { ActivityFeed, type ActivityEvent } from "@/components/admin/ActivityFeed";

export const dynamic = "force-dynamic";

export default async function AdminActivitePage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_activity");
  const initial = (Array.isArray(data) ? data : []) as unknown as ActivityEvent[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-extrabold tracking-tight">
          Activité
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Les derniers événements en temps réel — inscriptions, paiements,
          changements d&apos;offre, recherches spy.
        </p>
      </div>

      <ActivityFeed initial={initial} />
    </div>
  );
}
