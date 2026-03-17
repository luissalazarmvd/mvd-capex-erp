// src/app/traceability/summary/page.tsx
export default function TraceabilitySummaryPage() {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="panel-inner" style={{ padding: "14px 16px" }}>
        <div style={{ fontSize: 18, fontWeight: 900 }}>Resumen de Trazabilidad</div>
        <div className="muted" style={{ marginTop: 4 }}>
          Placeholder temporal
        </div>
      </div>

      <div className="panel-inner" style={{ padding: "18px 16px" }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Módulo en construcción</div>
        <div className="muted">
          Aquí luego irá el resumen consolidado de trazabilidad.
        </div>
      </div>
    </div>
  );
}