// src/components/compliance/ComplianceTraceabilityExp.tsx
"use client";

import React, { useState } from "react";
import * as XLSX from "xlsx";
import { apiGet } from "../../lib/apiClient";
import { Button } from "../ui/Button";

type TraceabilityRow = {
  lot: any;
  entry_date: any;
  process_date: any;
  sack_qty: any;
  miner_name: any;
  plate: any;
  ruc: any;
  concession_name: any;
  concession_code: any;
  district: any;
  province: any;
  department: any;
  sender_guide_number: any;
  transport_name: any;
  transport_guide_number: any;
  zone_1: any;
  zone_2: any;
  tmh: any;
  h2o: any;
  tms: any;
  au_grade_oztc: any;
  ag_grade_oztc: any;
  cu_grade_pct: any;
  au_oz: any;
  ag_oz: any;
  au_rec: any;
  ag_rec: any;
  pio: any;
  pio_disc: any;
  maquila: any;
  nacn: any;
  escalador: any;
  usd_tms: any;
  au_usd: any;
  ag_usd: any;
  pay_type: any;
  monto_calc: any;
  dif_rc: any;
  lot_usd: any;
  doc_date: any;
  doc_number: any;
};

type TraceabilityResp = {
  ok: boolean;
  rows?: TraceabilityRow[];
  count?: number;
  error?: string;
};

type Props = {
  setMsgAction: React.Dispatch<React.SetStateAction<string | null>>;
  disabled?: boolean;
};

function asText(value: any) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function asDate(value: any) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d;
}

export default function ComplianceTraceabilityExp({
  setMsgAction,
  disabled = false,
}: Props) {
  const [loading, setLoading] = useState(false);

  async function downloadTraceabilityExcel() {
    setLoading(true);
    setMsgAction(null);

    try {
      const data = (await apiGet("/api/traceability")) as TraceabilityResp;

      if (!data?.ok) {
        throw new Error(data?.error || "No se pudo descargar la trazabilidad");
      }

      const rows: TraceabilityRow[] = Array.isArray(data?.rows) ? data.rows : [];

      const exportRows = rows.map((r) => ({
        lot: asText(r.lot),
        entry_date: asDate(r.entry_date),
        process_date: asDate(r.process_date),
        sack_qty: r.sack_qty ?? "",
        miner_name: r.miner_name ?? "",
        plate: r.plate ?? "",
        ruc: asText(r.ruc),
        concession_name: r.concession_name ?? "",
        concession_code: asText(r.concession_code),
        district: r.district ?? "",
        province: r.province ?? "",
        department: r.department ?? "",
        sender_guide_number: asText(r.sender_guide_number),
        transport_name: r.transport_name ?? "",
        transport_guide_number: asText(r.transport_guide_number),
        zone_1: r.zone_1 ?? "",
        zone_2: r.zone_2 ?? "",
        tmh: r.tmh ?? "",
        h2o: r.h2o ?? "",
        tms: r.tms ?? "",
        au_grade_oztc: r.au_grade_oztc ?? "",
        ag_grade_oztc: r.ag_grade_oztc ?? "",
        cu_grade_pct: r.cu_grade_pct ?? "",
        au_oz: r.au_oz ?? "",
        ag_oz: r.ag_oz ?? "",
        au_rec: r.au_rec ?? "",
        ag_rec: r.ag_rec ?? "",
        pio: r.pio ?? "",
        pio_disc: r.pio_disc ?? "",
        maquila: r.maquila ?? "",
        nacn: r.nacn ?? "",
        escalador: r.escalador ?? "",
        usd_tms: r.usd_tms ?? "",
        au_usd: r.au_usd ?? "",
        ag_usd: r.ag_usd ?? "",
        pay_type: r.pay_type ?? "",
        monto_calc: r.monto_calc ?? "",
        dif_rc: r.dif_rc ?? "",
        lot_usd: r.lot_usd ?? "",
        doc_date: asDate(r.doc_date),
        doc_number: asText(r.doc_number),
      }));

      const ws = XLSX.utils.json_to_sheet(exportRows);
      const range = XLSX.utils.decode_range(ws["!ref"] || "A1");

      const headerMap: Record<string, number> = {};
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r: 0, c });
        const cell = ws[addr];
        if (cell?.v) headerMap[String(cell.v)] = c;
      }

      const textCols = [
        "lot",
        "ruc",
        "concession_code",
        "sender_guide_number",
        "transport_guide_number",
        "doc_number",
      ];

      const dateCols = ["entry_date", "process_date", "doc_date"];

      for (let r = 1; r <= range.e.r; r++) {
        for (const colName of textCols) {
          const c = headerMap[colName];
          if (c === undefined) continue;

          const addr = XLSX.utils.encode_cell({ r, c });
          const cell = ws[addr];
          if (!cell) continue;

          cell.t = "s";
          cell.v = asText(cell.v);
          delete cell.z;
        }

        for (const colName of dateCols) {
          const c = headerMap[colName];
          if (c === undefined) continue;

          const addr = XLSX.utils.encode_cell({ r, c });
          const cell = ws[addr];
          if (!cell) continue;

          const raw = exportRows[r - 1]?.[colName as keyof (typeof exportRows)[number]];
          if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
            cell.t = "d";
            cell.v = raw;
            cell.z = "yyyy-mm-dd";
          }
        }
      }

      ws["!cols"] = [
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 10 },
        { wch: 28 },
        { wch: 14 },
        { wch: 16 },
        { wch: 30 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
        { wch: 22 },
        { wch: 24 },
        { wch: 22 },
        { wch: 14 },
        { wch: 14 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 14 },
        { wch: 14 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 16 },
        { wch: 14 },
        { wch: 14 },
        { wch: 16 },
        { wch: 18 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Trazabilidad");
      XLSX.writeFile(wb, "Trazabilidad.xlsx", { cellDates: true });
    } catch (e: any) {
      setMsgAction(String(e?.message || "No se pudo descargar la trazabilidad"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      size="md"
      variant="default"
      onClick={downloadTraceabilityExcel}
      disabled={disabled || loading}
    >
      {loading ? "Descargando..." : "Descargar Trazabilidad"}
    </Button>
  );
}