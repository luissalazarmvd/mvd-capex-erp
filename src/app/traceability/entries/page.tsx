// src/app/traceability/entries/page.tsx
import TraceabilityEntryForm from "../../../components/traceability/TraceabilityEntryForm";

export default function TraceabilityEntriesPage() {
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
      <TraceabilityEntryForm />
    </div>
  );
}