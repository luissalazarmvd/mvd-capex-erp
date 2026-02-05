// src/app/(planta)/layout.tsx
import Image from "next/image";
import Link from "next/link";
import PlantaTopNav from "../../components/planta/PlantaTopNav";

export default function PlantaLayout({ children }: { children: React.ReactNode }) {
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
                href="/guardia"
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
                <div style={{ fontSize: 20, fontWeight: 800 }}>MVD – PLANTA</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  Guardia · Producción · Relave · Reactivos · Bolas · Duración
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
            <PlantaTopNav />
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
