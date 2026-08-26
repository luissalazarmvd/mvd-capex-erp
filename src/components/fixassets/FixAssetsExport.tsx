"use client";

import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { apiGet } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { Table } from "../ui/Table";
import { FastCellInput } from "./FastCellInput";

type ExportRow = {
  period_date: string | null;
  sub_diario: string | null;
  numero_comprobante: string | null;
  fecha_comprobante: string | null;
  codigo_moneda: string | null;
  glosa_principal: string | null;
  tipo_cambio: number | string | null;
  tipo_conversion: string | null;
  flag_conversion_moneda: string | null;
  fecha_tipo_cambio: string | null;
  cuenta_contable: string | null;
  codigo_anexo: string | null;
  codigo_centro_costo: string | null;
  debe_haber: string | null;
  importe_original: number | string | null;
  importe_dolares: number | string | null;
  importe_soles: number | string | null;
  tipo_documento: string | null;
  numero_documento: string | null;
  fecha_documento: string | null;
  fecha_vencimiento: string | null;
  codigo_area: string | null;
  glosa_detalle: string | null;
  codigo_anexo_auxiliar: string | null;
  medio_pago: string | null;
  tipo_documento_referencia: string | null;
  numero_documento_referencia: string | null;
  fecha_documento_referencia: string | null;
  numero_maquina_registradora_tipo_doc_ref: string | null;
  base_imponible_documento_referencia: number | string | null;
  igv_documento_provision: number | string | null;
  tipo_referencia_estado_mq: string | null;
  numero_serie_caja_registradora: string | null;
  fecha_operacion: string | null;
  tipo_tasa: string | null;
  tasa_detraccion_percepcion: number | string | null;
  importe_base_detraccion_percepcion_dolares: number | string | null;
  importe_base_detraccion_percepcion_soles: number | string | null;
  tipo_cambio_para_f: string | null;
  importe_igv_sin_derecho_credito_fiscal: number | string | null;
  tasa_igv: number | string | null;
};

type DetailRow = {
  asset_code: string | null;
  asset_description: string | null;
  origin_account_code: string | null;
  account_group: string | null;
  account_denom: string | null;
  cuenta_depreciacion: string | null;
  cost_center_code: string | null;
  depreciation_amount_pen: number | string | null;
  exc_rate: number | string | null;
  depreciation_amount_usd: number | string | null;
};

type CatalogueRateRow = {
  asset_code: string | null;
  cost_center_code: string | null;
  deprec_acc_code_fir: string | null;
  deprec_acc_code_sec: string | null;
  exc_rate: number | string | null;
};

