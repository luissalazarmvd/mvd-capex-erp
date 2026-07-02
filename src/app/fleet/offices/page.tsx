// src/app/fleet/offices/page.tsx
import FleetOffForm from "../../../components/fleet/FleetOffForm";

export default function FleetOfficesPage() {
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
      <FleetOffForm />
    </div>
  );
}