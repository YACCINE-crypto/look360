import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

/* eslint-disable @next/next/no-img-element */

/**
 * Écran « compte suspendu ». Hors du groupe (app) pour éviter la boucle de
 * redirection. On confirme la suspension en base avant d'afficher.
 */
export default async function SuspenduPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub as string | undefined;
  if (!uid) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("suspended")
    .eq("id", uid)
    .maybeSingle();

  // Plus suspendu → on renvoie dans l'app.
  if (!profile?.suspended) redirect("/recherche");

  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm text-center">
        <img src="/look360-logo.svg" alt="Look360" className="mx-auto mb-6 h-10 w-auto" />
        <span className="bg-danger-bg text-danger mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl">
          <Icon name="lock" size={26} />
        </span>
        <h1 className="text-foreground text-xl font-bold">Compte suspendu</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          L&apos;accès à ton compte est temporairement suspendu. Pour toute
          question, contacte le support.
        </p>
        <a
          href="mailto:look360app@gmail.com"
          className="bg-primary text-primary-foreground mt-5 inline-flex min-h-[46px] items-center justify-center rounded-full px-6 text-sm font-semibold"
        >
          Contacter le support
        </a>
        <form action={logout} className="mt-3">
          <button className="text-muted-foreground hover:text-foreground text-sm">
            Se déconnecter
          </button>
        </form>
      </div>
    </main>
  );
}
