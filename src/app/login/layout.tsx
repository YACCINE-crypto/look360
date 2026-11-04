import type { Metadata, Viewport } from "next";

export const metadata: Metadata = { title: "Connexion · Look360" };
// Barre du navigateur mobile assortie au fond navy (--night) des pages compte.
export const viewport: Viewport = { themeColor: "#08111f" };

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
