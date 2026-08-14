// src/app/traceability/conta/page.tsx
import TraceabilityContaForm from "../../../components/traceability/TraceabilityContaForm";

export default function TraceabilityContaPage() {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: "100%",
        height: "calc(100vh - 140px)",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <TraceabilityContaForm />
    </div>
  );
}
