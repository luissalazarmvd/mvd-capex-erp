// src/app/fleet/mgmt/page.tsx
import FleetMgmForm from "../../../components/fleet/FleetMgmForm";

export default function FleetMgmtPage() {
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
      <FleetMgmForm />
    </div>
  );
}