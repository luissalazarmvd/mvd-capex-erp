// src/components/compliance/ComplianceROCExp.tsx
"use client";

import React, { useState } from "react";
import * as XLSX from "xlsx";
import { apiGet } from "../../lib/apiClient";
import { Button } from "../ui/Button";

type ComplianceRow = Record<string, any>;

type ComplianceResp = {
  ok: boolean;
  rows?: ComplianceRow[];
  count?: number;
  error?: string;
};

type Props = {
  setMsgAction: React.Dispatch<React.SetStateAction<string | null>>;
  disabled?: boolean;
};

const BUY_COLUMNS = [
  "item",
  "carconta",
  "sede",
  "tipo_persona",
  "tipo_empresa",
  "subdiario",
  "comprobante",
  "numero",
  "tipo_de_documento",
  "fecha_de_documento",
  "ruc",
  "proveedor",
  "glosa",
  "importe_lte",
  "tipo_de_moneda",
  "imp_me_lte",
  "fecha_de_pago_tlc",
  "monto",
  "cuenta_bancaria",
  "cuenta_contable",
  "asiento_registro",
  "lote",
  "cuenta_mvd_bcp",
  "comprobante_transferencia_bancaria",
  "cta_proveedor",
  "importe_total_pagado_usd",
  "importe_total_de_la_factura",
  "costo_mineral",
  "volumen_de_toneladas_tms_adquiridas",
  "plate",
  "ley_au",
  "ley_au_promedio",
  "umbral",
  "clase_proveedor_mineral",
  "registro_recpo",
  "ruc_proveedor_tercero",
  "nombre_proveedor_tercero",
  "rucodm",
  "concession_code",
  "concession_name",
  "department",
  "province",
  "district",
  "concession_owner",
  "concession_status",
  "condicion_formal_minero",
  "zona",
  "ivplm_actual",
  "tipo_vlm",
  "fecha_ivplm",
  "geologo_ivplm",
  "modalidad_contrato",
  "ley_au_minima_contrato",
  "checklist_compra",
  "dd_pep_infogob_inspektor",
  "dd_consultagoogle",
  "dd_listas",
  "dd_cul",
  "dd_scoringlaft",
  "dj_conocimiento_uif",
  "rl_apellidos_nombres",
  "rl_dni",
  "rl_estado_civil",
  "rl_conyuge_conviviente",
  "domicilio",
  "partida_registral_sunarp",
  "dd_observation_status",
  "dd_actions",
  "dd_comments",
  "modalidad_op",
  "tipo_op",
  "fecha_op",
  "tipo_bien_op",
  "descri_bien_op",
  "servicio_mercancia_op",
  "costo_mineral_op",
  "moneda_op",
  "tc_op",
  "medio_pago_op",
  "bank_cuenta_mvd_op",
  "bank_cuenta_proveedor_op",
  "lugar_op",
  "fecha_pago_op",
  "forma_pago_op",
  "origen_fondos_op",
  "garantia_op",
  "period_contract_op",
  "orde_tipo_persona",
  "orde_tipo_doi",
  "orde_numero_doi",
  "orde_nombre_razon_social",
  "orde_nacionalidad",
  "orde_partida_registral",
  "orde_domicilio_legal",
  "orde_domicilio_fiscal",
  "orde_representante_legal",
  "orde_rl_tipo_doi",
  "orde_rl_numero_doi",
  "orde_rl_nacionalidad",
  "orde_rl_domicilio",
  "orde_profesion_ocupacion",
  "orde_estado_civil",
  "orde_nombre_conyuge_conviviente",
  "orde_tipo_representacion",
  "orde_inscripcion_registral_rubro",
  "orde_inscripcion_registral_asiento",
  "ejec_tipo_persona",
  "ejec_tipo_doi",
  "ejec_numero_doi",
  "ejec_nombre_razon_social",
  "ejec_nacionalidad",
  "ejec_partida_registral",
  "ejec_domicilio_legal",
  "ejec_domicilio_fiscal",
  "ejec_representante_legal",
  "ejec_rl_tipo_doi",
  "ejec_rl_numero_doi",
  "ejec_rl_nacionalidad",
  "ejec_rl_domicilio",
  "ejec_profesion_ocupacion",
  "ejec_estado_civil",
  "ejec_nombre_conyuge_conviviente",
  "ejec_tipo_representacion",
  "ejec_inscripcion_registral_rubro",
  "ejec_inscripcion_registral_asiento",
  "benef_tipo_persona",
  "benef_tipo_doi",
  "benef_numero_doi",
  "benef_nombre_razon_social",
  "benef_nacionalidad",
  "benef_partida_registral",
  "benef_domicilio_legal",
  "benef_domicilio_fiscal",
  "benef_representante_legal",
  "benef_rl_tipo_doi",
  "benef_rl_numero_doi",
  "benef_rl_nacionalidad",
  "benef_rl_domicilio",
  "benef_profesion_ocupacion",
  "benef_estado_civil",
  "benef_nombre_conyuge_conviviente",
  "benef_tipo_representacion",
  "benef_inscripcion_registral_rubro",
  "benef_inscripcion_registral_asiento",
  "carconta_origen",
] as const;

