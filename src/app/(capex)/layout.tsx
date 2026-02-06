// src/app/(capex)/layout.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/projects", label: "Proyectos" },
  { href: "/budget", label: "Budget" },
  { href: "/forecast", label: "Forecast" },
  { href: "/progress", label: "EV / AC" },
  { href: "/reports", label: "Reportes" },
];

export default function CapexLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <header
        style={{
          background: "var(--header)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="container-fluid" style={{ paddingTop: 14, paddingBottom: 14 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <Link
                href="/"
                prefetch={false}
                aria-label="MVD"
                title="MVD"
                style={{
                  width: 130,
                  height: 44,
                  position: "relative",
                  display: "block",
                  textDecoration: "none",
                }}
              >
                <Image
                  src="/logo_mvd.png"
                  alt="MVD"
                  fill
                  priority
                  style={{ objectFit: "contain" }}
                  sizes="130px"
                />
              </Link>

              <div style={{ lineHeight: 1.1 }}>
                <div style={{ fontSize: 20, fontWeight: 800 }}>MVD – CAPEX ERP</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  Presupuesto · Forecast · EV · Actuals
                </div>
              </div>
            </div>

            <Link
              href="/"
              prefetch={false}
              className="nav-pill !text-white visited:!text-white text-lg font-extrabold"
            >
              Inicio
            </Link>
          </div>

          <nav style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            {NAV.map((n) => {
              const active = pathname === n.href;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className="nav-pill !text-white visited:!text-white text-lg font-extrabold"
                  prefetch={false}
                  style={
                    active
                      ? {
                          outline: "none",
                          opacity: 0.72,
                        }
                      : undefined
                  }
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="container-fluid" style={{ paddingTop: 16, paddingBottom: 30 }}>
        <section
          className="panel"
          style={{
            padding: 14,
            minHeight: "calc(100vh - 160px)",
          }}
        >
          {children}
        </section>
      </main>
    </div>
  );
}
