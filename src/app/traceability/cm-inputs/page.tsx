import TraceabilityCmInputsForm from "../../../components/traceability/TraceabilityCmInputsForm";

export default function TraceabilityCmInputsPage() {
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
      <TraceabilityCmInputsForm />
    </div>
  );
}
