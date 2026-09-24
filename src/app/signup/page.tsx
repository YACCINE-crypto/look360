import { redirect } from "next/navigation";

// La page d'auth unifiée est /login (onglets Connexion / Inscription).
// /signup pointe vers l'onglet Inscription pour garder un seul design partout.
export default function SignupPage() {
  redirect("/login?tab=signup");
}
