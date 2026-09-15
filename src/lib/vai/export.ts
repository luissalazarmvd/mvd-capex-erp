import type { jsPDF } from "jspdf";
import type { VaiFormat } from "./catalog";
import { formatValue, summarizeTable, toIsoDate, type VaiTableData, type VaiTableRow } from "./engine";

export type VaiExportTable = { data: VaiTableData; rows: VaiTableRow[] };
export type VaiExportBlock = { title: string; kind: "kpi" | "chart" | "table"; element: HTMLElement | null; table?: VaiExportTable };

function fileName(title: string) {
  return title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ").trim().slice(0, 120) || "V-Ai";
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function excelFormat(format: VaiFormat) {
  const numeric = "#,##0.00";
  if (format === "usd") return `"USD "${numeric}`;
  if (format === "pen") return `"S/ "${numeric}`;
  if (format === "percent" || format === "fraction") return "0.00%";
  if (format === "integer") return "#,##0";
  if (format === "km") return '#,##0" km"';
  if (format === "hours") return '#,##0.0" h"';
  if (format === "grade_oztc") return '#,##0.000" oz/TC"';
  if (format === "grade_gt") return `${numeric}" g/t"`;
  if (["tmh", "tms", "kg", "oz"].includes(format)) return `${numeric}" ${format === "tmh" || format === "tms" ? format.toUpperCase() : format}"`;
  if (format === "date") return "dd/mm/yyyy";
  return format === "text" ? "@" : numeric;
}

export async function createTableWorkbook(title: string, table: VaiExportTable) {
  const { Workbook } = await import("exceljs");
  const workbook = new Workbook();
  workbook.creator = "V-Ai · Veta Dorada";
  const sheet = workbook.addWorksheet("Datos", { views: [{ state: "frozen", ySplit: 4 }], pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  const { data, rows } = table;
  sheet.mergeCells(1, 1, 1, Math.max(1, data.columns.length));
  sheet.getCell(1, 1).value = title;
  sheet.getCell(1, 1).font = { name: "Arial", size: 18, bold: true, color: { argb: "FF0067AC" } };
  sheet.getRow(1).height = 32;
  sheet.getCell(2, 1).value = `${rows.length.toLocaleString("es-PE")} filas filtradas · todas las páginas`;
  sheet.getCell(2, 1).font = { name: "Arial", size: 10, color: { argb: "FF757679" } };
  sheet.getRow(4).values = data.columns.map((column) => column.label);
  rows.forEach((row) => sheet.addRow(row.map((value, index) => {
    const format = data.columns[index].format;
    if (format === "date") {
      const iso = toIsoDate(value);
      return iso ? new Date(`${iso}T00:00:00Z`) : null;
    }
    return format === "percent" && typeof value === "number" ? value / 100 : value;
  })));
  const end = 4 + rows.length;
  const summaries = summarizeTable(data, rows);
  const labelRow = sheet.getRow(end + 2);
  const totalRow = sheet.getRow(end + 3);
  summaries.forEach((summary, index) => {
    labelRow.getCell(index + 1).value = summary?.label ?? (index === 0 ? "Resumen" : null);
    if (!summary) return;
    const rule = data.summaryRules[index];
    const agg = rule?.operation === "auto" ? rule.metric?.agg : rule?.operation;
    const formulas: Record<string, string> = { sum: "SUM", min: "MIN", max: "MAX", avg: "AVERAGE" };
    const canFormula = agg && formulas[agg] && (rule?.operation !== "auto" || data.rowMembers.every((members) => members.length === 1) || agg === "sum");
    const value = data.columns[index].format === "percent" && summary.value != null ? summary.value / 100 : summary.value;
    const column = sheet.getColumn(index + 1).letter;
    totalRow.getCell(index + 1).value = canFormula && rows.length && value != null ? { formula: `${formulas[agg!]}(${column}5:${column}${end})`, result: value } : value;
  });
  data.columns.forEach((column, index) => {
    const col = sheet.getColumn(index + 1);
    col.numFmt = excelFormat(column.format);
    col.width = Math.min(50, Math.max(18, column.label.length + 3, ...rows.slice(0, 100).map((row) => String(row[index] ?? "").length + 2)));
    col.alignment = { vertical: "middle", horizontal: ["text", "date"].includes(column.format) ? "left" : "right" };
  });
  sheet.eachRow((row, number) => {
    if (number < 4) return;
    row.height = number === 4 ? 30 : 23;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: "Arial", size: 10, bold: number === 4 || number > end, color: { argb: number === 4 ? "FFFFFFFF" : "FF272727" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: number === 4 ? "FF0067AC" : number > end ? "FFFFEBC0" : number % 2 ? "FFF0F5F8" : "FFFFFFFF" } };
      if (number === 4) cell.alignment = { vertical: "middle", wrapText: true };
    });
  });
  sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: Math.max(4, end), column: data.columns.length } };
  workbook.calcProperties.fullCalcOnLoad = true;
  return workbook;
}