const SELL_COLUMNS = [
  "item",
  "carconta",
  "ruc_emisor_cp",
  "fecha_cp",
  "numero_cp",
  "tipo_id",
  "numero_id",
  "nombres_razon_social",
  "importe_factura",
  "carconta_modificador",
  "fecha_cp_modificador",
  "numero_cp_modificador",
  "importe_cred_debit",
  "total_venta",
  "fecha_primer_pago",
  "importe_primer_pago",
  "subsidiario_registro_primer_pago",
  "fecha_segundo_pago",
  "importe_segundo_pago",
  "subsidiario_registro_segundo_pago",
  "otros_pagos",
  "importe",
  "subsidiario_registro",
  "cuenta_mvd_scotia",
  "comprobante_transferencia_bancaria",
  "cta_cliente",
  "importe_total_vendido_usd",
  "dua",
  "peso_bruto_fact_gramos",
  "guia_remision",
  "peso_neto_guia_vd_gramos",
  "peso_bruto_guia_vd_gramos",
  "peso_fino_ncnd_preliminar",
  "peso_fino_ncnd_final",
  "peso_ensayo_vd",
  "ley_au_ensayo_vd",
  "peso_fino_ensayo_px",
  "ley_au_ensayo_px",
  "peso_onzas_ensayo_final",
  "peso_gramos_ensayo_final",
  "precio_onza_usd_ensayo_final",
  "descuento_porcentaje",
  "fecha_exportacion",
  "fecha_llegada_suiza",
  "hora_llegada_suiza",
  "london_datetime",
  "modalidad_op",
  "tipo_op",
  "fecha_op",
  "tipo_bien_op",
  "descri_bien_op",
  "servicio_mercancia_op",
  "inporte_venta_netoncnd_op",
  "moneda_op",
  "tc_op",
  "medio_pago_op",
  "lugar_op",
  "fecha_firstpago_op",
  "fecha_secondpago_op",
  "payment_policy_op",
  "origen_fondos_op",
  "garantia_op",
  "orde_tipo_persona",
  "orde_tipo_doi",
  "orde_numero_doi",
  "orde_nombre_razon_social",
  "orde_nacionalidad",
  "orde_partida_registral",
  "orde_domicilio_legal",
  "orde_domicilio_fiscal",
  "orde_representante_legal",
  "orde_rl_tipo_doi",
  "orde_rl_numero_doi",
  "orde_rl_nacionalidad",
  "orde_rl_domicilio",
  "orde_profesion_ocupacion",
  "orde_estado_civil",
  "orde_nombre_conyuge_conviviente",
  "orde_tipo_representacion",
  "orde_inscripcion_registral_rubro",
  "orde_inscripcion_registral_asiento",
  "ejec_tipo_persona",
  "ejec_tipo_doi",
  "ejec_numero_doi",
  "ejec_nombre_razon_social",
  "ejec_nacionalidad",
  "ejec_partida_registral",
  "ejec_domicilio_legal",
  "ejec_domicilio_fiscal",
  "ejec_representante_legal",
  "ejec_rl_tipo_doi",
  "ejec_rl_numero_doi",
  "ejec_rl_nacionalidad",
  "ejec_rl_domicilio",
  "ejec_profesion_ocupacion",
  "ejec_estado_civil",
  "ejec_nombre_conyuge_conviviente",
  "ejec_tipo_representacion",
  "ejec_inscripcion_registral_rubro",
  "ejec_inscripcion_registral_asiento",
  "benef_tipo_persona",
  "benef_tipo_doi",
  "benef_numero_doi",
  "benef_nombre_razon_social",
  "benef_nacionalidad",
  "benef_partida_registral",
  "benef_domicilio_legal",
  "benef_domicilio_fiscal",
  "benef_representante_legal",
  "benef_rl_tipo_doi",
  "benef_rl_numero_doi",
  "benef_rl_nacionalidad",
  "benef_rl_domicilio",
  "benef_profesion_ocupacion",
  "benef_estado_civil",
  "benef_nombre_conyuge_conviviente",
  "benef_tipo_representacion",
  "benef_inscripcion_registral_rubro",
  "benef_inscripcion_registral_asiento",
] as const;

