// src/app/compliance/downloads/page.tsx
"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { apiGet } from "../../../lib/apiClient";

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

type ComplianceBuyResp = {
  ok: boolean;
  rows?: ComplianceBuyRow[];
  count?: number;
  error?: string;
};

type ComplianceSellRow = {
  item: any;
  carconta: any;
  ruc_emisor_cp: any;
  fecha_cp: any;
  numero_cp: any;
  tipo_id: any;
  numero_id: any;
  nombres_razon_social: any;
  importe_factura: any;
  carconta_modificador: any;
  fecha_cp_modificador: any;
  numero_cp_modificador: any;
  importe_cred_debit: any;
  total_venta: any;
  carconta_primer_pago: any;
  fecha_primer_pago: any;
  importe_primer_pago: any;
  subsidiario_registro_primer_pago: any;
  carconta_segundo_pago: any;
  fecha_segundo_pago: any;
  importe_segundo_pago: any;
  subsidiario_registro_segundo_pago: any;
  carconta_tercer_pago: any;
  otros_pagos: any;
  importe: any;
  subsidiario_registro: any;
  cuenta_mvd_scotia: any;
  comprobante_transferencia_bancaria: any;
  cta_cliente: any;
  importe_total_vendido_usd: any;
  updated_at: any;
};

type ComplianceSellResp = {
  ok: boolean;
  rows?: ComplianceSellRow[];
  count?: number;
  error?: string;
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
      const data = (await apiGet("/api/compliance/buy")) as ComplianceBuyResp;

      if (!data?.ok) {
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

          const raw = exportRows[r - 1]?.[colName as keyof (typeof exportRows)[number]];
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
      setMsg(String(e?.message || "No se pudo descargar la información"));
    } finally {
      setLoading(false);
    }
  }

  async function downloadSellExcel() {
    setLoading(true);
    setMsg("");

    try {
      const data = (await apiGet("/api/compliance/sell")) as ComplianceSellResp;

      if (!data?.ok) {
        throw new Error(data?.error || "No se pudo descargar la información");
      }

      const rows: ComplianceSellRow[] = Array.isArray(data?.rows) ? data.rows : [];

      const exportRows = rows.map((r) => ({
        item: r.item ?? "",
        carconta: asText(r.carconta),
        ruc_emisor_cp: asText(r.ruc_emisor_cp),
        fecha_cp: asDate(r.fecha_cp),
        numero_cp: asText(r.numero_cp),
        tipo_id: r.tipo_id ?? "",
        numero_id: asText(r.numero_id),
        nombres_razon_social: r.nombres_razon_social ?? "",
        importe_factura: r.importe_factura ?? "",
        carconta_modificador: asText(r.carconta_modificador),
        fecha_cp_modificador: asDate(r.fecha_cp_modificador),
        numero_cp_modificador: asText(r.numero_cp_modificador),
        importe_cred_debit: r.importe_cred_debit ?? "",
        total_venta: r.total_venta ?? "",
        carconta_primer_pago: asText(r.carconta_primer_pago),
        fecha_primer_pago: asDate(r.fecha_primer_pago),
        importe_primer_pago: r.importe_primer_pago ?? "",
        subsidiario_registro_primer_pago: asText(r.subsidiario_registro_primer_pago),
        carconta_segundo_pago: asText(r.carconta_segundo_pago),
        fecha_segundo_pago: asDate(r.fecha_segundo_pago),
        importe_segundo_pago: r.importe_segundo_pago ?? "",
        subsidiario_registro_segundo_pago: asText(r.subsidiario_registro_segundo_pago),
        carconta_tercer_pago: asText(r.carconta_tercer_pago),
        otros_pagos: asDate(r.otros_pagos),
        importe: r.importe ?? "",
        subsidiario_registro: asText(r.subsidiario_registro),
        cuenta_mvd_scotia: asText(r.cuenta_mvd_scotia),
        comprobante_transferencia_bancaria: asText(r.comprobante_transferencia_bancaria),
        cta_cliente: asText(r.cta_cliente),
        importe_total_vendido_usd: r.importe_total_vendido_usd ?? "",
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
        "carconta",
        "ruc_emisor_cp",
        "numero_cp",
        "numero_id",
        "carconta_modificador",
        "numero_cp_modificador",
        "carconta_primer_pago",
        "subsidiario_registro_primer_pago",
        "carconta_segundo_pago",
        "subsidiario_registro_segundo_pago",
        "carconta_tercer_pago",
        "subsidiario_registro",
        "cuenta_mvd_scotia",
        "comprobante_transferencia_bancaria",
        "cta_cliente",
      ];

      const dateCols = [
        "fecha_cp",
        "fecha_cp_modificador",
        "fecha_primer_pago",
        "fecha_segundo_pago",
        "otros_pagos",
      ];

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
        { wch: 10 },
        { wch: 24 },
        { wch: 14 },
        { wch: 14 },
        { wch: 18 },
        { wch: 10 },
        { wch: 16 },
        { wch: 30 },
        { wch: 16 },
        { wch: 24 },
        { wch: 14 },
        { wch: 18 },
        { wch: 16 },
        { wch: 16 },
        { wch: 24 },
        { wch: 14 },
        { wch: 16 },
        { wch: 22 },
        { wch: 24 },
        { wch: 14 },
        { wch: 16 },
        { wch: 22 },
        { wch: 24 },
        { wch: 14 },
        { wch: 16 },
        { wch: 20 },
        { wch: 20 },
        { wch: 18 },
        { wch: 18 },
        { wch: 20 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "RO_Ventas");
      XLSX.writeFile(wb, "RO_Ventas.xlsx", { cellDates: true });
    } catch (e: any) {
      setMsg(String(e?.message || "No se pudo descargar la información"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 14 }}>Descargas</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
            textAlign: "left",
          }}
        >
          {loading ? "Descargando..." : "Descargar RO - Compras"}
        </button>

        <button
          type="button"
          onClick={downloadSellExcel}
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
            textAlign: "left",
          }}
        >
          {loading ? "Descargando..." : "Descargar RO - Ventas"}
        </button>
      </div>

      {msg ? (
        <div style={{ marginTop: 12, color: "#b91c1c", fontWeight: 600 }}>{msg}</div>
      ) : null}
    </div>
  );
}