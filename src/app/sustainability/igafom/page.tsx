// src/app/sustainability/igafom/page.tsx
import SustainabilityIGAFOMTable from "../../../components/sustainability/SustainabilityIGAFOMTable";

export default function SustainabilityIGAFOMPage() {
  return (
    <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
      <div
        style={{
          width: "100%",
          maxWidth: "100%",
          height: "calc(100vh - 140px)",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <SustainabilityIGAFOMTable />
      </div>
    </div>
  );
}