const BUY_TEXT_COLUMNS = [
  "carconta",
  "sede",
  "subdiario",
  "comprobante",
  "numero",
  "tipo_de_documento",
  "ruc",
  "cuenta_bancaria",
  "cuenta_contable",
  "asiento_registro",
  "lote",
  "cuenta_mvd_bcp",
  "comprobante_transferencia_bancaria",
  "cta_proveedor",
  "plate",
  "registro_recpo",
  "ruc_proveedor_tercero",
  "rucodm",
  "concession_code",
  "rl_dni",
  "partida_registral_sunarp",
  "bank_cuenta_mvd_op",
  "bank_cuenta_proveedor_op",
  "orde_tipo_doi",
  "orde_numero_doi",
  "orde_partida_registral",
  "orde_rl_tipo_doi",
  "orde_rl_numero_doi",
  "orde_inscripcion_registral_rubro",
  "orde_inscripcion_registral_asiento",
  "ejec_tipo_doi",
  "ejec_numero_doi",
  "ejec_partida_registral",
  "ejec_rl_tipo_doi",
  "ejec_rl_numero_doi",
  "ejec_inscripcion_registral_rubro",
  "ejec_inscripcion_registral_asiento",
  "benef_tipo_doi",
  "benef_numero_doi",
  "benef_partida_registral",
  "benef_rl_tipo_doi",
  "benef_rl_numero_doi",
  "benef_inscripcion_registral_rubro",
  "benef_inscripcion_registral_asiento",
  "carconta_origen",
] as const;

const BUY_DATE_COLUMNS = [
  "fecha_de_documento",
  "fecha_de_pago_tlc",
  "fecha_ivplm",
  "fecha_op",
  "fecha_pago_op",
] as const;

