// src/app/compliance/downloads/page.tsx
"use client";

import { useState } from "react";
import * as XLSX from "xlsx";

type ComplianceBuyRow = {
  item: any;
  carconta: any;
  sede: any;
  tipo_persona: any;
  tipo_empresa: any;
  subdiario: any;
  comprobante: any;
  numero: any;
  tipo_de_documento: any;
  fecha_de_documento: any;
  ruc: any;
  proveedor: any;
  glosa: any;
  importe_lte: any;
  tipo_de_moneda: any;
  imp_me_lte: any;
  fecha_de_pago_tlc: any;
  monto: any;
  cuenta_bancaria: any;
  cuenta_contable: any;
  asiento_registro: any;
  lote: any;
  cuenta_mvd_bcp: any;
  comprobante_transferencia_bancaria: any;
  cta_proveedor: any;
  importe_total_pagado_usd: any;
  importe_total_de_la_factura: any;
  costo_mineral: any;
  volumen_de_toneladas_tms_adquiridas: any;
  plate: any;
  umbral: any;
  rucodm: any;
  concession_code: any;
  concession_name: any;
  department: any;
  province: any;
  district: any;
  concession_owner: any;
  concession_status: any;
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

export default function ComplianceDownloadsPage() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function downloadBuyExcel() {
    setLoading(true);
    setMsg("");

    try {
      const res = await fetch("/api/compliance/buy", {
        method: "GET",
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "No se pudo descargar la información");
      }

      const rows: ComplianceBuyRow[] = Array.isArray(data?.rows) ? data.rows : [];

      const exportRows = rows.map((r) => ({
        item: r.item ?? "",
        carconta: r.carconta ?? "",
        sede: r.sede ?? "",
        tipo_persona: r.tipo_persona ?? "",
        tipo_empresa: r.tipo_empresa ?? "",
        subdiario: r.subdiario ?? "",
        comprobante: asText(r.comprobante),
        numero: asText(r.numero),
        tipo_de_documento: r.tipo_de_documento ?? "",
        fecha_de_documento: asDate(r.fecha_de_documento),
        ruc: r.ruc ?? "",
        proveedor: r.proveedor ?? "",
        glosa: r.glosa ?? "",
        importe_lte: r.importe_lte ?? "",
        tipo_de_moneda: r.tipo_de_moneda ?? "",
        imp_me_lte: r.imp_me_lte ?? "",
        fecha_de_pago_tlc: asDate(r.fecha_de_pago_tlc),
        monto: r.monto ?? "",
        cuenta_bancaria: r.cuenta_bancaria ?? "",
        cuenta_contable: r.cuenta_contable ?? "",
        asiento_registro: r.asiento_registro ?? "",
        lote: r.lote ?? "",
        cuenta_mvd_bcp: asText(r.cuenta_mvd_bcp),
        comprobante_transferencia_bancaria: r.comprobante_transferencia_bancaria ?? "",
        cta_proveedor: asText(r.cta_proveedor),
        importe_total_pagado_usd: r.importe_total_pagado_usd ?? "",
        importe_total_de_la_factura: r.importe_total_de_la_factura ?? "",
        costo_mineral: r.costo_mineral ?? "",
        volumen_de_toneladas_tms_adquiridas: r.volumen_de_toneladas_tms_adquiridas ?? "",
        plate: r.plate ?? "",
        umbral: r.umbral ?? "",
        rucodm: r.rucodm ?? "",
        concession_code: asText(r.concession_code),
        concession_name: r.concession_name ?? "",
        department: r.department ?? "",
        province: r.province ?? "",
        district: r.district ?? "",
        concession_owner: r.concession_owner ?? "",
        concession_status: r.concession_status ?? "",
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
        "comprobante",
        "numero",
        "cuenta_mvd_bcp",
        "cta_proveedor",
        "concession_code",
      ];

      const dateCols = ["fecha_de_documento", "fecha_de_pago_tlc"];

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

          const raw = exportRows[r - 1]?.[colName as keyof typeof exportRows[number]];
          if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
            cell.t = "d";
            cell.v = raw;
            cell.z = "yyyy-mm-dd";
          }
        }
      }

      ws["!cols"] = [
        { wch: 10 },
        { wch: 12 },
        { wch: 12 },
        { wch: 16 },
        { wch: 16 },
        { wch: 12 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
        { wch: 14 },
        { wch: 15 },
        { wch: 30 },
        { wch: 40 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 20 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
        { wch: 20 },
        { wch: 28 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 },
        { wch: 18 },
        { wch: 20 },
        { wch: 14 },
        { wch: 12 },
        { wch: 14 },
        { wch: 18 },
        { wch: 30 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
        { wch: 24 },
        { wch: 18 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "RO_Compras");
      XLSX.writeFile(wb, "RO_Compras.xlsx", { cellDates: true });
    } catch (e: any) {
      setMsg(String(e?.message || "Error al exportar"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 14 }}>Descargas</div>

      <button
        type="button"
        onClick={downloadBuyExcel}
        disabled={loading}
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          margin: 0,
          color: "var(--primary, #2563eb)",
          textDecoration: "underline",
          cursor: loading ? "default" : "pointer",
          fontSize: 16,
          fontWeight: 700,
        }}
      >
        {loading ? "Descargando..." : "Descargar RO - Compras"}
      </button>

      {msg ? (
        <div style={{ marginTop: 12, color: "#b91c1c", fontWeight: 600 }}>{msg}</div>
      ) : null}
    </div>
  );
}