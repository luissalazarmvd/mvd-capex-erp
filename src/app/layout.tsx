// src/app/layout.tsx
import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const exo = localFont({
  variable: "--font-exo",
  display: "swap",
  src: [
    { path: "./fonts/Exo-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/Exo-Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/Exo-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "./fonts/Exo-Bold.ttf", weight: "700", style: "normal" },
    { path: "./fonts/Exo-ExtraBold.ttf", weight: "800", style: "normal" },
    { path: "./fonts/Exo-Black.ttf", weight: "900", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: {
    default: "MVD – ERP",
    template: "%s · MVD",
  },
  description: "CAPEX · Planta · Reportes",
  metadataBase: new URL("https://mvd-capex-erp.vercel.app"),
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={exo.variable}>{children}</body>
    </html>
  );
}