export async function downloadTableExcel(title: string, table: VaiExportTable) {
  const workbook = await createTableWorkbook(title, table);
  const bytes = new Uint8Array(await workbook.xlsx.writeBuffer());
  downloadBlob(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${fileName(title)}.xlsx`);
}

/** PDF propio: fondo hasta el borde, tablas completas y sin chrome de impresión. */
export async function createDashboardPdf(title: string, blocks: VaiExportBlock[], context: string[] = []): Promise<jsPDF> {
  const [{ jsPDF: Pdf }, { default: autoTable }, { default: html2canvas }] = await Promise.all([import("jspdf"), import("jspdf-autotable"), import("html2canvas")]);
  await document.fonts.ready;
  const pdf = new Pdf({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  pdf.setProperties({ title, author: "Veta Dorada", creator: "V-Ai" });
  const css = getComputedStyle(document.documentElement);
  const theme = { canvas: css.getPropertyValue("--s-canvas").trim(), panel: css.getPropertyValue("--s-1").trim(), alternate: css.getPropertyValue("--s-2").trim(), ink: css.getPropertyValue("--ink").trim(), muted: css.getPropertyValue("--ink-2").trim(), blue: css.getPropertyValue("--brand-blue").trim(), gold: css.getPropertyValue("--brand-gold").trim() };
  const pad = 12, gap = 5, width = 297 - pad * 2;
  let started = false, x = pad, y = 0, rowHeight = 0;
  let previousKind: VaiExportBlock["kind"] | null = null;
  const heading = (headingTitle: string, paint = true) => {
    const headingWidth = pdf.internal.pageSize.getWidth() - pad * 2;
    if (paint) {
      pdf.setFillColor(theme.canvas);
      pdf.rect(0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), "F");
      pdf.setFillColor(theme.gold);
      pdf.rect(pad, 10, 10, 1, "F");
    }
    pdf.setTextColor(theme.ink);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(17);
    const lines = pdf.splitTextToSize(headingTitle, headingWidth);
    if (paint) pdf.text(lines, pad, 21);
    let bottom = 23 + (lines.length - 1) * 7;
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(theme.muted);
    pdf.setFontSize(8);
    for (const line of context) {
      const wrapped = pdf.splitTextToSize(line, headingWidth);
      if (paint) pdf.text(wrapped, pad, bottom + 4);
      bottom += wrapped.length * 4;
    }
    return bottom + 8;
  };
  const newPage = (pageTitle: string, pageWidth = 297, height = 210, paint = true) => {
    if (started || pageWidth !== 297 || height !== 210) {
      pdf.addPage([pageWidth, height], height > pageWidth ? "portrait" : "landscape");
      if (!started) pdf.deletePage(1);
    }
    started = true;
    x = pad; rowHeight = 0; y = heading(pageTitle, paint);
  };
  for (const block of blocks) {
    if (block.kind === "table" && block.table) {
      const { data, rows } = block.table;
      const summaries = summarizeTable(data, rows);
      const body = rows.map((row) => row.map((cell, index) => formatValue(cell, data.columns[index].format)));
      body.push(summaries.map((summary, index) => summary ? `${summary.label}\n${formatValue(summary.value, data.columns[index].format)}` : index === 0 ? `Resumen\n${rows.length.toLocaleString("es-PE")} filas` : ""));
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(9);
      const columnWidths = data.columns.map((column, index) => {
        const contentWidth = body.reduce((max, row) => Math.max(max, ...row[index].split("\n").map((line) => pdf.getTextWidth(line) + 6)), 0);
        return Math.max(24, Math.min(column.format === "text" ? 60 : 40, Math.max(contentWidth, pdf.getTextWidth(column.label) + 6)));
      });
      // Formato apaisado según el ancho real: todas las columnas permanecen juntas.
      const totalWidth = columnWidths.reduce((sum, column) => sum + column, 0);
      const pageWidth = Math.max(297, totalWidth + pad * 2);
      newPage(block.title, pageWidth, Math.max(210, pageWidth * 210 / 297), false);
      autoTable(pdf, {
        head: [data.columns.map((column) => column.label)], body, startY: y,
        margin: { top: y, left: pad, right: pad, bottom: pad },
        styles: { font: "helvetica", fontSize: 9, cellPadding: 2.5, textColor: theme.ink, fillColor: theme.panel, lineWidth: 0, overflow: "linebreak" },
        headStyles: { fillColor: theme.blue, textColor: theme.ink, fontStyle: "bold" },
        alternateRowStyles: { fillColor: theme.alternate },
        columnStyles: Object.fromEntries(data.columns.map((column, index) => [index, { cellWidth: columnWidths[index] * (pageWidth - pad * 2) / totalWidth, halign: ["text", "date"].includes(column.format) ? "left" : "right" }])),
        rowPageBreak: "avoid",
        willDrawPage: () => { heading(block.title); },
        didParseCell: (hook) => { if (hook.section === "body" && hook.row.index === body.length - 1) { hook.cell.styles.fillColor = theme.blue; hook.cell.styles.fontStyle = "bold"; } },
      });
      // La siguiente gráfica comienza en una página nueva, sin cortar la tabla.
      y = 210; x = pad; rowHeight = 0;
      previousKind = "table";
      continue;
    }
    if (!block.element) continue;
    if (previousKind === "table") newPage(title);
    else if (previousKind && previousKind !== block.kind && x !== pad) { x = pad; y += rowHeight + gap; rowHeight = 0; }
    previousKind = block.kind;
    const kpiCount = blocks.filter((item) => item.kind === "kpi").length;
    const tileWidth = block.kind === "kpi" ? (width - gap * (Math.min(4, kpiCount) - 1)) / Math.min(4, kpiCount) : blocks.length === 1 ? width : (width - gap) / 2;
    if (block.kind === "kpi") {
      const label = block.element.querySelector(".vai-kpi > span")?.textContent ?? block.title;
      const value = block.element.querySelector(".vai-kpi > strong")?.textContent ?? "";
      const detail = block.element.querySelector(".vai-kpi > small")?.textContent ?? "";
      const inset = 4;
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(9);
      const labels = pdf.splitTextToSize(label, tileWidth - inset * 2);
      pdf.setFontSize(7);
      const details = pdf.splitTextToSize(detail, tileWidth - inset * 2);
      const tileHeight = 22 + labels.length * 4 + details.length * 3;
      if (!started) newPage(title);
      if (x + tileWidth > 297 - pad + .1) { x = pad; y += rowHeight + gap; rowHeight = 0; }
      if (y + tileHeight > pdf.internal.pageSize.getHeight() - pad) newPage(title);
      pdf.setFillColor(theme.panel); pdf.roundedRect(x, y, tileWidth, tileHeight, 2, 2, "F");
      pdf.setFillColor(theme.gold); pdf.rect(x + inset, y, tileWidth - inset * 2, .6, "F");
      pdf.setTextColor(theme.muted); pdf.setFont("helvetica", "normal"); pdf.setFontSize(9);
      pdf.text(labels, x + inset, y + 7);
      pdf.setTextColor(theme.ink); pdf.setFont("helvetica", "bold"); pdf.setFontSize(17);
      const valueSize = Math.min(17, 17 * (tileWidth - inset * 2) / Math.max(1, pdf.getTextWidth(value)));
      pdf.setFontSize(valueSize); pdf.text(value, x + inset, y + 15 + (labels.length - 1) * 4);
      pdf.setTextColor(theme.muted); pdf.setFont("helvetica", "normal"); pdf.setFontSize(7);
      pdf.text(details, x + inset, y + 23 + (labels.length - 1) * 4);
      x += tileWidth + gap; rowHeight = Math.max(rowHeight, tileHeight);
      continue;
    }
    const canvas = await html2canvas(block.element, { scale: 2, backgroundColor: theme.canvas, logging: false, useCORS: true,
      ignoreElements: (element) => element.hasAttribute("data-vai-export-ignore") || element.classList.contains("trjk-chart-data"),
    });
    const tileHeight = (canvas.height / canvas.width) * tileWidth;
    if (!started) newPage(title, 297, Math.max(210, tileHeight + 70));
    if (x + tileWidth > 297 - pad + .1) { x = pad; y += rowHeight + gap; rowHeight = 0; }
    if (y + tileHeight > pdf.internal.pageSize.getHeight() - pad) newPage(title, 297, Math.max(210, tileHeight + 70));
    pdf.addImage(canvas, "PNG", x, y, tileWidth, tileHeight);
    x += tileWidth + gap;
    rowHeight = Math.max(rowHeight, tileHeight);
  }
  if (!started) newPage(title);
  return pdf;
}

export async function downloadDashboardPdf(title: string, blocks: VaiExportBlock[], context: string[] = []) {
  const pdf = await createDashboardPdf(title, blocks, context);
  pdf.save(`${fileName(title)}.pdf`);
}