type ExportKey = Exclude<keyof ExportRow, "period_date">;
type CellValue = string | number;

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const COLUMNS: Array<{
  key: ExportKey;
  label: string;
  width: number;
}> = [
  { key: "sub_diario", label: "Sub Diario", width: 90 },
  { key: "numero_comprobante", label: "Número de Comprobante", width: 135 },
  { key: "fecha_comprobante", label: "Fecha de Comprobante", width: 135 },
  { key: "codigo_moneda", label: "Código de Moneda", width: 110 },
  { key: "glosa_principal", label: "Glosa Principal", width: 230 },
  { key: "tipo_cambio", label: "Tipo de Cambio", width: 110 },
  { key: "tipo_conversion", label: "Tipo de Conversión", width: 120 },
  { key: "flag_conversion_moneda", label: "Flag de Conversión de Moneda", width: 180 },
  { key: "fecha_tipo_cambio", label: "Fecha Tipo de Cambio", width: 130 },
  { key: "cuenta_contable", label: "Cuenta Contable", width: 125 },
  { key: "codigo_anexo", label: "Código de Anexo", width: 120 },
  { key: "codigo_centro_costo", label: "Código de Centro de Costo", width: 160 },
  { key: "debe_haber", label: "Debe / Haber", width: 90 },
  { key: "importe_original", label: "Importe Original", width: 125 },
  { key: "importe_dolares", label: "Importe en Dólares", width: 130 },
  { key: "importe_soles", label: "Importe en Soles", width: 125 },
  { key: "tipo_documento", label: "Tipo de Documento", width: 125 },
  { key: "numero_documento", label: "Número de Documento", width: 135 },
  { key: "fecha_documento", label: "Fecha de Documento", width: 130 },
  { key: "fecha_vencimiento", label: "Fecha de Vencimiento", width: 135 },
  { key: "codigo_area", label: "Código de Area", width: 105 },
  { key: "glosa_detalle", label: "Glosa Detalle", width: 230 },
  { key: "codigo_anexo_auxiliar", label: "Código de Anexo Auxiliar", width: 160 },
  { key: "medio_pago", label: "Medio de Pago", width: 115 },
  { key: "tipo_documento_referencia", label: "Tipo de Documento de Referencia", width: 190 },
  { key: "numero_documento_referencia", label: "Número de Documento Referencia", width: 190 },
  { key: "fecha_documento_referencia", label: "Fecha Documento Referencia", width: 175 },
  { key: "numero_maquina_registradora_tipo_doc_ref", label: "Nro Máq. Registradora Tipo Doc. Ref.", width: 220 },
  { key: "base_imponible_documento_referencia", label: "Base Imponible Documento Referencia", width: 210 },
  { key: "igv_documento_provision", label: "IGV Documento Provisión", width: 160 },
  { key: "tipo_referencia_estado_mq", label: "Tipo Referencia en estado MQ", width: 180 },
  { key: "numero_serie_caja_registradora", label: "Número Serie Caja Registradora", width: 190 },
  { key: "fecha_operacion", label: "Fecha de Operación", width: 130 },
  { key: "tipo_tasa", label: "Tipo de Tasa", width: 105 },
  { key: "tasa_detraccion_percepcion", label: "Tasa Detracción/Percepción", width: 185 },
  { key: "importe_base_detraccion_percepcion_dolares", label: "Importe Base Detracción/Percepción Dólares", width: 245 },
  { key: "importe_base_detraccion_percepcion_soles", label: "Importe Base Detracción/Percepción Soles", width: 235 },
  { key: "tipo_cambio_para_f", label: "Tipo Cambio para 'F'", width: 135 },
  { key: "importe_igv_sin_derecho_credito_fiscal", label: "Importe de IGV sin derecho crédito fiscal", width: 235 },
  { key: "tasa_igv", label: "Tasa IGV", width: 100 },
];

