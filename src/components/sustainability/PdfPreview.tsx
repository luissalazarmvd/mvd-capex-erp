// src/components/sustainability/PdfPreview.tsx

"use client";

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

type Props = {
  fileData: Uint8Array;
};

export default function PdfPreview({ fileData }: Props) {
    const [numPages, setNumPages] = useState(0);
    const [pageNumber, setPageNumber] = useState(1);
    const [pdfError, setPdfError] = useState<string | null>(null);

  return (
        <div style={{ width: "100%", height: "100%", overflow: "auto", padding: 12 }}>
        <Document
        file={{ data: fileData }}
        onLoadSuccess={({ numPages }) => {
        setNumPages(numPages);
        setPageNumber(1);
        setPdfError(null);
        }}
        onLoadError={(err) => {
        console.error("PDF load error:", err);
        setPdfError(String(err?.message || err || "Error cargando PDF"));
        }}
        >
        {pdfError ? (
        <div style={{ color: "#fff", fontWeight: 800, marginBottom: 12 }}>
            ERROR: {pdfError}
        </div>
        ) : null}

        <Page pageNumber={pageNumber} width={1000} />
      </Document>

      <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
        <button
          type="button"
          disabled={pageNumber <= 1}
          onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
        >
          Anterior
        </button>

        <span>
          Página {pageNumber} de {numPages || 0}
        </span>

        <button
          type="button"
          disabled={!numPages || pageNumber >= numPages}
          onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}