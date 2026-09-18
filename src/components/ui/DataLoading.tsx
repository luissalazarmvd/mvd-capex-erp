"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { getInflightPaths, subscribeInflight } from "../../lib/apiClient";
import { VaiLogo } from "./VaiLogo";

// Overlay global de carga: mismo formato que el de V-Ai (`.vai-data-loading`
// en globals.css) pero alimentado por las lecturas en curso de `apiGet`, de
// modo que cualquier módulo muestra el logo mientras consulta endpoints.
// V-Ai conserva su overlay propio (sabe qué fuentes consulta) y TI su formato.
const EXCLUDED_PREFIXES = ["/vai", "/ti"];
// Evita el parpadeo en consultas que responden casi al instante.
const SHOW_DELAY_MS = 150;
const NO_PATHS: string[] = [];

function sourceLabel(path: string) {
  return path.replace(/^\/api\//, "").replace(/\?.*$/, "");
}

export function DataLoading() {
  const pathname = usePathname();
  const paths = useSyncExternalStore(subscribeInflight, getInflightPaths, () => NO_PATHS);
  const pending = paths.length > 0;
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(() => setShown(true), SHOW_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
      setShown(false);
    };
  }, [pending]);

  const excluded = EXCLUDED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (excluded || !pending || !shown) return null;

  const labels = Array.from(new Set(paths.map(sourceLabel)));

  return (
    <div className="vai-data-loading" role="status" aria-live="polite" aria-busy="true">
      <div className="vai-data-loading-card">
        <div className="vai-data-loading-logo"><VaiLogo size={118} title="Cargando datos" /></div>
        <strong>Cargando datos</strong>
        <span className="muted">
          {labels.length === 1 ? `Consultando ${labels[0]}…` : `Consultando ${labels.length} fuentes…`}
        </span>
        {labels.length > 1 ? (
          <small className="muted" style={{ fontSize: 11, lineHeight: 1.5, textAlign: "center", maxWidth: 460, whiteSpace: "normal", overflowWrap: "anywhere" }}>
            {labels.join(" · ")}
          </small>
        ) : null}
      </div>
    </div>
  );
}
