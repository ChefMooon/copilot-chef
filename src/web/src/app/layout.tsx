import type { Metadata } from "next";
import { Lora, Nunito } from "next/font/google";
import { type PropsWithChildren } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { QueryProvider } from "@/components/providers/query-provider";

import "./globals.css";

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  style: ["normal", "italic"],
  weight: ["400", "600", "700"]
});

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  weight: ["400", "500", "600", "700"]
});

export const metadata: Metadata = {
  title: "Copilot Chef",
  description: "Warm, AI-assisted meal planning with GitHub Copilot."
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <body className={`${lora.variable} ${nunito.variable}`}>
        <QueryProvider>
          <AppShell>{children}</AppShell>
        </QueryProvider>
      </body>
    </html>
  );
}
