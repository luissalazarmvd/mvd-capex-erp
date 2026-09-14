// Exportación Excel del Kardex TRJ: una hoja por detalle (guías, lotes y
// facturas) con todas las columnas que entrega el backend, salvo las marcas
// de auditoría created_at / updated_at.
import * as XLSX from "xlsx";

type KardexRow = Record<string, unknown>;

const EXCLUDED = new Set(["created_at", "updated_at"]);

// Medidas que viajan como texto decimal desde SQL y se exportan como número.
const NUMERIC =
  /^(?:tmh_|bags_|pu_transport_usd|amount_usd|calculated_amount_usd|invoice_amount_usd|guide_count)/;

const LABELS: Record<string, string> = {
  guide_number: "Guía",
  status_name: "Estado",
  lot: "Lote",
  lot_corr: "Correlativo",
  transport_name: "Transportista",
  transport_ruc: "RUC transportista",
  departure_date: "Salida",
  arrival_date: "Llegada",
  tmh_departure: "TMH salida",
  tmh_arrival: "TMH llegada",
  tmh_balance: "Saldo SGM",
  bags_tot: "Sacos totales",
  bags_used: "Sacos usados",
  pu_transport_usd: "USD/TMH",
  amount_usd: "USD",
  amount_usd_con: "USD Concar",
  calculated_amount_usd: "USD guías",
  document_number: "Factura",
  document_date: "Fecha factura",
  invoice_document_date: "Fecha factura",
  invoice_amount_usd_web: "USD factura web",
  invoice_amount_usd: "USD factura Concar",
  subledger_num: "Subdiario",
  comp_num: "Comprobante",
  secu_num: "Secuencia",
  ruc: "RUC",
  guide_count: "Guías",
  plate_1: "Placa camión",
  plate_2: "Placa carroza",
  driver_name: "Conductor",
  drive_license: "Licencia",
  guide_date: "Fecha guía",
  transport_guide_number: "Guía transportista",
  transport_guide_date: "Fecha guía transportista",
  sender_name: "Remitente",
  sender_ruc: "RUC remitente",
  recipient_name: "Destinatario",
  recipient_ruc: "RUC destinatario",
  origin_department: "Dpto. origen",
  origin_province: "Provincia origen",
  origin_district: "Distrito origen",
  origin_address: "Dirección origen",
  destination_department: "Dpto. destino",
  destination_province: "Provincia destino",
  destination_district: "Distrito destino",
  destination_address: "Dirección destino",
  load_ini: "Inicio carga",
  load_fin: "Fin carga",
  balance_obs: "Observación saldo",
};

function cell(key: string, value: unknown) {
  if (value == null || value === "") return "";
  const raw = String(value);
  if (NUMERIC.test(key) && Number.isFinite(Number(raw))) return Number(raw);
  // Fechas ISO de SQL: se conserva la lectura local sin desplazar la zona.
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
    const text = raw.replace("T", " ").slice(0, 19);
    return text.endsWith(" 00:00:00") ? text.slice(0, 10) : text;
  }
  return raw;
}

function sheet(rows: KardexRow[]) {
  const keys = [
    ...new Set(rows.flatMap((row) => Object.keys(row))),
  ].filter((key) => !EXCLUDED.has(key));
  const data = rows.map((row) =>
    Object.fromEntries(keys.map((key) => [LABELS[key] || key, cell(key, row[key])])),
  );
  const ws = XLSX.utils.json_to_sheet(data, {
    header: keys.map((key) => LABELS[key] || key),
  });
  ws["!cols"] = keys.map((key) => ({
    wch: Math.min(
      40,
      Math.max(
        (LABELS[key] || key).length + 2,
        ...rows.map((row) => String(cell(key, row[key])).length + 2),
      ),
    ),
  }));
  return ws;
}

export function exportKardexWorkbook(
  detail: { guides: KardexRow[]; lots: KardexRow[]; invoices: KardexRow[] },
  stamp: string,
) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet(detail.guides), "Guías");
  XLSX.utils.book_append_sheet(wb, sheet(detail.lots), "Lotes");
  XLSX.utils.book_append_sheet(wb, sheet(detail.invoices), "Facturas");
  XLSX.writeFile(wb, `kardex_trj_${stamp}.xlsx`);
}
