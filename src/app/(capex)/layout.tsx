// src/app/(capex)/layout.tsx
import "@/styles/globals.css";
import Link from "next/link";

const NAV = [
  { href: "/projects", label: "Proyectos" },
  { href: "/budget", label: "Budget" },
  { href: "/forecast", label: "Forecast" },
  { href: "/progress", label: "EV / AC" },
  { href: "/reports", label: "Reportes" },
];

export default function CapexLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Topbar */}
      <header
        style={{
          background: "var(--header)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="container-max" style={{ padding: "14px 18px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 14,
            }}
          >
            {/* Left: Brand + Title */}
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "rgba(255,255,255,.10)",
                  border: "1px solid var(--border)",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 800,
                  letterSpacing: 0.5,
                }}
                aria-label="MVD"
                title="MVD"
              >
                MVD
              </div>

              <div style={{ lineHeight: 1.1 }}>
                <div style={{ fontSize: 20, fontWeight: 800 }}>
                  MVD – CAPEX ERP
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  Presupuesto · Forecast · EV · Actuals
                </div>
              </div>
            </div>

            {/* Right: Actions */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn btn-ghost" type="button">
                Actualizar
              </button>
              <button className="btn btn-ghost" type="button">
                Exportar Excel
              </button>
              <button className="btn btn-primary" type="button">
                Cerrar sesión
              </button>
            </div>
          </div>

          {/* Nav */}
          <nav
            style={{
              marginTop: 12,
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="nav-pill"
                prefetch={false}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* Body */}
      <main className="container-max" style={{ padding: "16px 18px 30px" }}>
        <section className="panel" style={{ padding: 14 }}>
          {children}
        </section>
      </main>

      {/* Inline minimal styles for buttons/pills (para no depender aún de ui/) */}
      <style jsx global>{`
        .btn {
          border-radius: 12px;
          padding: 10px 14px;
          border: 1px solid var(--border);
          color: var(--text);
          background: rgba(0, 0, 0, 0.12);
          cursor: pointer;
          font-weight: 700;
          letter-spacing: 0.2px;
        }
        .btn:hover {
          border-color: rgba(102, 199, 255, 0.7);
          background: rgba(0, 0, 0, 0.18);
        }
        .btn-primary {
          background: rgba(102, 199, 255, 0.22);
          border-color: rgba(102, 199, 255, 0.55);
        }
        .btn-primary:hover {
          background: rgba(102, 199, 255, 0.28);
          border-color: rgba(102, 199, 255, 0.75);
        }
        .btn-ghost {
          background: rgba(255, 255, 255, 0.08);
        }
        .nav-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-radius: 999px;
          padding: 8px 12px;
          border: 1px solid var(--border);
          background: rgba(0, 0, 0, 0.12);
          color: var(--text);
          text-decoration: none;
          font-weight: 700;
          font-size: 13px;
        }
        .nav-pill:hover {
          border-color: rgba(102, 199, 255, 0.75);
          background: rgba(0, 0, 0, 0.18);
        }
      `}</style>
    </div>
  );
}