const RESTRICTIONS = [
  "Ver T.G. 02",
  "Los dos primeros dígitos son el mes y los otros 4 siguientes un correlativo",
  "",
  "Ver T.G. 03",
  "",
  "Llenar solo si Tipo de Conversión es 'C'. Debe estar entre >=0 y <=9999.999999",
  "Solo: 'C'= Especial, 'M'=Compra, 'V'=Venta , 'F' De acuerdo a fecha",
  "Solo: 'S' = Si se convierte, 'N'= No se convierte",
  "Si Tipo de Conversión 'F'",
  "Debe existir en el Plan de Cuentas",
  "Si Cuenta Contable tiene seleccionado Tipo de Anexo, debe existir en la tabla de Anexos",
  "Si Cuenta Contable tiene habilitado C. Costo, Ver T.G. 05",
  "'D' ó 'H'",
  "Importe original de la cuenta contable. Obligatorio, debe estar entre >=0 y <=99999999999.99",
  "Importe de la Cuenta Contable en Dólares. Obligatorio si Flag de Conversión de Moneda esta en 'N', debe estar entre >=0 y <=99999999999.99",
  "Importe de la Cuenta Contable en Soles. Obligatorio si Flag de Conversión de Moneda esta en 'N', debe estra entre >=0 y <=99999999999.99",
  "Si Cuenta Contable tiene habilitado el Documento Referencia Ver T.G. 06",
  "Si Cuenta Contable tiene habilitado el Documento Referencia Incluye Serie y Número",
  "Si Cuenta Contable tiene habilitado el Documento Referencia",
  "Si Cuenta Contable tiene habilitada la Fecha de Vencimiento",
  "Si Cuenta Contable tiene habilitada el Area. Ver T.G. 26",
  "",
  "Si Cuenta Contable tiene seleccionado Tipo de Anexo Referencia",
  "Si Cuenta Contable tiene habilitado Tipo Medio Pago. Ver T.G. 'S1'",
  "Si Tipo de Documento es 'NA' ó 'ND' Ver T.G. 06",
  "Si Tipo de Documento es 'NC', 'NA' ó 'ND', incluye Serie y Número",
  "Si Tipo de Documento es 'NC', 'NA' ó 'ND'",
  "Si Tipo de Documento es 'NC', 'NA' ó 'ND'. Solo cuando el Tipo Documento de Referencia 'TK'",
  "Si Tipo de Documento es 'NC', 'NA' ó 'ND'",
  "Si Tipo de Documento es 'NC', 'NA' ó 'ND'",
  "Si la Cuenta Contable tiene Habilitado Documento Referencia 2 y Tipo de Documento es 'TK'",
  "Si la Cuenta Contable teien Habilitado Documento Referencia 2 y Tipo de Documento es 'TK'",
  "Si la Cuenta Contable tiene Habilitado Documento Referencia 2. Cuando Tipo de Documento es 'TK', consignar la fecha de emision del ticket",
  "Si la Cuenta Contable tiene configurada la Tasa: Si es '1' ver T.G. 28 y '2' ver T.G. 29",
  "Si la Cuenta Contable tiene conf. en Tasa: Si es '1' ver T.G. 28 y '2' ver T.G. 29. Debe estar entre >=0 y <=999.99",
  "Si la Cuenta Contable tiene configurada la Tasa. Debe ser el importe total del documento y estar entre >=0 y <=99999999999.99",
  "Si la Cuenta Contable tiene configurada la Tasa. Debe ser el importe total del documento y estar entre >=0 y <=99999999999.99",
  "Especificar solo si Tipo Conversión es 'F'. Se permite 'M' Compra y 'V' Venta.",
  "Especificar solo para comprobantes de compras con IGV sin derecho de crédito Fiscal. Se detalle solo en la cuenta 42xxxx",
  "Obligatorio para comprobantes de compras, valores validos 0,10,18.",
];

const FORMATS = [
  "4 Caracteres",
  "6 Caracteres",
  "dd/mm/aaaa",
  "2 Caracteres",
  "40 Caracteres",
  "Numérico 11, 6",
  "1 Caracteres",
  "1 Caracteres",
  "dd/mm/aaaa",
  "12 Caracteres",
  "18 Caracteres",
  "6 Caracteres",
  "1 Carácter",
  "Numérico 14,2",
  "Numérico 14,2",
  "Numérico 14,2",
  "2 Caracteres",
  "20 Caracteres",
  "dd/mm/aaaa",
  "dd/mm/aaaa",
  "3 Caracteres",
  "30 Caracteres",
  "18 Caracteres",
  "8 Caracteres",
  "2 Caracteres",
  "20 Caracteres",
  "dd/mm/aaaa",
  "20 Caracteres",
  "Numérico 14,2",
  "Numérico 14,2",
  "'MQ'",
  "15 caracteres",
  "dd/mm/aaaa",
  "5 Caracteres",
  "Numérico 14,2",
  "Numérico 14,2",
  "Numérico 14,2",
  "1 Caracter",
  "Numérico 14,2",
  "Numérico 14,2",
];

const NUMERIC_KEYS = new Set<ExportKey>([
  "tipo_cambio",
  "importe_original",
  "importe_dolares",
  "importe_soles",
  "base_imponible_documento_referencia",
  "igv_documento_provision",
  "tasa_detraccion_percepcion",
  "importe_base_detraccion_percepcion_dolares",
  "importe_base_detraccion_percepcion_soles",
  "importe_igv_sin_derecho_credito_fiscal",
  "tasa_igv",
]);

function text(value: unknown) {
  return value == null ? "" : String(value);
}

function period(value: unknown) {
  const match = text(value).match(/^(\d{4})-(\d{2})/);
  return match ? { year: match[1], month: match[2] } : null;
}

function numericValue(value: unknown) {
  if (value == null || value === "") return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : text(value);
}

