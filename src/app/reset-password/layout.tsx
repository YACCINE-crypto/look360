import type { Viewport } from "next";

// Barre du navigateur mobile assortie au fond navy (--night) des pages compte.
export const viewport: Viewport = { themeColor: "#08111f" };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