const SELL_TEXT_COLUMNS = [
  "carconta",
  "ruc_emisor_cp",
  "numero_cp",
  "tipo_id",
  "numero_id",
  "carconta_modificador",
  "numero_cp_modificador",
  "subsidiario_registro_primer_pago",
  "subsidiario_registro_segundo_pago",
  "subsidiario_registro",
  "cuenta_mvd_scotia",
  "comprobante_transferencia_bancaria",
  "cta_cliente",
  "dua",
  "guia_remision",
  "hora_llegada_suiza",
  "orde_tipo_doi",
  "orde_numero_doi",
  "orde_partida_registral",
  "orde_rl_tipo_doi",
  "orde_rl_numero_doi",
  "orde_inscripcion_registral_rubro",
  "orde_inscripcion_registral_asiento",
  "ejec_tipo_doi",
  "ejec_numero_doi",
  "ejec_partida_registral",
  "ejec_rl_tipo_doi",
  "ejec_rl_numero_doi",
  "ejec_inscripcion_registral_rubro",
  "ejec_inscripcion_registral_asiento",
  "benef_tipo_doi",
  "benef_numero_doi",
  "benef_partida_registral",
  "benef_rl_tipo_doi",
  "benef_rl_numero_doi",
  "benef_inscripcion_registral_rubro",
  "benef_inscripcion_registral_asiento",
] as const;

const SELL_DATE_COLUMNS = [
  "fecha_cp",
  "fecha_cp_modificador",
  "fecha_primer_pago",
  "fecha_segundo_pago",
  "otros_pagos",
  "fecha_exportacion",
  "fecha_llegada_suiza",
  "fecha_op",
  "fecha_firstpago_op",
  "fecha_secondpago_op",
] as const;

const SELL_DATETIME_COLUMNS = [
  "london_datetime",
] as const;

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

function buildExportRows(
  rows: ComplianceRow[],
  columns: readonly string[],
  textColumns: readonly string[],
  dateColumns: readonly string[],
  dateTimeColumns: readonly string[] = []
) {
  const textSet = new Set<string>(textColumns);
  const dateSet = new Set<string>(dateColumns);
  const dateTimeSet = new Set<string>(dateTimeColumns);

  return rows.map((r) => {
    const out: ComplianceRow = {};

    for (const col of columns) {
      if (dateSet.has(col) || dateTimeSet.has(col)) {
        out[col] = asDate(r[col]);
      } else if (textSet.has(col)) {
        out[col] = asText(r[col]);
      } else {
        out[col] = r[col] ?? "";
      }
    }

    return out;
  });
}

function columnWidth(col: string) {
  const fixed: Record<string, number> = {
    item: 10,
    carconta: 24,
    carconta_origen: 24,
    glosa: 40,
    proveedor: 30,
    nombres_razon_social: 30,
    concession_name: 30,
    concession_owner: 24,
    comprobante_transferencia_bancaria: 28,
    volumen_de_toneladas_tms_adquiridas: 26,
    importe_total_de_la_factura: 24,
    importe_total_pagado_usd: 24,
    importe_total_vendido_usd: 24,
    peso_bruto_fact_gramos: 24,
    peso_neto_guia_vd_gramos: 26,
    peso_bruto_guia_vd_gramos: 26,
    precio_onza_usd_ensayo_final: 28,
  };

  if (fixed[col]) return fixed[col];
  if (col.includes("domicilio")) return 28;
  if (col.includes("nombre") || col.includes("razon_social")) return 30;
  if (col.includes("comments") || col.includes("observation") || col.includes("actions")) return 30;
  if (col.includes("descri") || col.includes("servicio")) return 30;
  if (col.includes("fecha") || col.includes("date") || col.includes("datetime")) return 18;
  if (col.includes("importe") || col.includes("monto") || col.includes("costo") || col.includes("peso")) return 18;
  if (col.includes("cuenta") || col.includes("cta")) return 22;
  if (col.includes("numero") || col.includes("comprobante")) return 20;
  return 18;
}

