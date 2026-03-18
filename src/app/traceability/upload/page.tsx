// src/app/traceability/upload/page.tsx
import TraceabilityComerForm from "../../../components/traceability/TraceabilityComerForm";

export default function TraceabilityUploadPage() {
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
      <TraceabilityComerForm />
    </div>
  );
}