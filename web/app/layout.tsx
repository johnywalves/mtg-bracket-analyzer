import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const openSans = Open_Sans({ subsets: ["latin"], variable: "--font-open-sans" });

export const metadata: Metadata = {
  title: "Meus Brackets: Analista de Bracket da TCGRP",
  description: "Descubra o nível de poder do seu deck de Commander e o que ajustar nele.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={openSans.variable}>
      <body className="flex min-h-screen flex-col bg-bg font-sans text-fg antialiased">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
