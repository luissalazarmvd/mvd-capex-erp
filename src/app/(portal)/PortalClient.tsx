// src/app/(portal)/PortalClient.tsx
"use client";

import React, { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "../../components/ui/Button";

type Area = "capex" | "planta" | "refinery" | "ti";

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

  function start(areaPick: Area) {
    setErr("");
    setPw("");
    setArea(areaPick);
  }

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
      const url = area === "ti" ? "/api/ti/auth/login" : "/api/auth/login";
      const body = area === "ti" ? { pass } : { area, password: pass };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(body),
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
          : "/ti"
      );
    } catch (e: any) {
      setErr(String(e?.message || "Clave incorrecta"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#0067AC",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "Arial, sans-serif",
        color: "white",
        padding: 16,
      }}
    >
      <div
        style={{
          background: "#004F86",
          padding: 32,
          borderRadius: 8,
          width: 380,
          textAlign: "center",
        }}
      >
        <img src="/logo_mvd.png" alt="Veta Dorada" style={{ height: 58, marginBottom: 18 }} />

        <h2 style={{ margin: "0 0 18px 0", fontWeight: 800 }}>Acceso MVD</h2>

        {!area ? (
          <div style={{ display: "grid", gap: 12 }}>
            <Button type="button" size="lg" variant="primary" onClick={() => start("capex")}>
              Proyectos CAPEX
            </Button>

            <Button type="button" size="lg" variant="primary" onClick={() => start("planta")}>
              Planta
            </Button>

            <Button type="button" size="lg" variant="primary" onClick={() => start("refinery")}>
              Refinería
            </Button>

            <Button type="button" size="lg" variant="primary" onClick={() => start("ti")}>
              Tickets TI
            </Button>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ fontWeight: 800, opacity: 0.9 }}>
              {area === "capex" ? "Clave CAPEX" : area === "planta" ? "Clave Planta" : area === "refinery" ? "Clave Refinería" : "Clave Tickets TI"}
            </div>

            <input
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
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 6,
                border: "none",
                outline: "none",
              }}
            />

            <Button type="button" size="lg" variant="primary" onClick={login} disabled={loading}>
              {loading ? "Validando..." : "Ingresar"}
            </Button>

            <button
              type="button"
              onClick={() => {
                setArea(null);
                setPw("");
                setErr("");
              }}
              style={{
                background: "transparent",
                border: "none",
                color: "#D8EEFF",
                fontWeight: 800,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Volver
            </button>

            {err ? <div style={{ color: "#FFD6D6", fontWeight: 800 }}>{err}</div> : null}
          </div>
        )}
      </div>
    </main>
  );
}