function displayValue(key: ExportKey, value: unknown) {
  if (value == null || value === "") return "";
  if (!NUMERIC_KEYS.has(key)) return text(value);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return text(value);
  return parsed.toLocaleString("es-PE", {
    minimumFractionDigits: key === "tipo_cambio" ? 6 : 2,
    maximumFractionDigits: key === "tipo_cambio" ? 6 : 2,
  });
}

function excelValue(key: ExportKey, value: unknown): CellValue {
  if (value == null || value === "") return "";
  return NUMERIC_KEYS.has(key) ? numericValue(value) : text(value);
}

export default function FixAssetsExport() {
  const [rows, setRows] = useState<ExportRow[]>([]);
  const [catalogueIndexRows, setCatalogueIndexRows] = useState<CatalogueRateRow[]>([]);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [detailRowKey, setDetailRowKey] = useState<string | null>(null);
  const [detailParent, setDetailParent] = useState<ExportRow | null>(null);
  const [detailRows, setDetailRows] = useState<DetailRow[]>([]);
  const [assetExcRates, setAssetExcRates] = useState<Record<string, string>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const [response, catalogueResponse] = await Promise.all([
        apiGet("/api/actfij/deprec/export"),
        apiGet("/api/actfij/catalogue"),
      ]);
      const nextRows = Array.isArray(response?.rows)
        ? response.rows as ExportRow[]
        : [];
      const catalogueRows = Array.isArray(catalogueResponse?.rows)
        ? catalogueResponse.rows as CatalogueRateRow[]
        : [];
      const nextAssetExcRates = catalogueRows.reduce<Record<string, string>>((current, row) => {
        const assetCode = text(row.asset_code).trim();
        if (assetCode) current[assetCode] = text(row.exc_rate).trim();
        return current;
      }, {});

      setRows(nextRows);
      setCatalogueIndexRows(catalogueRows);
      setAssetExcRates(nextAssetExcRates);

      const latestPeriod = nextRows
        .map((row) => text(row.period_date).slice(0, 7))
        .filter(Boolean)
        .sort()
        .at(-1) || "";

      if (latestPeriod) {
        setYear(latestPeriod.slice(0, 4));
        setMonth(latestPeriod.slice(5, 7));
      } else {
        setYear("");
        setMonth("");
      }

      setIsError(false);
    } catch (error) {
      setRows([]);
      setYear("");
      setMonth("");
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "No se pudo cargar la exportación");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const years = useMemo(() => Array.from(new Set(
    rows
      .map((row) => period(row.period_date)?.year)
      .filter((value): value is string => Boolean(value))
  )).sort().reverse(), [rows]);

  const monthsForYear = useMemo(() => Array.from(new Set(
    rows
      .map((row) => period(row.period_date))
      .filter((value) => value?.year === year)
      .map((value) => value!.month)
  )).sort(), [rows, year]);

  useEffect(() => {
    if (!monthsForYear.length) {
      if (month) setMonth("");
      return;
    }

    if (!monthsForYear.includes(month)) {
      setMonth(monthsForYear.at(-1) || "");
    }
  }, [monthsForYear, month]);

  const visibleRows = useMemo(() => {
    const needle = deferredQuery.trim().toLocaleLowerCase("es");

    return rows
      .filter((row) => {
        const value = period(row.period_date);
        if (value?.year !== year || value.month !== month) return false;
        if (!needle) return true;

        const account = text(row.cuenta_contable).trim();
        const costCenter = text(row.codigo_centro_costo).trim();
        const debitCredit = text(row.debe_haber).trim().toUpperCase();

        if (
          account.toLocaleLowerCase("es").includes(needle)
          || costCenter.toLocaleLowerCase("es").includes(needle)
        ) {
          return true;
        }

        return catalogueIndexRows.some((asset) => {
          if (!text(asset.asset_code).toLocaleLowerCase("es").includes(needle)) return false;

          if (debitCredit === "D") {
            return text(asset.deprec_acc_code_fir).trim() === account
              && text(asset.cost_center_code).trim() === costCenter;
          }

          return text(asset.deprec_acc_code_sec).trim() === account;
        });
      })
      .sort((a, b) => {
        const typeA = text(a.debe_haber).trim().toUpperCase() === "D" ? 0 : 1;
        const typeB = text(b.debe_haber).trim().toUpperCase() === "D" ? 0 : 1;

        if (typeA !== typeB) return typeA - typeB;

        const accountCompare = text(a.cuenta_contable).localeCompare(
          text(b.cuenta_contable),
          undefined,
          { numeric: true }
        );

        if (accountCompare !== 0) return accountCompare;

        return text(a.codigo_centro_costo).localeCompare(
          text(b.codigo_centro_costo),
          undefined,
          { numeric: true }
        );
      });
  }, [rows, year, month, deferredQuery, catalogueIndexRows]);

  function exportRowKey(row: ExportRow) {
    return [
      text(row.period_date).slice(0, 7),
      text(row.debe_haber).trim(),
      text(row.cuenta_contable).trim(),
      text(row.codigo_centro_costo).trim(),
      text(row.glosa_principal).trim(),
    ].join("|");
  }

  function clearDetail() {
    setDetailRowKey(null);
    setDetailParent(null);
    setDetailRows([]);
    setDetailError("");
  }

  async function openDetail(row: ExportRow) {
    const key = exportRowKey(row);

    if (detailRowKey === key) {
      clearDetail();
      return;
    }

    const selectedPeriod = text(row.period_date).slice(0, 7);
    const account = text(row.cuenta_contable).trim();
    const debitCredit = text(row.debe_haber).trim().toUpperCase();
    const ceco = debitCredit === "D" ? text(row.codigo_centro_costo).trim() : "";

    setDetailRowKey(key);
    setDetailParent(row);
    setDetailRows([]);
    setDetailError("");
    setDetailLoading(true);

    try {
      const params = new URLSearchParams({
        period: selectedPeriod,
        account,
        ceco,
        debit_credit: debitCredit,
      });

      const response = await apiGet(`/api/actfij/deprec/export/detail?${params.toString()}`);
      setDetailRows(Array.isArray(response?.rows) ? response.rows as DetailRow[] : []);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "No se pudo cargar el detalle");
    } finally {
      setDetailLoading(false);
    }
  }

  function exportExcel() {
    if (!visibleRows.length || !year || !month) {
      setIsError(true);
      setMessage("No hay filas para exportar en el periodo seleccionado.");
      return;
    }

    const exportRows: CellValue[][] = visibleRows.map((row) =>
      COLUMNS.map((column) => excelValue(column.key, row[column.key]))
    );

    const sheetData: CellValue[][] = [
      COLUMNS.map((column) => column.label),
      [...RESTRICTIONS],
      [...FORMATS],
      ...exportRows,
    ];

    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    ws["!cols"] = COLUMNS.map((column) => ({
      wch: Math.max(12, Math.round(column.width / 7)),
    }));

    ws["!rows"] = [
      { hpt: 30 },
      { hpt: 75 },
      { hpt: 30 },
    ];

    for (let rowIndex = 0; rowIndex < visibleRows.length; rowIndex += 1) {
      const excelRow = rowIndex + 4;

      COLUMNS.forEach((column, columnIndex) => {
        if (!NUMERIC_KEYS.has(column.key)) return;

        const cellRef = `${XLSX.utils.encode_col(columnIndex)}${excelRow}`;
        const cell = ws[cellRef];

        if (!cell || cell.t !== "n") return;

        cell.z = column.key === "tipo_cambio" ? "0.000000" : "0.00";
      });
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Depreciación");

    XLSX.writeFile(
      wb,
      `depreciacion_${year}_${month}.xlsx`
    );

    setIsError(false);
    setMessage(`Excel de ${MONTHS[Number(month) - 1]} ${year} exportado correctamente.`);
  }

  function exportDetailExcel() {
    if (!detailParent || !detailRows.length) return;

    const detailHeaders = [
      "COD",
      "Descripción activo",
      "Cuenta origen",
      "Grupo",
      "Denominación",
      "Cuenta depreciación",
      "Centro de costo",
      "Depreciación PEN",
      "T.C.",
      "Depreciación USD",
    ];

    const detailData: CellValue[][] = detailRows.map((detail) => {
      const catalogueRate = assetExcRates[text(detail.asset_code).trim()] ?? "";
      const rate = Number(catalogueRate);
      const pen = Number(detail.depreciation_amount_pen);
      const usd = Number.isFinite(rate) && rate > 0 && Number.isFinite(pen)
        ? pen / rate
        : "";

      return [
        text(detail.asset_code),
        text(detail.asset_description),
        text(detail.origin_account_code),
        text(detail.account_group),
        text(detail.account_denom),
        text(detail.cuenta_depreciacion),
        text(detail.cost_center_code),
        Number.isFinite(pen) ? pen : "",
        Number.isFinite(rate) ? rate : "",
        usd,
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([
      detailHeaders,
      ...detailData,
    ]);

    ws["!cols"] = [
      { wch: 12 },
      { wch: 40 },
      { wch: 16 },
      { wch: 20 },
      { wch: 30 },
      { wch: 20 },
      { wch: 18 },
      { wch: 18 },
      { wch: 14 },
      { wch: 18 },
    ];

    for (let rowIndex = 0; rowIndex < detailRows.length; rowIndex += 1) {
      const excelRow = rowIndex + 2;

      const penCell = ws[`H${excelRow}`];
      const rateCell = ws[`I${excelRow}`];
      const usdCell = ws[`J${excelRow}`];

      if (penCell?.t === "n") penCell.z = "0.00";
      if (rateCell?.t === "n") rateCell.z = "0.000000";
      if (usdCell?.t === "n") usdCell.z = "0.00";
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Detalle");

    const detailPeriod = text(detailParent.period_date).slice(0, 7);
    const account = text(detailParent.cuenta_contable).trim();
    const ceco = text(detailParent.codigo_centro_costo).trim();

    XLSX.writeFile(
      wb,
      `detalle_depreciacion_${detailPeriod}_${account}${ceco ? `_${ceco}` : ""}.xlsx`
    );
  }

  return (
    <div
      className="fixassets-export-root"
      style={{
        display: "grid",
        gridTemplateRows: detailRowKey
          ? "auto auto minmax(420px, 62vh) auto auto"
          : "auto auto minmax(0, 1fr) auto",
        gap: 12,
        height: detailRowKey ? "auto" : "calc(100vh - 205px)",
        minHeight: 0,
        overflow: detailRowKey ? "visible" : "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "end",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>
            Exportación de depreciación
          </h1>
          <div
            className="muted"
            style={{ marginTop: 4, fontSize: 13 }}
          >
            Vista de provisión contable por periodo para exportación a Excel.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "end",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 800 }}>
            Buscar cuenta, CECO o COD
            <FastCellInput
              className="input"
              value={query}
              onCommit={setQuery}
              onLiveChange={(next) => {
                clearDetail();
                setQuery(next);
              }}
              placeholder="Cuenta, centro de costo o activo"
              style={{ width: 260, height: 34, padding: "6px 10px" }}
            />
          </label>

          <Select
            label="Año"
            value={year}
            onChange={(event) => {
              clearDetail();
              setYear(event.target.value);
            }}
            options={years.map((value) => ({
              value,
              label: value,
            }))}
            placeholder="Selecciona"
            style={{ minWidth: 110 }}
          />

          <Select
            label="Mes"
            value={month}
            onChange={(event) => {
              clearDetail();
              setMonth(event.target.value);
            }}
            options={monthsForYear.map((value) => ({
              value,
              label: MONTHS[Number(value) - 1],
            }))}
            placeholder="Selecciona"
            style={{ minWidth: 150 }}
          />

          <Button
            size="sm"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? "Cargando..." : "Refrescar"}
          </Button>

          <Button
            size="sm"
            variant="primary"
            onClick={exportExcel}
            disabled={loading || !visibleRows.length || !year || !month}
          >
            Exportar Excel ({visibleRows.length})
          </Button>
        </div>
      </div>

      <div style={{ display: "grid", gap: 4 }}>
        {message ? (
          <div
            className="panel-inner"
            style={{
              padding: 10,
              borderColor: isError
                ? "rgba(216,93,39,.8)"
                : "rgba(94,128,25,.9)",
              background: isError
                ? "rgba(216,93,39,.18)"
                : "rgba(94,128,25,.22)",
              fontWeight: 700,
            }}
          >
            {message}
          </div>
        ) : null}
      </div>

      <div
        className="panel-inner fixassets-export-table"
        style={{
          overflow: "auto",
          minHeight: 0,
          padding: 0,
          background: "#0b4d6b",
          borderColor: "rgba(147,211,230,.28)",
        }}
      >
        <div style={{ minWidth: "max-content" }}>
          <Table disableScrollWrapper>
            <colgroup>
              {COLUMNS.map((column) => (
                <col
                  key={column.key}
                  style={{
                    width: column.width,
                    minWidth: column.width,
                  }}
                />
              ))}
            </colgroup>

            <thead>
              <tr>
                {COLUMNS.map((column, index) => {
                  const sticky = index < 2;
                  const left = index === 0
                    ? 0
                    : index === 1
                      ? COLUMNS[0].width
                      : undefined;

                  return (
                    <th
                      key={column.key}
                      className="capex-th"
                      style={{
                        padding: 8,
                        fontSize: 12,
                        left,
                        zIndex: sticky ? 47 : undefined,
                        boxShadow: index === 1
                          ? "2px 0 rgba(216,238,255,.16)"
                          : undefined,
                      }}
                    >
                      {column.label}
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {visibleRows.map((row, rowIndex) => {
                const key = exportRowKey(row);
                const focused = detailRowKey === key;

                return (
                  <tr
                    key={`${key}|${rowIndex}`}
                    className="capex-tr"
                    onClick={() => void openDetail(row)}
                    style={{
                      cursor: "pointer",
                      background: focused ? "rgba(27,147,227,.34)" : undefined,
                    }}
                  >
                    {COLUMNS.map((column, columnIndex) => {
                      const sticky = columnIndex < 2;
                      const left = columnIndex === 0
                        ? 0
                        : columnIndex === 1
                          ? COLUMNS[0].width
                          : undefined;

                      return (
                        <td
                          key={column.key}
                          className="capex-td"
                          style={{
                            position: sticky ? "sticky" : undefined,
                            left,
                            zIndex: sticky ? 20 : undefined,
                            background: focused
                              ? "#155a78"
                              : sticky
                                ? "#0b4d6b"
                                : undefined,
                            boxShadow: columnIndex === 1
                              ? "2px 0 rgba(216,238,255,.12)"
                              : undefined,
                            textAlign: NUMERIC_KEYS.has(column.key)
                              ? "right"
                              : undefined,
                          }}
                          title={text(row[column.key])}
                        >
                          {displayValue(column.key, row[column.key])}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}

              {!loading && !visibleRows.length ? (
                <tr>
                  <td
                    className="capex-td"
                    colSpan={COLUMNS.length}
                  >
                    No hay registros para el periodo seleccionado.
                  </td>
                </tr>
              ) : null}

              {loading ? (
                <tr>
                  <td
                    className="capex-td"
                    colSpan={COLUMNS.length}
                  >
                    Cargando exportación...
                  </td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        </div>
      </div>

      {detailRowKey && detailParent ? (
        <section
          className="panel-inner fixassets-export-table fixassets-export-detail"
          style={{
            position: "static",
            maxHeight: 320,
            padding: 10,
            display: "grid",
            gap: 8,
            overflow: "hidden",
            background: "#0b4d6b",
            borderColor: "rgba(147,211,230,.52)",
            boxShadow: "0 10px 30px rgba(0,0,0,.24)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <div>
              <strong>
                Detalle de activos · Cuenta {text(detailParent.cuenta_contable)}
                {text(detailParent.codigo_centro_costo).trim()
                  ? ` · CECO ${text(detailParent.codigo_centro_costo)}`
                  : ""}
              </strong>
              <span
                className="muted"
                style={{ marginLeft: 8, fontSize: 12 }}
              >
                {text(detailParent.debe_haber) === "D"
                  ? "Agrupación por cuenta + centro de costo"
                  : "Agrupación por cuenta"}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Button
                size="sm"
                variant="primary"
                onClick={exportDetailExcel}
                disabled={detailLoading || !detailRows.length}
              >
                Exportar Excel ({detailRows.length})
              </Button>

              <Button size="sm" onClick={clearDetail}>
                Cerrar detalle
              </Button>
            </div>
          </div>

          {detailError ? (
            <div
              style={{
                color: "#ffd0bf",
                fontWeight: 800,
                fontSize: 13,
              }}
            >
              {detailError}
            </div>
          ) : detailLoading ? (
            <div className="muted" style={{ fontSize: 13 }}>
              Cargando detalle...
            </div>
          ) : detailRows.length ? (
            <div style={{ overflow: "auto", maxHeight: 260 }}>
              <Table disableScrollWrapper stickyHeader>
                <thead>
                  <tr>
                    {[
                      "COD",
                      "Descripción activo",
                      "Cuenta origen",
                      "Grupo",
                      "Denominación",
                      "Cuenta depreciación",
                      "Centro de costo",
                      "Depreciación PEN",
                      "T.C.",
                      "Depreciación USD",
                    ].map((label) => (
                      <th
                        key={label}
                        className="capex-th"
                        style={{ top: 0, zIndex: 20, padding: 7, fontSize: 12 }}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {detailRows.map((detail) => {
                    const catalogueRate = assetExcRates[text(detail.asset_code).trim()] ?? "";
                    const rate = Number(catalogueRate);
                    const pen = Number(detail.depreciation_amount_pen);
                    const usd = Number.isFinite(rate) && rate > 0 && Number.isFinite(pen)
                      ? pen / rate
                      : null;

                    return (
                      <tr
                        key={text(detail.asset_code)}
                        className="capex-tr"
                      >
                        <td className="capex-td">{text(detail.asset_code)}</td>
                        <td className="capex-td">{text(detail.asset_description)}</td>
                        <td className="capex-td">{text(detail.origin_account_code)}</td>
                        <td className="capex-td">{text(detail.account_group)}</td>
                        <td className="capex-td">{text(detail.account_denom)}</td>
                        <td className="capex-td">{text(detail.cuenta_depreciacion)}</td>
                        <td className="capex-td">{text(detail.cost_center_code)}</td>
                        <td className="capex-td" style={{ textAlign: "right" }}>
                          {displayValue("importe_soles", detail.depreciation_amount_pen)}
                        </td>
                        <td className="capex-td" style={{ textAlign: "right" }}>
                          {catalogueRate
                            ? Number(catalogueRate).toLocaleString("es-PE", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 6,
                              })
                            : ""}
                        </td>
                        <td className="capex-td" style={{ textAlign: "right" }}>
                          {usd == null ? "" : displayValue("importe_dolares", usd)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          ) : (
            <div className="muted" style={{ fontSize: 13 }}>
              No hay activos para esta cuenta
              {text(detailParent.codigo_centro_costo).trim()
                ? " y centro de costo"
                : ""}.
            </div>
          )}
        </section>
      ) : null}

      <div className="muted" style={{ fontSize: 12 }}>
        Periodo {year && month
          ? `${MONTHS[Number(month) - 1]} ${year}`
          : "sin seleccionar"} · {visibleRows.length} filas.
      </div>

      <style jsx global>{`
        .fixassets-export-table table {
          font-size: 11px !important;
        }

        .fixassets-export-table .capex-th {
          padding: 6px !important;
          font-size: 11px !important;
          background: #163b49 !important;
          white-space: normal !important;
          line-height: 1.1;
        }

        .fixassets-export-table .capex-td {
          padding: 4px 6px !important;
          line-height: 1.15;
          border-bottom-color: rgba(147,211,230,.14) !important;
          white-space: nowrap;
        }

        @media (max-width: 1100px) {
          .fixassets-export-root {
            height: auto !important;
          }

          .fixassets-export-table {
            min-height: 520px !important;
          }

          .fixassets-export-detail {
            min-height: 0 !important;
            max-height: 320px !important;
          }
        }
      `}</style>
    </div>
  );
}