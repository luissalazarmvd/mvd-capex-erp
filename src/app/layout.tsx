// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