function createWorksheet(
  rows: ComplianceRow[],
  columns: readonly string[],
  textColumns: readonly string[],
  dateColumns: readonly string[],
  dateTimeColumns: readonly string[] = []
) {
  const exportRows = buildExportRows(
    rows,
    columns,
    textColumns,
    dateColumns,
    dateTimeColumns
  );

  const ws = XLSX.utils.aoa_to_sheet([[...columns]]);

  if (exportRows.length > 0) {
    XLSX.utils.sheet_add_json(ws, exportRows, {
      header: [...columns],
      skipHeader: true,
      origin: "A2",
    });
  }

  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  const headerMap: Record<string, number> = {};

  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    const cell = ws[addr];
    if (cell?.v) headerMap[String(cell.v)] = c;
  }

  const textSet = new Set<string>(textColumns);
  const dateSet = new Set<string>(dateColumns);
  const dateTimeSet = new Set<string>(dateTimeColumns);

  for (let r = 1; r <= range.e.r; r++) {
    for (const colName of textSet) {
      const c = headerMap[colName];
      if (c === undefined) continue;

      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (!cell) continue;

      cell.t = "s";
      cell.v = asText(cell.v);
      delete cell.z;
    }

    for (const colName of dateSet) {
      const c = headerMap[colName];
      if (c === undefined) continue;

      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (!cell) continue;

      const raw = exportRows[r - 1]?.[colName];
      if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
        cell.t = "d";
        cell.v = raw;
        cell.z = "yyyy-mm-dd";
      }
    }

    for (const colName of dateTimeSet) {
      const c = headerMap[colName];
      if (c === undefined) continue;

      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (!cell) continue;

      const raw = exportRows[r - 1]?.[colName];
      if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
        cell.t = "d";
        cell.v = raw;
        cell.z = "yyyy-mm-dd hh:mm:ss";
      }
    }
  }

  ws["!cols"] = columns.map((col) => ({ wch: columnWidth(col) }));

  return ws;
}

export default function ComplianceROCExp({
  setMsgAction,
  disabled = false,
}: Props) {
  const [loading, setLoading] = useState(false);

  async function downloadBuyExcel() {
    setLoading(true);
    setMsgAction(null);

    try {
      const data = (await apiGet("/api/compliance/buy")) as ComplianceResp;

      if (!data?.ok) {
        throw new Error(data?.error || "No se pudo descargar la información");
      }

      const rows: ComplianceRow[] = Array.isArray(data?.rows) ? data.rows : [];

      const ws = createWorksheet(
        rows,
        BUY_COLUMNS,
        BUY_TEXT_COLUMNS,
        BUY_DATE_COLUMNS
      );

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "RO_Compras");
      XLSX.writeFile(wb, "RO_Compras.xlsx", { cellDates: true });
    } catch (e: any) {
      setMsgAction(String(e?.message || "No se pudo descargar la información"));
    } finally {
      setLoading(false);
    }
  }

  async function downloadSellExcel() {
    setLoading(true);
    setMsgAction(null);

    try {
      const data = (await apiGet("/api/compliance/sell")) as ComplianceResp;

      if (!data?.ok) {
        throw new Error(data?.error || "No se pudo descargar la información");
      }

      const rows: ComplianceRow[] = (Array.isArray(data?.rows) ? data.rows : [])
        .slice()
        .sort((a, b) => Number(a?.item ?? 0) - Number(b?.item ?? 0));

      const ws = createWorksheet(
        rows,
        SELL_COLUMNS,
        SELL_TEXT_COLUMNS,
        SELL_DATE_COLUMNS,
        SELL_DATETIME_COLUMNS
      );

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "RO_Ventas");
      XLSX.writeFile(wb, "RO_Ventas.xlsx", { cellDates: true });
    } catch (e: any) {
      setMsgAction(String(e?.message || "No se pudo descargar la información"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      <Button
        type="button"
        size="md"
        variant="default"
        onClick={downloadBuyExcel}
        disabled={disabled || loading}
      >
        {loading ? "Descargando..." : "Descargar RO - Compras"}
      </Button>

      <Button
        type="button"
        size="md"
        variant="default"
        onClick={downloadSellExcel}
        disabled={disabled || loading}
      >
        {loading ? "Descargando..." : "Descargar RO - Ventas"}
      </Button>
    </div>
  );
}