import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { EquipeForm } from "./EquipeForm";

export default async function EquipePage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub as string | undefined;
  if (!userId) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (me?.role !== "admin") redirect("/recherche");

  // Membres (agents + admin) + nombre de produits soumis par chacun.
  const [{ data: profiles }, { data: produits }] = await Promise.all([
    supabase.from("profiles").select("id, nom, role").order("role"),
    supabase.from("produits").select("soumis_par"),
  ]);

  const countByUser = new Map<string, number>();
  for (const p of produits ?? []) {
    if (p.soumis_par)
      countByUser.set(p.soumis_par, (countByUser.get(p.soumis_par) ?? 0) + 1);
  }

  const membres = profiles ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Équipe"
        subtitle="Gère les comptes des commerciaux qui soumettent des produits."
      />

      <EquipeForm />

      <div className="border-border bg-surface shadow-card overflow-hidden rounded-xl border">
        <div className="border-border border-b px-5 py-3">
          <h2 className="text-sm font-semibold">
            Membres ({membres.length})
          </h2>
        </div>
        <ul className="divide-border divide-y">
          {membres.map((m) => {
            const initials = (m.nom ?? "??").slice(0, 2).toUpperCase();
            return (
              <li key={m.id} className="flex items-center gap-3 px-5 py-3">
                <span className="bg-secondary text-secondary-foreground grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold">
                  {initials}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {m.nom ?? "—"}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {countByUser.get(m.id) ?? 0} produit
                    {(countByUser.get(m.id) ?? 0) > 1 ? "s" : ""} soumis
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                    m.role === "admin"
                      ? "bg-primary text-primary-foreground"
                      : "bg-input text-muted-foreground"
                  }`}
                >
                  {m.role}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
