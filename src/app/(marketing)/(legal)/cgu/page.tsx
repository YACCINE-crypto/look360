import { permanentRedirect } from "next/navigation";

/** Ancienne adresse des CGU : les conditions vivent désormais sur /conditions. */
export default function CguPage() {
  permanentRedirect("/conditions");
}
