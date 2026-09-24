import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { planLabel } from "@/lib/billing";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

type Row = {
  user_id: string;
  email: string | null;
  nom: string | null;
  plan: string;
  status: string;
  credits_balance: number | null;
  has_ever_paid: boolean;
  suspended: boolean;
  searches_count: number;
  tests_count: number;
  ca_genere: number;
  created_at: string;
};

const PAGE_SIZE = 25;
const fcfa = (n: number) => new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
const nf = (n: number | null) => new Intl.NumberFormat("fr-FR").format(n ?? 0);

const planBadge = (p: string) =>
  p === "business"
    ? "bg-emerald-100 text-emerald-700"
    : p === "pro"
      ? "bg-secondary text-primary"
      : p === "starter"
        ? "bg-blue-100 text-blue-700"
        : "bg-input text-muted-foreground";

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || "";
  const plan = sp.plan || "";
  const status = sp.status || "";
  const page = Math.max(1, Number(sp.page) || 1);

  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_clients", {
    p_search: q || null,
    p_plan: plan || null,
    p_status: status || null,
    p_limit: PAGE_SIZE,
    p_offset: (page - 1) * PAGE_SIZE,
  });
  const res = (data ?? { rows: [], total: 0 }) as { rows: Row[]; total: number };
  const rows = res.rows ?? [];
  const total = res.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const qs = (p: number) => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (plan) u.set("plan", plan);
    if (status) u.set("status", status);
    if (p > 1) u.set("page", String(p));
    const s = u.toString();
    return s ? `?${s}` : "";
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-foreground text-2xl font-extrabold tracking-tight">Clients</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {total} compte{total > 1 ? "s" : ""} — recherche, filtres, actions.
        </p>
      </div>

      {/* Filtres */}
      <form className="border-border bg-surface shadow-card flex flex-wrap items-end gap-3 rounded-2xl border p-4">
        <div className="min-w-[200px] flex-1">
          <label className="text-muted-foreground text-xs font-medium">Recherche (email / nom)</label>
          <input
            name="q"
            defaultValue={q}
            placeholder="email ou nom…"
            className="border-border bg-input focus:border-primary mt-1 min-h-[42px] w-full rounded-lg border px-3 text-sm outline-none"
          />
        </div>
        <div>
          <label className="text-muted-foreground text-xs font-medium">Offre</label>
          <select name="plan" defaultValue={plan} className="border-border bg-input mt-1 min-h-[42px] rounded-lg border px-3 text-sm outline-none">
            <option value="">Toutes</option>
            <option value="free">Gratuit</option>
            <option value="starter">Starter</option>
            <option value="pro">Pro</option>
            <option value="business">Business</option>
          </select>
        </div>
        <div>
          <label className="text-muted-foreground text-xs font-medium">Statut</label>
          <select name="status" defaultValue={status} className="border-border bg-input mt-1 min-h-[42px] rounded-lg border px-3 text-sm outline-none">
            <option value="">Tous</option>
            <option value="active">Actif</option>
            <option value="expired">Expiré</option>
          </select>
        </div>
        <button className="bg-primary text-primary-foreground inline-flex min-h-[42px] items-center gap-1.5 rounded-lg px-4 text-sm font-semibold">
          <Icon name="search" size={15} /> Filtrer
        </button>
      </form>

      {/* Table */}
      <div className="border-border bg-surface shadow-card overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="border-border text-muted-foreground border-b text-left text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 font-semibold">Client</th>
              <th className="px-4 py-3 font-semibold">Offre</th>
              <th className="px-4 py-3 font-semibold">Statut</th>
              <th className="px-4 py-3 text-right font-semibold">Solde</th>
              <th className="px-4 py-3 text-right font-semibold">Rech. / Tests</th>
              <th className="px-4 py-3 text-right font-semibold">CA généré</th>
              <th className="px-4 py-3 font-semibold">Inscrit</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-muted-foreground px-4 py-10 text-center">
                  Aucun client.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.user_id} className="hover:bg-input/50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/admin/clients/${r.user_id}`} className="block">
                      <span className="text-foreground font-medium">
                        {r.email ?? r.nom ?? "—"}
                      </span>
                      {r.suspended && (
                        <span className="bg-danger-bg text-danger ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                          suspendu
                        </span>
                      )}
                      {r.nom && r.email && (
                        <span className="text-muted-foreground block text-xs">{r.nom}</span>
                      )}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${planBadge(r.plan)}`}>
                      {planLabel(r.plan)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-medium ${
                        r.status === "active" ? "text-success" : "text-muted-foreground"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{nf(r.credits_balance)}</td>
                  <td className="text-muted-foreground px-4 py-3 text-right tabular-nums">
                    {r.searches_count} / {r.tests_count}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {r.has_ever_paid ? fcfa(r.ca_genere) : "—"}
                  </td>
                  <td className="text-muted-foreground px-4 py-3 text-xs">
                    {new Date(r.created_at).toLocaleDateString("fr-FR")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            Page {page} / {pages}
          </p>
          <div className="flex gap-2">
            <PagerLink href={qs(page - 1)} disabled={page <= 1} label="Précédent" />
            <PagerLink href={qs(page + 1)} disabled={page >= pages} label="Suivant" />
          </div>
        </div>
      )}
    </div>
  );
}

function PagerLink({
  href,
  disabled,
  label,
}: {
  href: string;
  disabled: boolean;
  label: string;
}) {
  if (disabled) {
    return (
      <span className="border-border text-muted-foreground/50 cursor-default rounded-lg border px-4 py-2 text-sm">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={`/admin/clients${href}`}
      className="border-border text-foreground hover:bg-input rounded-lg border px-4 py-2 text-sm font-medium"
    >
      {label}
    </Link>
  );
}
