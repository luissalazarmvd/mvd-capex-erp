import TraceabilityStatusForm from "../../../components/traceability/TraceabilityStatusForm";

export default function TraceabilitySummaryPage() {
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
      <TraceabilityStatusForm />
    </div>
  );
}