import { redirect } from "next/navigation";

export default function Home() {
  // L'app démarre sur la page Recherche (le proxy protège déjà la route).
  redirect("/recherche");
}
