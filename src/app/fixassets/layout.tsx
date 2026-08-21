"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutLink from "../../components/auth/LogoutLink";

const NAV = [
  { href: "/fixassets/new", label: "Nuevos activos" },
  { href: "/fixassets/catalogue", label: "Catálogo" },
  { href: "/fixassets/depreciation", label: "Depreciación" },
  { href: "/fixassets/export", label: "Exportar" },
];

export default function FixAssetsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <header style={{ background: "var(--header)", borderBottom: "1px solid var(--border)" }}>
        <div className="container-fluid" style={{ paddingTop: 14, paddingBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <LogoutLink aria-label="Inicio" title="Inicio" style={{ width: 130, height: 44, position: "relative", display: "block", textDecoration: "none" }}>
                <Image src="/logo_mvd.png" alt="MVD" fill priority style={{ objectFit: "contain" }} sizes="130px" />
              </LogoutLink>
              <div style={{ lineHeight: 1.1 }}>
                <div style={{ fontSize: 20, fontWeight: 800 }}>MVD – ACTIVOS FIJOS</div>
                <div className="muted" style={{ fontSize: 12 }}>Altas · Catálogo · Depreciación · Exportación</div>
              </div>
            </div>
            <LogoutLink className="nav-pill !text-white visited:!text-white text-lg font-extrabold">Inicio</LogoutLink>
          </div>
          <nav style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            {NAV.map((item) => <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className="nav-pill !text-white visited:!text-white text-lg font-extrabold"
              style={pathname === item.href ? { opacity: 0.72 } : undefined}
            >{item.label}</Link>)}
          </nav>
        </div>
      </header>
      <main className="container-fluid" style={{ paddingTop: 16, paddingBottom: 30 }}>
        <section className="panel" style={{ padding: 14, minHeight: "calc(100vh - 160px)" }}>{children}</section>
      </main>
    </div>
  );
}
