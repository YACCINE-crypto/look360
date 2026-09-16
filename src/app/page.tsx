import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "./login/actions";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Le proxy protège déjà cette route, mais on sécurise côté serveur aussi.
  if (!user) {
    redirect("/login");
  }

  // Profil (rôle) — la table est créée par la migration.
  const { data: profile } = await supabase
    .from("profiles")
    .select("nom, role")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Look360</h1>
          <p className="text-sm text-zinc-500">
            Recherche &amp; testing produit COD
          </p>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Déconnexion
          </button>
        </form>
      </header>

      <section className="mt-10 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-medium text-zinc-500">Connecté en tant que</h2>
        <p className="mt-1 text-lg font-medium">{user.email}</p>
        <p className="mt-1 text-sm text-zinc-500">
          Nom : {profile?.nom ?? "—"} · Rôle :{" "}
          <span className="font-medium">{profile?.role ?? "—"}</span>
        </p>
      </section>

      <p className="mt-8 text-sm text-zinc-500">
        Setup terminé ✓ — les pages Recherche et Testing arrivent aux étapes
        suivantes (voir la roadmap §7 du plan).
      </p>
    </main>
  );
}
