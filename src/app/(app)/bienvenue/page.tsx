import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Ancien écran de bienvenue (affiché en dur). L'accueil est désormais une
 * fenêtre d'onboarding (1re connexion) ouverte par-dessus le feed.
 */
export default function BienvenuePage() {
  redirect("/recherche");
}
