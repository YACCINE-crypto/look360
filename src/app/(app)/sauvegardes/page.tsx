import { redirect } from "next/navigation";

// Les pubs sauvegardées sont désormais un onglet de « Mes produits ».
export default function SauvegardesPage() {
  redirect("/produits?tab=sauvegardes");
}
