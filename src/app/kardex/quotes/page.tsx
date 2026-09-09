import TRJKardexQuotes from "../../../components/trj-kardex/TRJKardexQuotes";

export default function TRJKardexQuotesPage() {
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
      <TRJKardexQuotes />
    </div>
  );
}
