// src/app/traceability/upload/page.tsx
export default function TraceabilityUploadPage() {
  return (
    <div>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Datos Valorización</h1>

      <p className="muted" style={{ marginTop: 8 }}>
        Próximamente aquí se cargará la información de valorización para trazabilidad.
      </p>

      <div
        className="panel"
        style={{
          marginTop: 16,
          padding: 18,
          borderStyle: "dashed",
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700 }}>Módulo en construcción</div>

        <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>
          Este espacio servirá para subir, revisar o procesar los datos de valorización.
        </p>
      </div>
    </div>
  );
}