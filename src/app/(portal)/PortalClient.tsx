// src/app/(portal)/PortalClient.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "../../components/ui/Button";

type Area =
  | "capex"
  | "planta"
  | "refinery"
  | "ti"
  | "traceability"
  | "compliance"
  | "logistics"
  | "sustainability"
  | "fixassets"
  | "fleet"
  | "trj_kardex";

// Mismo orden y mismas etiquetas de siempre. El acento replica el de
// [data-module="…"] en globals.css: cada módulo se reconoce por su color
// desde el portal.
const AREAS: Array<{ key: Area; label: string; passwordLabel: string; accent: string }> = [
  { key: "capex", label: "Proyectos CAPEX", passwordLabel: "Clave CAPEX", accent: "#1b93e3" },
  { key: "planta", label: "Planta", passwordLabel: "Clave Planta", accent: "#79993a" },
  { key: "refinery", label: "Refinería", passwordLabel: "Clave Refinería", accent: "#ffb71b" },
  { key: "traceability", label: "Trazabilidad", passwordLabel: "Clave Trazabilidad", accent: "#a669a6" },
  { key: "trj_kardex", label: "Kardex TRJ", passwordLabel: "Clave Kardex TRJ", accent: "#00a5ce" },
  { key: "compliance", label: "Compliance", passwordLabel: "Clave Compliance", accent: "#969795" },
  { key: "logistics", label: "Logística", passwordLabel: "Clave Logistics", accent: "#d85d27" },
  { key: "fleet", label: "Flota", passwordLabel: "Clave Flota", accent: "#71bdcd" },
  { key: "fixassets", label: "Activos Fijos y Depreciación", passwordLabel: "Clave Activos Fijos y Depreciación", accent: "#c69214" },
  { key: "sustainability", label: "Sostenibilidad", passwordLabel: "Clave Sustainability", accent: "#93b25c" },
  { key: "ti", label: "Eficiencia Operacional TI", passwordLabel: "Clave Eficiencia Operacional TI", accent: "#6b6b68" },
];

export default function PortalClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextPath = useMemo(() => {
    const n = sp.get("next");
    return n && n.startsWith("/") ? n : null;
  }, [sp]);

  const [area, setArea] = useState<Area | null>(null);
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [hasInternalAccess, setHasInternalAccess] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);

  const selected = useMemo(
    () => AREAS.find((item) => item.key === area) || null,
    [area]
  );

  function start(areaPick: Area) {
    if (!hasInternalAccess) return;
    setErr("");
    setPw("");
    setArea(areaPick);
  }

  useEffect(() => {
    let alive = true;

    async function checkAccess() {
      setCheckingAccess(true);
      try {
        const res = await fetch("https://MVDLMPRDAT01.dgm.pe:3443/api/access-check", {
          method: "GET",
          cache: "no-store",
        });

        if (!alive) return;
        setHasInternalAccess(res.ok);
      } catch {
        if (!alive) return;
        setHasInternalAccess(false);
      } finally {
        if (!alive) return;
        setCheckingAccess(false);
      }
    }

    checkAccess();

    return () => {
      alive = false;
    };
  }, []);

  async function login() {
    setErr("");
    if (!area) return;

    const pass = pw.trim();
    if (!pass) {
      setErr("Ingresa la clave");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ area, password: pass }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Error");

      if (nextPath) {
        router.push(nextPath);
        return;
      }

      router.push(
        area === "capex"
          ? "/projects"
          : area === "planta"
          ? "/planta/guardia"
          : area === "refinery"
          ? "/refinery/campaign"
          : area === "traceability"
          ? "/traceability/entries"
          : area === "compliance"
          ? "/compliance/downloads"
          : area === "logistics"
          ? "/logistics/downloads"
          : area === "sustainability"
          ? "/sustainability/igafom"
          : area === "fixassets"
          ? "/fixassets/new"
          : area === "fleet"
          ? j?.defaultPath || "/fleet/mgmt"
          : area === "trj_kardex"
          ? j?.defaultPath || "/kardex/guides"
          : "/ti"
      );
    } catch (error: unknown) {
      setErr(error instanceof Error ? error.message : "Clave incorrecta");
    } finally {
      setLoading(false);
    }
  }

  const statusText = checkingAccess
    ? "Validando acceso corporativo…"
    : hasInternalAccess
    ? "Acceso corporativo detectado"
    : "Conéctate a la red/VPN corporativa y usa equipo autorizado";

  const statusTone = checkingAccess
    ? "var(--ink-3)"
    : hasInternalAccess
    ? "var(--ok)"
    : "var(--bad)";

  return (
    <main className="vd-portal">
      <div className="vd-portal-shell">
        <header className="vd-portal-head">
          <Image
            src="/logo_mvd.png"
            alt="Veta Dorada"
            width={171}
            height={58}
            priority
            style={{ width: "auto", height: 52 }}
          />

          <div>
            <h1>Acceso MVD</h1>
            <p style={{ color: statusTone }}>
              <span className="vd-portal-dot" style={{ background: statusTone }} />
              {statusText}
            </p>
          </div>
        </header>

        {!selected ? (
          <nav className="vd-portal-grid" aria-label="Módulos">
            {AREAS.map((item) => (
              <button
                key={item.key}
                type="button"
                className="vd-portal-tile"
                style={{ ["--tile" as string]: item.accent }}
                onClick={() => start(item.key)}
                disabled={checkingAccess || !hasInternalAccess}
              >
                <span className="vd-portal-rail" />
                <span className="vd-portal-label">{item.label}</span>
              </button>
            ))}
          </nav>
        ) : (
          <section
            className="vd-portal-auth"
            style={{ ["--tile" as string]: selected.accent }}
          >
            <div className="vd-portal-auth-head">
              <span className="vd-portal-rail" />
              <span>{selected.label}</span>
            </div>

            <label className="vd-portal-field">
              <span>{selected.passwordLabel}</span>
              <input
                className="input"
                type="password"
                value={pw}
                placeholder="Ingresa la clave"
                onChange={(e) => setPw(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") login();
                  if (e.key === "Escape") {
                    setArea(null);
                    setPw("");
                    setErr("");
                  }
                }}
                autoFocus
              />
            </label>

            <Button type="button" size="lg" variant="primary" onClick={login} disabled={loading}>
              {loading ? "Validando…" : "Ingresar"}
            </Button>

            <button
              type="button"
              className="vd-portal-back"
              onClick={() => {
                setArea(null);
                setPw("");
                setErr("");
              }}
            >
              Volver a los módulos
            </button>

            {err ? <div className="vd-portal-err">{err}</div> : null}
          </section>
        )}
      </div>
    </main>
  );
}
