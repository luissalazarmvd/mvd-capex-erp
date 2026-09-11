import TRJKardexSum from "../../../components/trj-kardex/TRJKardexSum";

export default function TRJKardexSumPage() {
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
      <TRJKardexSum />
    </div>
  );
}
