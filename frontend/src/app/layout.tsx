import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KeurMayata · Mode, beauté et maison",
  description: "Découvrez la sélection KeurMayata : mode, beauté et maison. Livraison ou retrait à Dakar, Touba et Tambacounda.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body id="haut-de-page" className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
