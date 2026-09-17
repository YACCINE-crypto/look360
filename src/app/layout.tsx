import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Look360",
  description: "Recherche & testing produit COD",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${dmSans.variable} h-full antialiased`}>
      <body className="bg-background text-foreground min-h-full">
        {children}
      </body>
    </html>
  );
}
