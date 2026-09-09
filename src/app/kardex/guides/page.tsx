import TRJKardexGuides from "../../../components/trj-kardex/TRJKardexGuides";

export default function TRJKardexGuidesPage() {
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
      <TRJKardexGuides />
    </div>
  );
}
