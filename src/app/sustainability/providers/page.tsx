// src/app/sustainability/providers/page.tsx
import SustainabilityProvTable from "../../../components/sustainability/SustainabilityProvTable";

export default function SustainabilityProvidersPage() {
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
        <SustainabilityProvTable />
      </div>
    </div>
  );
}