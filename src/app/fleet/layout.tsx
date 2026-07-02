// src/app/fleet/layout.tsx
import Image from "next/image";
import Link from "next/link";

function FleetTopNav() {
  return (
    <nav style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <Link
        href="/fleet/offices"
        prefetch={false}
        className="nav-pill !text-white visited:!text-white text-sm font-extrabold"
      >
        Oficinas
      </Link>

      <Link
        href="/fleet/mgmt"
        prefetch={false}
        className="nav-pill !text-white visited:!text-white text-sm font-extrabold"
      >
        Gestión
      </Link>
    </nav>
  );
}

export default function FleetLayout({ children }: { children: React.ReactNode }) {
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
                aria-label="Inicio"
                title="Inicio"
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
                <div style={{ fontSize: 20, fontWeight: 800 }}>MVD – FLOTA</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  Oficinas · Gestión de Flota
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

          <div style={{ marginTop: 12 }}>
            <FleetTopNav />
          </div>
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