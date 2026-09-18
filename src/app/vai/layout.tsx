import LogoutLink from "../../components/auth/LogoutLink";
import { VaiLogo } from "../../components/ui/VaiLogo";

export default function VaiLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-module="vai" style={{ minHeight: "100vh", background: "var(--bg)" }}>
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
              <LogoutLink
                aria-label="Inicio"
                title="Inicio"
                style={{
                  height: 44,
                  display: "inline-flex",
                  alignItems: "center",
                  textDecoration: "none",
                }}
              >
                <VaiLogo size={44} />
              </LogoutLink>

              <div className="muted" style={{ fontSize: 12 }}>
                Dashboards inteligentes con los datos de Veta · prototipo
              </div>
            </div>

            <LogoutLink className="nav-pill !text-white visited:!text-white text-lg font-extrabold">
              Inicio
            </LogoutLink>
          </div>
        </div>
      </header>

      <main className="container-fluid" style={{ paddingTop: 16, paddingBottom: 30 }}>
        <section
          className="panel"
          style={{
            padding: 14,
            minHeight: "calc(100vh - 130px)",
          }}
        >
          {children}
        </section>
      </main>
    </div>
  );
}
