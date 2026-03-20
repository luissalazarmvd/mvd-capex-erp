// src/app/traceability/summary/page.tsx
export default function TraceabilitySummaryPage() {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="panel-inner" style={{ padding: "14px 16px" }}>
        <div style={{ fontSize: 18, fontWeight: 900 }}>Resumen de Trazabilidad</div>
        <div className="muted" style={{ marginTop: 4 }}>
          Futuro dashboard con indicadores clave de trazabilidad.
        </div>
      </div>
    </div>
  );
}