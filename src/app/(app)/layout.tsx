import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import { SidebarNav, BottomNav } from "@/components/Nav";
import { Icon } from "@/components/Icon";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("nom, role")
    .eq("id", user.id)
    .maybeSingle();

  const displayName = profile?.nom ?? user.email ?? "Utilisateur";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-full md:flex">
      {/* Sidebar desktop */}
      <aside className="border-border bg-surface sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r p-4 md:flex">
        <div className="flex items-center gap-2 px-2 py-1">
          <span className="bg-primary text-primary-foreground grid h-8 w-8 place-items-center rounded-md text-sm font-bold">
            L
          </span>
          <span className="text-lg font-bold tracking-tight">Look360</span>
        </div>

        <div className="mt-6 flex-1">
          <SidebarNav />
        </div>

        <div className="border-border flex items-center gap-3 border-t pt-4">
          <span className="bg-secondary text-secondary-foreground grid h-9 w-9 place-items-center rounded-full text-xs font-semibold">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{displayName}</p>
            <p className="text-muted-foreground text-xs capitalize">
              {profile?.role ?? "—"}
            </p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              title="Déconnexion"
              className="text-muted-foreground hover:bg-input hover:text-foreground rounded-md p-2 transition-colors"
            >
              <Icon name="logout" size={18} />
            </button>
          </form>
        </div>
      </aside>

      {/* Colonne principale */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar mobile */}
        <header className="border-border bg-surface sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <span className="bg-primary text-primary-foreground grid h-7 w-7 place-items-center rounded-md text-xs font-bold">
              L
            </span>
            <span className="font-bold tracking-tight">Look360</span>
          </div>
          <form action={logout}>
            <button
              type="submit"
              title="Déconnexion"
              className="text-muted-foreground hover:text-foreground rounded-md p-2"
            >
              <Icon name="logout" size={18} />
            </button>
          </form>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 md:px-8 md:pb-10">
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
