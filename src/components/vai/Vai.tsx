"use client";
import { createContext, memo, useCallback, useContext, useDeferredValue, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, } from "react";
import { createPortal } from "react-dom";
import { loadVaiSourceRows } from "../../lib/vai";
import { canUseLogScale, prefersLogScale, type ChartScaleMode } from "../../lib/chartScale";
import { COST_MONTH_OPTIONS, COST_DETAIL_COLUMNS, computeMatrix, matrixExportTable, costSummaryText, toText, type VaiMatrixNode, VAI_AREAS, VAI_VISUAL_CATALOG, VAI_PROMPT_MAX, VAI_SOURCES, VAI_SOURCE_MAP, applyFilters, chartAxisGroup, chartFormat, computeWidget, concarLabel, defaultFilterValues, deleteDashboard, distinctValues, filterKey, formatValue, formatDateLabel, limaToday, localizeVaiSource, monthBounds, monthsInRange, validIsoDate, widgetLocalFilters, getDashboard, listDashboards, parseStoredSpec, saveDashboard, sourceRequestPath, summarizeTable, undoDashboard, widgetDetailTable, vaiField, type VaiArea, type VaiChartPreference, type VaiDashboardRecord, type VaiDashboardSpec, type VaiExportBlock, type VaiExportTable, type VaiFilterSpec, type VaiFilterState, type VaiFilterValue, type VaiFocus, type VaiLanguage, type VaiRow, type VaiSortMode, type VaiSource, type VaiWidgetData, type VaiWidgetSpec, } from "../../lib/vai";
import { ChartLanguageProvider, MatrixChart, CHART_COLORS, CHART_OTHER, ColumnChart, ComboChart, DonutChart, HeatmapChart, WaterfallChart, KpiTooltip, LineChart, LollipopChart, RadarChart, RankChart, ScatterChart, type ChartRow, type ChartSeries, } from "../ui/Charts";
import { Button } from "../ui/Button";
import { ExcelHeaderFilter, useExcelColumnFilters, type ExcelColumnDef } from "../ui/ExcelFilters";
import { Select } from "../ui/Select";
import { VaiLogo } from "../ui/VaiLogo";
const VAI_UI_TEXT = {
    es: {
        filters: "Filtros", clearFilters: "Limpiar filtros", all: "Todos", none: "Ninguno", scale: "Escala", automatic: "Automática", linear: "Lineal", logarithmic: "Logarítmica", xAxis: "Eje X", split: "Segregar", noBreakdown: "Sin desglose", orderX: "Orden X", highLow: "Mayor a menor", lowHigh: "Menor a mayor", exactSummary: "Resumen exacto de", exactSubtitle: "valores agregados que alimentan el gráfico", backup: "Detalle de respaldo", backupSubtitle: "registros que justifican los grupos visibles", rows: "filas", edit: "Editar gráfico", editPlaceholder: "Ej.: conviértelo en un anillo por sede usando costo PEN", apply: "Aplicar", cancel: "Cancelar", editing: "Aplicando…", language: "Idioma", undo: "Deshacer", undoing: "Deshaciendo…", redo: "Rehacer", redoing: "Rehaciendo…", translating: "Traduciendo…", saved: "Guardado", unsaved: "Sin guardar", prompt: "Prompt", retry: "Reintentar guardado", refresh: "Actualizar datos", newDashboard: "Nuevo dashboard", notes: "Observaciones de la definición", exactRows: "registros", loadingData: "Obteniendo datos de las fuentes", preparing: "Preparando consultas…", source: "Fuente", noSource: "No se pudo resolver la fuente de este gráfico.", day: "día", week: "semana", month: "mes", quarter: "trimestre", year: "año"
    },
    en: {
        filters: "Filters", clearFilters: "Clear filters", all: "All", none: "None", scale: "Scale", automatic: "Automatic", linear: "Linear", logarithmic: "Logarithmic", xAxis: "X axis", split: "Break down", noBreakdown: "No breakdown", orderX: "X order", highLow: "High to low", lowHigh: "Low to high", exactSummary: "Exact summary of", exactSubtitle: "aggregated values feeding the chart", backup: "Supporting detail", backupSubtitle: "records supporting the visible groups", rows: "rows", edit: "Edit chart", editPlaceholder: "E.g. turn it into a donut by site using PEN cost", apply: "Apply", cancel: "Cancel", editing: "Applying…", language: "Language", undo: "Undo", undoing: "Undoing…", redo: "Redo", redoing: "Redoing…", translating: "Translating…", saved: "Saved", unsaved: "Not saved", prompt: "Prompt", retry: "Retry save", refresh: "Refresh data", newDashboard: "New dashboard", notes: "Definition notes", exactRows: "records", loadingData: "Fetching data from sources", preparing: "Preparing queries…", source: "Source", noSource: "The source for this chart could not be resolved.", day: "day", week: "week", month: "month", quarter: "quarter", year: "year"
    },
    fr: {
        filters: "Filtres", clearFilters: "Effacer les filtres", all: "Tous", none: "Aucun", scale: "Échelle", automatic: "Automatique", linear: "Linéaire", logarithmic: "Logarithmique", xAxis: "Axe X", split: "Ventiler", noBreakdown: "Sans ventilation", orderX: "Ordre X", highLow: "Du plus grand au plus petit", lowHigh: "Du plus petit au plus grand", exactSummary: "Résumé exact de", exactSubtitle: "valeurs agrégées alimentant le graphique", backup: "Détail justificatif", backupSubtitle: "enregistrements justifiant les groupes visibles", rows: "lignes", edit: "Modifier le graphique", editPlaceholder: "Ex. transforme-le en anneau par site avec le coût PEN", apply: "Appliquer", cancel: "Annuler", editing: "Application…", language: "Langue", undo: "Annuler le changement", undoing: "Annulation…", redo: "Rétablir", redoing: "Rétablissement…", translating: "Traduction…", saved: "Enregistré", unsaved: "Non enregistré", prompt: "Prompt", retry: "Réessayer l’enregistrement", refresh: "Actualiser les données", newDashboard: "Nouveau dashboard", notes: "Observations de la définition", exactRows: "enregistrements", loadingData: "Chargement des données des sources", preparing: "Préparation des requêtes…", source: "Source", noSource: "La source de ce graphique n’a pas pu être résolue.", day: "jour", week: "semaine", month: "mois", quarter: "trimestre", year: "année"
    },
} as const;

const VAI_UI_EXTRA = {
    es: {
        exportPreparing: "Preparando archivo…",
        exportHint: "Exporta el contenido del dashboard sin controles de configuración.",
        exportPdf: "Exportar dashboard a PDF",
        noData: "Sin datos para los filtros seleccionados.",
        lots: "lotes",
        loadingQuery: "Consultando",
        loadedRows: "filas cargadas",
        sourceError: "No se pudo consultar",
        updating: "Actualizando",
        dates: "Fechas",
        periods: "Períodos",
        noPeriodFilter: "Sin filtro de período",
        periodsSelected: "períodos seleccionados",
        noPeriod: "Ningún período",
        year: "Año",
        allYear: "Todo el año",
        clearSelection: "Quitar selección",
        applyPeriods: "Aplicar períodos",
        noFilter: "Sin filtro",
        invalidDateRange: "Revisa el rango de fechas.",
        comparableMonths: "Meses comparables",
        allMonths: "Todos los meses",
        monthsSelected: "meses seleccionados",
        noMonth: "Ningún mes",
        comparableMonthsHint: "El mismo recorte de meses para REAL 2025, REAL 2026 y PPTO 2026.",
        fromMonth: "Desde el mes",
        toMonth: "Hasta el mes",
        useRange: "Usar rango",
        addRange: "Agregar rango",
        removeRange: "Quitar rango",
        deselectAll: "Deseleccionar todo",
        selectAll: "Seleccionar todo",
        selected: "seleccionados",
        addToSelection: "Agregar a selección",
        removeFromSelection: "Quitar de selección",
        searchValues: "Buscar valores...",
        showingMatches: "Mostrando 250 de",
        matches: "coincidencias. Usa la búsqueda para acotar.",
        clear: "Limpiar",
        matrixRows: "Filas",
        matrixColumns: "Columnas",
        matrixExcelHint: "Excel exporta el último nivel, sin duplicar subtotales",
        matrixSource: "Fuente de la matriz",
        clearColumns: "Limpiar columnas",
        tableRows: "Filas",
        allRows: "Todas",
        previous: "Anterior",
        next: "Siguiente",
        summary: "Resumen",
        filteredSummary: "Resumen de las filas filtradas, por período",
        selectedDetail: "Detalle de la fila seleccionada",
        closeDetail: "Cerrar detalle",
        accountingBackup: "Glosas y respaldo contable",
        originalRecords: "Registros originales del grupo seleccionado",
        savedDashboards: "Mis dashboards",
        updateInventory: "Actualizar inventario",
        newShort: "Nuevo",
        loadingInventory: "Cargando…",
        emptyInventory: "Aún no hay dashboards guardados. El primero que generes aparecerá aquí.",
        deleteDashboard: "Eliminar dashboard",
        howWorks: "Cómo funciona",
        howWorksAi: "La IA solo recibe el catálogo de fuentes (nombres de campos, métricas y reglas), nunca registros, montos ni nombres reales.",
        howWorksData: "Los datos se consultan desde los endpoints existentes al abrir cada dashboard; los filtros no usan IA.",
        areas: {
            kardex: "Kardex TRJ",
            traceability: "Trazabilidad",
            finance: "Finanzas",
            fixassets: "Activos Fijos",
            planta: "Planta",
            refinery: "Refinería",
            logistics: "Logística",
            fleet: "Flota",
        },
    },
    en: {
        exportPreparing: "Preparing file…",
        exportHint: "Exports dashboard content without configuration controls.",
        exportPdf: "Export dashboard to PDF",
        noData: "No data for the selected filters.",
        lots: "lots",
        loadingQuery: "Querying",
        loadedRows: "rows loaded",
        sourceError: "Could not query",
        updating: "Updating",
        dates: "Dates",
        periods: "Periods",
        noPeriodFilter: "No period filter",
        periodsSelected: "periods selected",
        noPeriod: "No period",
        year: "Year",
        allYear: "Full year",
        clearSelection: "Clear selection",
        applyPeriods: "Apply periods",
        noFilter: "No filter",
        invalidDateRange: "Check the date range.",
        comparableMonths: "Comparable months",
        allMonths: "All months",
        monthsSelected: "months selected",
        noMonth: "No month",
        comparableMonthsHint: "The same month slice applies to REAL 2025, REAL 2026 and PPTO 2026.",
        fromMonth: "From month",
        toMonth: "To month",
        useRange: "Use range",
        addRange: "Add range",
        removeRange: "Remove range",
        deselectAll: "Deselect all",
        selectAll: "Select all",
        selected: "selected",
        addToSelection: "Add to selection",
        removeFromSelection: "Remove from selection",
        searchValues: "Search values...",
        showingMatches: "Showing 250 of",
        matches: "matches. Use search to narrow them down.",
        clear: "Clear",
        matrixRows: "Rows",
        matrixColumns: "Columns",
        matrixExcelHint: "Excel exports the last level without duplicating subtotals",
        matrixSource: "Matrix source",
        clearColumns: "Clear columns",
        tableRows: "Rows",
        allRows: "All",
        previous: "Previous",
        next: "Next",
        summary: "Summary",
        filteredSummary: "Summary of filtered rows by period",
        selectedDetail: "Selected-row detail",
        closeDetail: "Close detail",
        accountingBackup: "Descriptions and accounting support",
        originalRecords: "Original records supporting the selected group",
        savedDashboards: "My dashboards",
        updateInventory: "Refresh inventory",
        newShort: "New",
        loadingInventory: "Loading…",
        emptyInventory: "No saved dashboards yet. The first one you generate will appear here.",
        deleteDashboard: "Delete dashboard",
        howWorks: "How it works",
        howWorksAi: "AI receives only the source catalog (field names, metrics and rules), never records, amounts or real names.",
        howWorksData: "Data is queried from existing endpoints when each dashboard opens; filters do not use AI.",
        areas: {
            kardex: "TRJ Kardex",
            traceability: "Traceability",
            finance: "Finance",
            fixassets: "Fixed Assets",
            planta: "Plant",
            refinery: "Refinery",
            logistics: "Logistics",
            fleet: "Fleet",
        },
    },
    fr: {
        exportPreparing: "Préparation du fichier…",
        exportHint: "Exporte le contenu du dashboard sans les contrôles de configuration.",
        exportPdf: "Exporter le dashboard en PDF",
        noData: "Aucune donnée pour les filtres sélectionnés.",
        lots: "lots",
        loadingQuery: "Interrogation",
        loadedRows: "lignes chargées",
        sourceError: "Impossible d’interroger",
        updating: "Actualisation",
        dates: "Dates",
        periods: "Périodes",
        noPeriodFilter: "Sans filtre de période",
        periodsSelected: "périodes sélectionnées",
        noPeriod: "Aucune période",
        year: "Année",
        allYear: "Toute l’année",
        clearSelection: "Effacer la sélection",
        applyPeriods: "Appliquer les périodes",
        noFilter: "Sans filtre",
        invalidDateRange: "Vérifie la plage de dates.",
        comparableMonths: "Mois comparables",
        allMonths: "Tous les mois",
        monthsSelected: "mois sélectionnés",
        noMonth: "Aucun mois",
        comparableMonthsHint: "La même sélection de mois s’applique à REAL 2025, REAL 2026 et PPTO 2026.",
        fromMonth: "Du mois",
        toMonth: "Au mois",
        useRange: "Utiliser la plage",
        addRange: "Ajouter la plage",
        removeRange: "Retirer la plage",
        deselectAll: "Tout désélectionner",
        selectAll: "Tout sélectionner",
        selected: "sélectionnés",
        addToSelection: "Ajouter à la sélection",
        removeFromSelection: "Retirer de la sélection",
        searchValues: "Rechercher des valeurs...",
        showingMatches: "Affichage de 250 sur",
        matches: "correspondances. Utilise la recherche pour affiner.",
        clear: "Effacer",
        matrixRows: "Lignes",
        matrixColumns: "Colonnes",
        matrixExcelHint: "Excel exporte le dernier niveau sans dupliquer les sous-totaux",
        matrixSource: "Source de la matrice",
        clearColumns: "Effacer les colonnes",
        tableRows: "Lignes",
        allRows: "Toutes",
        previous: "Précédent",
        next: "Suivant",
        summary: "Résumé",
        filteredSummary: "Résumé des lignes filtrées par période",
        selectedDetail: "Détail de la ligne sélectionnée",
        closeDetail: "Fermer le détail",
        accountingBackup: "Libellés et justificatifs comptables",
        originalRecords: "Enregistrements d’origine justifiant le groupe sélectionné",
        savedDashboards: "Mes dashboards",
        updateInventory: "Actualiser l’inventaire",
        newShort: "Nouveau",
        loadingInventory: "Chargement…",
        emptyInventory: "Aucun dashboard enregistré. Le premier que tu génères apparaîtra ici.",
        deleteDashboard: "Supprimer le dashboard",
        howWorks: "Fonctionnement",
        howWorksAi: "L’IA reçoit uniquement le catalogue des sources (noms de champs, métriques et règles), jamais les enregistrements, montants ou noms réels.",
        howWorksData: "Les données sont interrogées via les endpoints existants à l’ouverture de chaque dashboard ; les filtres n’utilisent pas l’IA.",
        areas: {
            kardex: "Kardex TRJ",
            traceability: "Traçabilité",
            finance: "Finance",
            fixassets: "Immobilisations",
            planta: "Usine",
            refinery: "Raffinerie",
            logistics: "Logistique",
            fleet: "Flotte",
        },
    },
} as const;

const VaiLanguageContext = createContext<VaiLanguage>("es");

function useVaiUi() {
    const language = useContext(VaiLanguageContext);
    return {
        ...VAI_UI_TEXT[language],
        ...VAI_UI_EXTRA[language],
    };
}

type ExportContextValue = {
    busy: boolean;
    disabled: boolean;
    context: string[];
    run: (action: () => Promise<void>) => void;
    register: (id: string, order: number, get: () => VaiExportBlock) => () => void;
};
const ExportContext = createContext<ExportContextValue | null>(null);
export function VaiExportProvider({ title, context, disabled, children }: {
    title: string;
    context: string[];
    disabled: boolean;
    children: ReactNode;
}) {
    const ui = useVaiUi();
    const blocks = useRef(new Map<string, {
        order: number;
        get: () => VaiExportBlock;
    }>());
    const lock = useRef(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const register = useCallback((id: string, order: number, get: () => VaiExportBlock) => {
        blocks.current.set(id, { order, get });
        return () => { blocks.current.delete(id); };
    }, []);
    const run = useCallback((action: () => Promise<void>) => {
        if (lock.current)
            return;
        lock.current = true;
        setBusy(true);
        setError("");
        void action().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No se pudo exportar. Inténtalo de nuevo.")).finally(() => {
            lock.current = false;
            setBusy(false);
        });
    }, []);
    return (<ExportContext.Provider value={{ busy, disabled, context, run, register }}>
      <div className="vai-export-toolbar" data-vai-export-ignore>
        <span className="muted" aria-live="polite">{busy ? ui.exportPreparing : ui.exportHint}</span>
        <Button size="sm" disabled={disabled || busy} onClick={() => run(async () => {
            const { downloadDashboardPdf } = await import("../../lib/vai");
            await downloadDashboardPdf(
                title,
                [...blocks.current.values()]
                    .sort((a, b) => a.order - b.order)
                    .map((item) => item.get()),
                []
            );
        })}>{ui.exportPdf}</Button>
      </div>
      {error ? <div className="vai-message" data-error="true" role="alert">{error}</div> : null}
      {children}
    </ExportContext.Provider>);
}
export function VaiExportSection({ id, order = 0, title, kind, table, getTable, children, controls }: {
    id?: string;
    order?: number;
    title: string;
    kind: VaiExportBlock["kind"];
    table?: VaiExportTable;
    getTable?: () => VaiExportTable;
    children: ReactNode;
    controls?: ReactNode;
}) {
    const context = useContext(ExportContext);
    const ref = useRef<HTMLDivElement>(null);
    const register = context?.register;
    useEffect(() => {
        if (!id || !register)
            return;
        return register(id, order, () => ({ title, kind, table: table ?? getTable?.(), element: ref.current }));
    }, [id, register, order, title, kind, table, getTable]);
    return (<div className="vai-export-section" style={kind === "chart" ? { height: "100%", minWidth: 0 } : { minWidth: 0 }}>
      {controls || (kind === "table" && (table || getTable)) ? (<div className="vai-export-tools" data-vai-export-ignore>
          {controls}
          {kind === "table" && (table || getTable) ? (<button type="button" className="vai-icon-btn" disabled={!context || context.disabled || context.busy} aria-label={`Exportar ${title} a Excel`} title="Exportar a Excel" onClick={() => context?.run(async () => {
                    const { downloadTableExcel } = await import("../../lib/vai");
                    const exportTable = table ?? getTable?.();
                    if (exportTable) await downloadTableExcel(title, exportTable);
                })} style={{
                    width: 28,
                    height: 28,
                    display: "inline-grid",
                    placeItems: "center",
                    flex: "0 0 28px",
                }}>
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 3h11l5 5v13H4z"/>
                <path d="M15 3v5h5"/>
                <path d="M7.5 11l5 7"/>
                <path d="M12.5 11l-5 7"/>
              </svg>
            </button>) : null}
        </div>) : null}
      <div ref={ref} className="vai-export-content" style={kind === "chart" ? { height: "100%", minWidth: 0 } : { minWidth: 0 }}>
        {children}
      </div>
    </div>);
}
type VaiInventoryProps = {
    items: VaiDashboardRecord[];
    loading: boolean;
    error: string | null;
    currentId: number | null;
    onOpen: (item: VaiDashboardRecord) => void;
    onDelete: (item: VaiDashboardRecord) => void;
    onNew: () => void;
    onReload: () => void;
};
export function formatStamp(value: string | null | undefined, language: VaiLanguage = "es") {
    if (!value)
        return "";
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed))
        return String(value).slice(0, 16).replace("T", " ");
    const locale = language === "en"
        ? "en-US"
        : language === "fr"
            ? "fr-FR"
            : "es-PE";
    return new Date(parsed).toLocaleString(locale, {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}
function VaiInventory({ items, loading, error, currentId, onOpen, onDelete, onNew, onReload }: VaiInventoryProps) {
    const ui = useVaiUi();
    const language = useContext(VaiLanguageContext);
    return (<section className="trjk-card">
      <div className="trjk-toolbar">
        <h3>{ui.savedDashboards}</h3>
        <div className="trjk-actions">
          <Button size="sm" variant="ghost" onClick={onReload} disabled={loading} title={ui.updateInventory}>
            ↻
          </Button>
          <Button size="sm" variant="default" onClick={onNew}>
            + {ui.newShort}
          </Button>
        </div>
      </div>
      <div className="vai-inventory" style={{ marginTop: 10 }}>
        {error ? (<div className="vai-message" data-error="true">
            {error}
          </div>) : loading && !items.length ? (<div className="vai-empty">{ui.loadingInventory}</div>) : !items.length ? (<div className="vai-empty">{ui.emptyInventory}</div>) : (items.map((item) => (<div key={item.dashboard_id} className="vai-inventory-item" role="button" tabIndex={0} aria-current={item.dashboard_id === currentId} onClick={() => onOpen(item)} onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpen(item);
                }
            }}>
              <div style={{ minWidth: 0 }}>
                <strong>{concarLabel(item.dashboard_name)}</strong>
                {item.dashboard_desc ? <span>{concarLabel(item.dashboard_desc)}</span> : null}
                <small>{formatStamp(item.updated_at || item.created_at, language)}</small>
              </div>
              <button type="button" className="vai-icon-btn" title={ui.deleteDashboard} aria-label={`${ui.deleteDashboard}: ${concarLabel(item.dashboard_name)}`} onClick={(e) => {
                e.stopPropagation();
                onDelete(item);
            }}>
                ×
              </button>
            </div>)))}
      </div>
    </section>);
}
export type VaiPromptRequest = {
    prompt: string;
    area: VaiArea | "auto";
    focus: VaiFocus;
    charts: VaiChartPreference[];
};
const FOCUS_OPTIONS: Array<{
    value: VaiFocus;
    label: string;
}> = [
    { value: "auto", label: "Automático" },
    { value: "kpis", label: "KPIs y resumen" },
    { value: "trends", label: "Tendencias" },
    { value: "comparisons", label: "Comparaciones" },
    { value: "detail", label: "Detalle / tablas" },
];
const CHART_OPTIONS: Array<{
    value: VaiChartPreference;
    label: string;
}> = VAI_VISUAL_CATALOG.map((item) => ({ value: item.type, label: item.label }));
const CURATED_SOURCE_SUGGESTIONS: Record<string, string[]> = {
    finance_mineral_purchases: [
        "Mineral facturado por lote y proveedor, con USD, fecha de ingreso, valorización y pago del lote.",
        "Facturado/valorizado de traceability por oficina: USD, TMS y USD/TMS, por períodos YY_MMM.",
    ],
    finance_mineral_payments: [
        "Pagos de mineral por proveedor y oficina, con total USD y evolución mensual.",
        "Detalle de pagos de mineral con provisión, documento, proveedor, fecha de pago e importe USD.",
    ],
    finance_costs: [
        "Compara REAL 2026, REAL 2025 y PPTO 2026 de enero a julio en USD, con tarjetas y matriz por cuenta, proveedor y glosa.",
        "Costos en USD por Gerencia Lima y grupo de costos, con detalle mensual desplegable.",
    ],
};
function joinNatural(values: string[]) {
    const clean = values.map((value) => value.trim()).filter(Boolean);
    if (!clean.length)
        return "";
    if (clean.length === 1)
        return clean[0];
    if (clean.length === 2)
        return `${clean[0]} y ${clean[1]}`;
    return `${clean.slice(0, -1).join(", ")} y ${clean[clean.length - 1]}`;
}
function normalizeWidgetInstruction(value: string) {
    return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}
function isDeleteWidgetInstruction(value: string) {
    const text = normalizeWidgetInstruction(value).replace(/[.!?]+$/g, "");
    return /^(?:borra|elimina|quita|delete|remove|supprime|efface)(?:\s+(?:esto|este|esta|this|ce|cette))?(?:\s+(?:grafico|grafica|chart|widget|visual|graphique))?$/.test(text);
}
function simpleWidgetTypeInstruction(value: string): VaiWidgetSpec["type"] | null {
    const text = normalizeWidgetInstruction(value).replace(/[.!?]+$/g, "");
    const match = text.match(/^(?:(?:quiero|i want|je veux)\s+)?(?:que\s+)?(?:(?:sea|sean|cambialo a|cambiar a|conviertelo en|convertir a|make it|turn it into|change it to|transforme le en|passe le en)\s+)?(?:(?:un|una|a|an|the|le|la)\s+)?(?:(?:grafico|grafica|chart|graphique)\s+(?:de|tipo|type)?\s*)?(barras?|bar(?:s)?|columnas?|lineas?|lines?|area|areas|ranking|rank|lollipop|radar)$/);
    if (!match) return null;
    const token = match[1];
    if (/^(?:barras?|bars?|columnas?)$/.test(token)) return "bar";
    if (/^(?:lineas?|lines?)$/.test(token)) return "line";
    if (/^areas?$/.test(token)) return "area";
    if (/^(?:ranking|rank)$/.test(token)) return "rank";
    if (token === "lollipop") return "lollipop";
    if (token === "radar") return "radar";
    return null;
}
function typeOnlyWidgetPatch(widget: VaiWidgetSpec, type: VaiWidgetSpec["type"]): VaiWidgetSpec | null {
    if (widget.type === type) return widget;
    if (!["bar", "line", "area", "rank", "lollipop", "radar"].includes(type)) return null;
    if (!widget.dimension && !widget.dateField) return null;
    const metrics = type === "lollipop" ? widget.metrics.slice(0, 1) : type === "radar" ? widget.metrics.slice(0, 3) : [...widget.metrics];
    if (!metrics.length) return null;
    const seriesType = type === "bar" ? "bar" : type === "line" || type === "area" ? "line" : null;
    return {
        ...widget,
        type,
        metrics,
        seriesTypes: seriesType ? metrics.map(() => seriesType) : null,
        seriesAxes: seriesType ? widget.seriesAxes?.slice(0, metrics.length) ?? null : null,
        breakdown: ["bar", "line", "area"].includes(type) ? widget.breakdown ?? null : null,
        stack: type === "bar" ? widget.stack ?? null : null,
        cumulative: type === "line" || type === "area" ? widget.cumulative ?? null : null,
        includeOthers: type === "rank" ? widget.includeOthers ?? false : null,
        bins: null,
    };
}
function addedTableColumns(widget: VaiWidgetSpec, source: VaiSource | undefined, instruction: string) {
    if (widget.type !== "table" || !widget.columns?.length || !source) return null;
    const text = normalizeWidgetInstruction(instruction);
    if (!/\b(?:agrega|anade|incluye|sumale|add|include|ajoute|ajouter)\b/.test(text) || !/\b(?:columna|columnas|column|columns|colonne|colonnes)\b/.test(text)) return null;
    const mentioned = source.fields.filter((field) => {
        const aliases = [field.id.replace(/_/g, " "), field.label].map(normalizeWidgetInstruction).filter((alias) => alias.length >= 3);
        return aliases.some((alias) => text.includes(alias));
    }).map((field) => field.id);
    if (!mentioned.length) return null;
    const columns = [...new Set([...widget.columns, ...mentioned])].slice(0, 12);
    return columns.length === widget.columns.length ? null : columns;
}

function sourceSuggestions(source: VaiSource) {
    const metrics = source.metrics;
    const dimensions = source.fields.filter((field) => field.role === "dimension");
    const dates = source.fields.filter((field) => field.role === "date");
    const detailFields = source.fields.filter((field) => field.role === "dimension" ||
        field.role === "attribute" ||
        field.role === "date");
    const metric1 = metrics[0];
    const metric2 = metrics[1];
    const metric3 = metrics[2];
    const dimension1 = dimensions[0];
    const dimension2 = dimensions[1] ?? dimension1;
    const date1 = dates[0];
    const suggestions: string[] = [...(CURATED_SOURCE_SUGGESTIONS[source.id] ?? [])];
    if (metric1) {
        suggestions.push(`Quiero ver ${joinNatural([metric1.label, metric2?.label ?? ""].filter(Boolean))}${dimension1 ? ` por ${dimension1.label}` : ""}${date1 ? `, con evolución mensual según ${date1.label}` : ""}.`);
    }
    if (metric1 && dimension1) {
        suggestions.push(`Compara ${metric1.label} por ${dimension1.label}${metric2 ? ` y muestra también ${metric2.label}` : ""}.`);
    }
    if (metric1 && metric2 && dimension1) {
        suggestions.push(`${dimension1.label} en el eje X, ${metric1.label} en barras y ${metric2.label} en línea.`);
    }
    if (metric1 && date1 && dimensions[1]) {
        suggestions.push(`Evolución mensual de ${metric1.label} según ${date1.label}, en barras apiladas por ${dimensions[1].label}.`);
    }
    if (metric1 && metric2 && dimension1 && metric1.format !== metric2.format) {
        suggestions.push(`Dispersión de ${metric1.label} frente a ${metric2.label} por ${dimension1.label}.`);
    }
    if (metric1 && dimension2) {
        suggestions.push(`Ranking de ${dimension2.label} por ${metric1.label}${metric2 ? `, junto con ${metric2.label}` : ""}.`);
    }
    if (date1 && metric1) {
        suggestions.push(`Muéstrame la tendencia de ${joinNatural([metric1.label, metric2?.label ?? "", metric3?.label ?? ""].filter(Boolean))} usando ${date1.label}.`);
    }
    if (metrics.length) {
        suggestions.push(`Resumen de ${source.name.toLowerCase()} con KPIs de ${joinNatural(metrics.slice(0, 3).map((metric) => metric.label))}${dimension1 ? ` y comparación por ${dimension1.label}` : ""}.`);
    }
    if (detailFields.length) {
        suggestions.push(`Quiero un detalle de ${source.name.toLowerCase()} con ${joinNatural(detailFields.slice(0, 5).map((field) => field.label))}.`);
    }
    return suggestions;
}
function seededShuffle<T>(items: T[], seed: number) {
    const out = [...items];
    let state = Math.max(1, Math.floor(seed * 2147483646));
    for (let i = out.length - 1; i > 0; i -= 1) {
        state = (state * 48271) % 2147483647;
        const j = state % (i + 1);
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}
function buildSuggestions(area: VaiArea | "auto", seed: number) {
    const sources = VAI_SOURCES.filter((source) => source.enabled &&
        (area === "auto" || source.area === area));
    const pool = [
        ...new Set(sources.flatMap((source) => sourceSuggestions(source))),
    ];
    return seededShuffle(pool, seed);
}
function VaiPromptForm({ busy, initial, onGenerate }: {
    busy: boolean;
    initial?: VaiPromptRequest | null;
    onGenerate: (request: VaiPromptRequest) => void;
}) {
    const [prompt, setPrompt] = useState(initial?.prompt ?? "");
    const [area, setArea] = useState<VaiArea | "auto">(initial?.area ?? "auto");
    const [focus, setFocus] = useState<VaiFocus>(initial?.focus ?? "auto");
    const [charts, setCharts] = useState<VaiChartPreference[]>(initial?.charts ?? []);
    const [suggestionSeed] = useState(() => Math.random());
    const suggestionPool = useMemo(() => buildSuggestions(area, suggestionSeed), [area, suggestionSeed]);
    const examples = suggestionPool.slice(0, 4);
    const hint = suggestionPool[4] ??
        suggestionPool[0] ??
        "Describe el análisis que necesitas usando la información disponible en V-Ai.";
    const length = prompt.length;
    const ready = prompt.trim().length >= 8 && length <= VAI_PROMPT_MAX && !busy;
    const customized = area !== "auto" || focus !== "auto" || charts.length > 0;
    function submit() {
        if (!ready)
            return;
        onGenerate({ prompt: prompt.trim(), area, focus, charts });
    }
    return (<section className="vai-hero">
      <div className="vai-hero-glow" aria-hidden="true"/>

      <div className="vai-brand">
        <div className="vai-brand-body">
          <VaiLogo size={88}/>
        </div>
      </div>

      <p className="vai-hero-tag">Describe el dashboard que necesitas. V-Ai lo construye con el catálogo de fuentes de Veta.</p>

      <div className="vai-composer" data-busy={busy}>
        <textarea value={prompt} maxLength={VAI_PROMPT_MAX} placeholder={`Ej.: ${hint}`} onChange={(e) => setPrompt(e.target.value.slice(0, VAI_PROMPT_MAX))} onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey))
                submit();
        }} disabled={busy} aria-label="Descripción del dashboard"/>
        <div className="vai-composer-foot">
          <span className="vai-counter" data-limit={length >= VAI_PROMPT_MAX}>
            {length.toLocaleString("es-PE")} / {VAI_PROMPT_MAX.toLocaleString("es-PE")} · Ctrl+Enter
          </span>
          <button type="button" className="vai-send" onClick={submit} disabled={!ready} aria-label="Generar dashboard" title="Generar dashboard (Ctrl+Enter)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 19V5"/>
              <path d="M5 12l7-7 7 7"/>
            </svg>
          </button>
        </div>
      </div>

      <details className="vai-options" data-custom={customized}>
        <summary>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h9M18 7h2M4 17h4M13 17h7"/>
            <circle cx="15.5" cy="7" r="2.4"/>
            <circle cx="10.5" cy="17" r="2.4"/>
          </svg>
          Personalizar
          {customized ? <i className="vai-dot" aria-label="Con preferencias"/> : null}
        </summary>
        <div className="vai-options-grid">
          <Select label="Área / fuente" placeholder="" value={area} onChange={(e) => setArea(e.target.value as VaiArea | "auto")} options={[{ value: "auto", label: "Automático" }, ...VAI_AREAS.map((item) => ({ value: item.id, label: item.label }))]}/>
          <Select label="Prioridad visual" placeholder="" value={focus} onChange={(e) => setFocus(e.target.value as VaiFocus)} options={FOCUS_OPTIONS}/>
          <div style={{ display: "grid", gap: 6 }}>
            <div className="vd-label">Tipos de gráfico preferidos</div>
            <div className="vai-check-list">
              {CHART_OPTIONS.map((option) => {
            const on = charts.includes(option.value);
            return (<label key={option.value} className="vai-chip" data-on={on}>
                    <input type="checkbox" checked={on} onChange={() => setCharts((prev) => (on ? prev.filter((item) => item !== option.value) : [...prev, option.value]))}/>
                    {option.label}
                  </label>);
        })}
            </div>
            <div className="muted" style={{ fontSize: 11 }}>Sin selección = automático.</div>
          </div>
        </div>
      </details>

      <div className="vai-examples" aria-label="Ejemplos">
        <div className="vd-label">
          {area === "auto"
            ? "Ideas según las fuentes disponibles"
            : `Ideas de ${VAI_AREAS.find((item) => item.id === area)?.label ?? "esta área"}`}
        </div>
        {examples.map((example) => (<button key={example} type="button" onClick={() => setPrompt(example)} disabled={busy}>
            {example}
          </button>))}
      </div>
    </section>);
}
const EMPTY_VAI_ROWS: VaiRow[] = [];
type SourceState = {
    rows: VaiRow[];
    loading: boolean;
    error: string | null;
    loadedAt: number | null;
    progress?: string;
};
type VaiCrossFilter = {
    source: string;
    token: string;
    label: string;
    members: Set<VaiRow>;
};
type VaiDashboardProps = {
    spec: VaiDashboardSpec;
    refreshToken?: number;
    editingWidget?: number | null;
    onEditWidget: (index: number, instruction: string) => void;
};
function VaiDashboard({ spec, refreshToken = 0, editingWidget = null, onEditWidget }: VaiDashboardProps) {
    const ui = useVaiUi();
    const sourceIdsKey = spec.sources.join("|");
    const rawSources = useMemo(
        () => spec.sources
            .map((id) => VAI_SOURCE_MAP.get(id))
            .filter((source): source is VaiSource => Boolean(source)),
        [sourceIdsKey]
    );
    const sources = useMemo(
        () => rawSources.map((source) => localizeVaiSource(source, spec)),
        [rawSources, spec.language, spec.locale]
    );
    const sourceMap = useMemo(
        () => new Map(sources.map((source) => [source.id, source])),
        [sources]
    );
    const [data, setData] = useState<Record<string, SourceState>>({});
    const [filters, setFilters] = useState<VaiFilterState>({});
    const [crossFilter, setCrossFilter] = useState<VaiCrossFilter | null>(null);
    const filterDefinitionKey = useMemo(
        () => JSON.stringify(spec.filters.map((filter) => filter.kind === "date_range"
            ? [
                filter.kind,
                filter.source,
                filter.field,
                filter.preset ?? null,
                filter.from ?? null,
                filter.to ?? null,
                filter.mode ?? null,
            ]
            : [
                filter.kind,
                filter.source,
                filter.field,
                filter.values ?? null,
            ])),
        [spec.filters]
    );
    const requestKey = useMemo(
        () => JSON.stringify(Object.fromEntries(
            rawSources.map((source) => [
                source.id,
                sourceRequestPath(source, spec.filters, filters),
            ])
        )),
        [rawSources, spec.filters, filters]
    );
    const cache = useRef(new Map<string, {
        path: string;
        refresh: number;
        state: SourceState;
    }>());
    useEffect(() => {
        setFilters({});
        setCrossFilter(null);
    }, [filterDefinitionKey]);
    useEffect(() => {
        setCrossFilter(null);
    }, [requestKey, refreshToken]);
    useEffect(() => {
        const controller =
            new AbortController();

        const paths = JSON.parse(
            requestKey
        ) as Record<string, string>;

        const changed = rawSources.filter(
            (source) => {
                const entry =
                    cache.current.get(
                        source.id
                    );

                return (
                    !entry ||
                    entry.path !==
                        paths[source.id] ||
                    entry.refresh !==
                        refreshToken
                );
            }
        );

        setData((previous) => {
            const next = {
                ...previous,
            };

            for (const source of rawSources) {
                const entry =
                    cache.current.get(
                        source.id
                    );

                next[source.id] =
                    entry &&
                    entry.path ===
                        paths[source.id] &&
                    entry.refresh ===
                        refreshToken
                        ? entry.state
                        : {
                            rows:
                                EMPTY_VAI_ROWS,
                            loading: true,
                            error: null,
                            loadedAt: null,
                            progress:
                                "Preparando consulta…",
                        };
            }

            return rawSources.every(
                (source) =>
                    next[source.id] ===
                    previous[source.id]
            )
                ? previous
                : next;
        });

        // Evita iniciar otra consulta por cada
        // clic rápido del multiselect.
        const timer = window.setTimeout(() => {
            for (const source of changed) {
                const path =
                    paths[source.id] ??
                    source.endpoint;

                const fresh =
                    refreshToken > 0 &&
                    cache.current.get(
                        source.id
                    )?.refresh !==
                        refreshToken;

                void loadVaiSourceRows(
                    source,
                    path,
                    {
                        signal:
                            controller.signal,
                        fresh,
                        onProgress: (
                            progress
                        ) => {
                            if (
                                controller
                                    .signal
                                    .aborted
                            ) {
                                return;
                            }

                            setData(
                                (previous) => ({
                                    ...previous,
                                    [source.id]: {
                                        ...previous[
                                            source.id
                                        ],
                                        progress,
                                    },
                                })
                            );
                        },
                    }
                )
                    .then((rows) => {
                        if (
                            controller
                                .signal
                                .aborted
                        ) {
                            return;
                        }

                        const state: SourceState = {
                            rows,
                            loading: false,
                            error: null,
                            loadedAt:
                                Date.now(),
                        };

                        cache.current.set(
                            source.id,
                            {
                                path,
                                refresh:
                                    refreshToken,
                                state,
                            }
                        );

                        // Publicar esta fuente
                        // sin esperar las demás.
                        setData(
                            (previous) => ({
                                ...previous,
                                [source.id]:
                                    state,
                            })
                        );
                    })
                    .catch(
                        (error: unknown) => {
                            if (
                                controller
                                    .signal
                                    .aborted
                            ) {
                                return;
                            }

                            setData(
                                (previous) => ({
                                    ...previous,
                                    [source.id]: {
                                        rows:
                                            EMPTY_VAI_ROWS,
                                        loading:
                                            false,
                                        loadedAt:
                                            null,
                                        error:
                                            error instanceof Error
                                                ? error.message
                                                : "Error al consultar la fuente",
                                    },
                                })
                            );
                        }
                    );
            }
        }, 250);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [
        rawSources,
        requestKey,
        refreshToken,
    ]);
    const defaultFilters = useMemo(() => defaultFilterValues(spec.filters, VAI_SOURCE_MAP, {}), [spec.filters]);
    const effectiveFilters = useMemo<VaiFilterState>(() => {
        const next: VaiFilterState = { ...defaultFilters };
        for (const [key, value] of Object.entries(filters)) {
            next[key] = value;
        }
        return next;
    }, [defaultFilters, filters]);
    const deferredFilters = useDeferredValue(effectiveFilters);
    const filteredCache = useRef(new Map<string, {
        rows: VaiRow[];
        key: string;
        result: VaiRow[];
    }>());
    const filtered = useMemo(() => {
        const out: Record<string, VaiRow[]> = {};
        for (const source of sources) {
            const rows = data[source.id]?.rows ?? EMPTY_VAI_ROWS;
            const relevant = spec.filters.filter((filter) => filter.source === source.id);
            const crossToken = crossFilter?.source === source.id ? crossFilter.token : "";
            const key = `${JSON.stringify(relevant.map((filter) => [filter, deferredFilters[filterKey(filter)]]))}|cross:${crossToken}`;
            const previous = filteredCache.current.get(source.id);
            if (previous?.rows === rows && previous.key === key)
                out[source.id] = previous.result;
            else {
                const base = applyFilters(source, rows, relevant, deferredFilters);
                const result = crossFilter?.source === source.id
                    ? base.filter((row) => crossFilter.members.has(row))
                    : base;
                filteredCache.current.set(source.id, { rows, key, result });
                out[source.id] = result;
            }
        }
        return out;
    }, [sources, data, spec.filters, deferredFilters, crossFilter]);
    const filterOptionRows = useCallback((filter: VaiFilterSpec) => {
        const source = VAI_SOURCE_MAP.get(filter.source);
        if (!source)
            return [];
        if (source.id === "finance_costs")
            return data[source.id]?.rows ?? EMPTY_VAI_ROWS;
        return applyFilters(source, data[filter.source]?.rows ?? [], spec.filters.filter((item) => filterKey(item) !== filterKey(filter)), deferredFilters);
    }, [data, spec.filters, deferredFilters]);
    const applyCrossFilter = useCallback((source: string, token: string, label: string, members: VaiRow[]) => {
        setCrossFilter((previous) => previous?.source === source && previous.token === token
            ? null
            : { source, token, label, members: new Set(members) });
    }, []);
    const loading = sources.some((source) => data[source.id]?.loading ?? true);
    const loadingSources = sources.filter((source) => data[source.id]?.loading ?? true);
    const loadingText = loadingSources.map((source) => `${ui.loadingQuery} ${source.name}…`).join(" · ");
    const loadingRowsHelper = sources.map((source) => {
        const state = data[source.id];
        if (!state)
            return null;
        if (state.loading && state.progress && /filas/i.test(state.progress))
            return `${source.name}: ${state.progress.replace(/…$/, "")}`;
        if (!state.loading && !state.error && state.loadedAt != null)
            return `${source.name}: ${state.rows.length.toLocaleString("es-PE")} ${ui.loadedRows}`;
        return null;
    }).filter(Boolean).join(" · ");
    const exportContext = spec.filters.map((filter) => {
        const value = effectiveFilters[filterKey(filter)] ?? {};
        if (filter.kind === "date_range") {
            return value.periods !== undefined ? `${filter.label}: ${value.periods.length ? value.periods.map((period) => formatDateLabel(period, "month")).join(", ") : "Ningún período"}` : `${filter.label}: ${value.from || "Sin límite"} a ${value.to || "Sin límite"}`;
        }
        const selected = value.values ??
            (value.value
                ? [value.value]
                : undefined);
        return `${filter.label}: ${selected === undefined
            ? "Todos"
            : selected.length
                ? selected.join(", ")
                : "Ninguno"}`;
    });
    const kpis = spec.widgets.filter((widget) => widget.type === "kpi");
    const others = spec.widgets.filter((widget) => widget.type !== "kpi");
    const widgetSpan = (index: number) => {
        const widget = others[index];
        if (!widget || ["matrix", "table", "combo", "heatmap", "waterfall", "pareto"].includes(widget.type))
            return "2";
        let runStart = index;
        while (runStart > 0 && !["matrix", "table", "combo", "heatmap", "waterfall", "pareto"].includes(others[runStart - 1]?.type))
            runStart -= 1;
        let runEnd = index;
        while (runEnd + 1 < others.length && !["matrix", "table", "combo", "heatmap", "waterfall", "pareto"].includes(others[runEnd + 1]?.type))
            runEnd += 1;
        const runLength = runEnd - runStart + 1;
        return index === runEnd && runLength % 2 === 1 ? "2" : "1";
    };
    const hasFilters = Boolean(crossFilter) || spec.filters.some((filter) => {
        const key = filterKey(filter);
        const value = filters[key];
        if (!value)
            return false;
        if (filter.kind === "select") {
            return (value.values !== undefined ||
                Boolean(value.value));
        }
        const defaults = defaultFilters[key] ?? {};
        if (value.periods !== undefined)
            return true;
        return ((value.from ?? defaults.from ?? "") !== (defaults.from ?? "") ||
            (value.to ?? defaults.to ?? "") !== (defaults.to ?? ""));
    });
    return (<div className="vai-board">
      {loading ? (<div className="vai-data-loading" role="status" aria-live="polite" aria-busy="true">
          <div className="vai-data-loading-card">
            <div className="vai-data-loading-logo"><VaiLogo size={118} title="V-Ai cargando datos"/></div>
            <strong>{ui.loadingData}</strong>
            <span className="muted">{loadingText || ui.preparing}</span>
            {loadingRowsHelper ? <small className="muted" style={{ fontSize: 11, lineHeight: 1.5, textAlign: "center", maxWidth: 460, whiteSpace: "normal", overflowWrap: "anywhere" }}>{loadingRowsHelper}</small> : null}
          </div>
        </div>) : null}
      <VaiExportProvider title={spec.title} context={exportContext} disabled={loading || sources.some((source) => Boolean(data[source.id]?.error))}>
      {spec.description ? <p className="muted" style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere", overflow: "visible", textOverflow: "clip", maxHeight: "none" }}>{spec.description}</p> : null}

      {spec.filters.length ? (<section className="trjk-card" data-vai-export-ignore style={{ padding: 12, minWidth: 0 }}>
          <div className="trjk-toolbar" style={{ alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h3 style={{ marginRight: "auto" }}>{ui.filters}</h3>
            <div className="trjk-actions" style={{ flexWrap: "wrap" }}>
              {crossFilter ? <Button size="sm" variant="ghost" title={ui.clearFilters} onClick={() => setCrossFilter(null)}>✕ {crossFilter.label}</Button> : null}
              {hasFilters ? (<Button size="sm" variant="ghost" onClick={() => {
                    setFilters({});
                    setCrossFilter(null);
                }}>
                  {ui.clearFilters}
                </Button>) : null}
            </div>
          </div>
          <div className="vai-filters" style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))", gap: 8, alignItems: "start", width: "100%", minWidth: 0 }}>
            {spec.filters.map((filter) => (<FilterControl key={filterKey(filter)} filter={filter} rows={filter.kind === "date_range" ? EMPTY_VAI_ROWS : filterOptionRows(filter)} value={effectiveFilters[filterKey(filter)] ?? {}} onChange={(value) => setFilters((prev) => ({ ...prev, [filterKey(filter)]: value }))}/>))}
          </div>
        </section>) : null}

      <div className="vai-board-meta" style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        {sources.map((source) => {
            const state = data[source.id];
            return (<span key={source.id} title={`${source.endpoint} · ${source.grain}`}>
              {ui.areas[source.area]} · {source.name}:{" "}
              {state?.loading ? (state.progress || "cargando…") : state?.error ? <span style={{ color: "var(--bad)" }}>error</span> : `${(filtered[source.id] ?? []).length.toLocaleString("es-PE")} / ${(state?.rows ?? []).length.toLocaleString("es-PE")} ${ui.rows}`}
            </span>);
        })}
      </div>

      {sources.map((source) => data[source.id]?.error ? (<div key={source.id} className="vai-message" data-error="true">
            {ui.sourceError} «{source.name}»: {data[source.id].error}
          </div>) : null)}

      {kpis.length ? (<div className="vai-kpi-grid">
          {kpis.filter((widget) => !data[widget.source]?.error).map((widget, i) => {
            const widgetIndex = spec.widgets.indexOf(widget);
            return <ScopedWidget key={`${widget.source}-${widget.metrics[0]}-${i}`} id={`kpi-${i}`} order={i} widget={widget} source={sourceMap.get(widget.source)} rows={filtered[widget.source] ?? EMPTY_VAI_ROWS} loading={data[widget.source]?.loading ?? true} trendDateField={spec.filters.find((filter): filter is Extract<VaiFilterSpec, {
                kind: "date_range";
            }> => filter.kind === "date_range" && filter.source === widget.source)?.field ?? null} editor={<WidgetPromptEditor widget={widget} busy={editingWidget === widgetIndex} onSubmit={(instruction) => onEditWidget(widgetIndex, instruction)}/>} crossFilterToken={crossFilter?.source === widget.source ? crossFilter.token : null} onCrossFilter={applyCrossFilter}/>;
        })}
        </div>) : null}

      {others.length ? (<div className="vai-widget-grid" style={{ alignItems: "stretch" }}>
          {others.map((widget, i) => {
            const widgetIndex = spec.widgets.indexOf(widget);
            return <div key={`${widget.type}-${widget.source}-${i}`} data-span={widgetSpan(i)} style={{ minWidth: 0, height: "100%", gridColumn: widgetSpan(i) === "2" ? "1 / -1" : undefined }}>
              {data[widget.source]?.loading ? <section className="trjk-card" role="status">{ui.updating} {widget.title}…</section> : data[widget.source]?.error ? null : <ScopedWidget id={`widget-${i}`} order={kpis.length + i} widget={widget} source={sourceMap.get(widget.source)} rows={filtered[widget.source] ?? EMPTY_VAI_ROWS} editor={<WidgetPromptEditor widget={widget} busy={editingWidget === widgetIndex} onSubmit={(instruction) => onEditWidget(widgetIndex, instruction)}/>} crossFilterToken={crossFilter?.source === widget.source ? crossFilter.token : null} onCrossFilter={applyCrossFilter}/>}
            </div>;
        })}
        </div>) : null}
      </VaiExportProvider>
    </div>);
}
function DateFilterControl({ filter, value, onChange }: {
    filter: Extract<VaiFilterSpec, {
        kind: "date_range";
    }>;
    value: VaiFilterValue;
    onChange: (value: VaiFilterValue) => void;
}) {
    const ui = useVaiUi();
    const [from, setFrom] = useState(value.from ?? "");
    const [to, setTo] = useState(value.to ?? "");
    const [mode, setMode] = useState<"range" | "period">(value.mode ?? filter.mode ?? "range");
    const [periods, setPeriods] = useState<string[] | undefined>(value.periods);
    const [year, setYear] = useState(Number((value.from || limaToday()).slice(0, 4)));
    const signature = JSON.stringify(value.periods);
    const root = useRef<HTMLDetailsElement | null>(null);
    useEffect(() => {
        setFrom(value.from ?? "");
        setTo(value.to ?? "");
        setMode(value.mode ?? filter.mode ?? "range");
        setPeriods(value.periods ?? (value.from && value.to ? monthsInRange(value.from, value.to) : undefined));
    }, [value.from, value.to, value.mode, signature, filter.mode]);
    useEffect(() => {
        const close = (event: PointerEvent) => {
            if (root.current && !root.current.contains(event.target as Node))
                root.current.open = false;
        };
        const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && root.current)
            root.current.open = false; };
        document.addEventListener("pointerdown", close);
        document.addEventListener("keydown", escape);
        return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
    }, []);
    const valid = mode === "period" || ((!from || Boolean(validIsoDate(from))) && (!to || Boolean(validIsoDate(to))) && (!from || !to || from <= to));
    const options = Number.isInteger(year) && year >= 1900 && year <= 2199
        ? Array.from({ length: 12 }, (_, index) => `${String(year).padStart(4, "0")}-${String(index + 1).padStart(2, "0")}`)
        : [];
    const appliedPeriods = value.periods;
    const appliedMode = value.mode ?? filter.mode ?? "range";
    const summary = appliedMode === "period"
        ? appliedPeriods === undefined
            ? ui.noPeriodFilter
            : appliedPeriods.length === 0
                ? ui.noPeriod
                : appliedPeriods.length === 1
                    ? formatDateLabel(appliedPeriods[0], "month")
                    : `${appliedPeriods.length} ${ui.periodsSelected}`
        : value.from || value.to
            ? `${value.from || "…"} → ${value.to || "…"}`
            : ui.noFilter;
    const apply = () => {
        if (!valid)
            return;
        if (root.current)
            root.current.open = false;
        if (mode === "period") {
            const selected = periods === undefined ? undefined : [...new Set(periods)].sort();
            const bounds = selected ? monthBounds(selected) : null;
            onChange({ mode, periods: selected, from: bounds?.from ?? "", to: bounds?.to ?? "" });
        }
        else
            onChange({ mode, from, to });
    };
    const clear = () => {
        setFrom("");
        setTo("");
        setPeriods(undefined);
        onChange({ mode, from: "", to: "" });
        if (root.current) root.current.open = false;
    };
    return <div title={VAI_SOURCE_MAP.get(filter.source)?.name} style={{ display: "grid", gap: 5, minWidth: 0, width: "100%" }}>
      <span className="vd-label" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{filter.label}</span>
      <details ref={root} style={{ position: "relative", minWidth: 0, width: "100%" }}>
        <summary className="select" title={summary} style={{ listStyle: "none", cursor: "pointer", userSelect: "none", width: "100%", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {summary}
        </summary>
        <div className="trjk-card" style={{ position: "absolute", zIndex: 520, top: "calc(100% + 5px)", left: 0, width: "min(520px, calc(100vw - 32px))", maxWidth: "calc(100vw - 32px)", padding: 12, display: "grid", gap: 10, boxShadow: "0 14px 34px rgba(0,0,0,.38)", background: "var(--s-1)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 128px", gap: 8, alignItems: "end" }}>
            <strong style={{ fontSize: 12, overflowWrap: "anywhere" }}>{filter.label}</strong>
            <label style={{ display: "grid", gap: 4 }}>
              <span className="muted" style={{ fontSize: 10 }}>{ui.periods}</span>
              <select className="select" aria-label={`Modo de ${filter.label}`} value={mode} onChange={(event) => {
                  const next = event.target.value as "range" | "period";
                  if (next === "period" && from && to) setPeriods(monthsInRange(from, to));
                  setMode(next);
              }}>
                <option value="range">{ui.dates}</option>
                <option value="period">{ui.periods}</option>
              </select>
            </label>
          </div>
          {mode === "range" ? <div className="vai-range" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
            <input className="input" aria-label={`${filter.label}: desde`} type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)}/>
            <input className="input" aria-label={`${filter.label}: hasta`} type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)}/>
          </div> : <>
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <span className="muted">{ui.year}</span>
              <input className="input" type="number" aria-label={`${ui.year}: ${filter.label}`} min={1900} max={2199} value={year} onChange={(event) => setYear(Number(event.target.value))} style={{ width: 96 }}/>
              <Button size="sm" variant="ghost" onClick={() => setPeriods((previous) => [...new Set([...(previous ?? []), ...options])])}>{ui.allYear}</Button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 7 }}>
              {options.map((period) => <label key={period} style={{ display: "flex", gap: 5, alignItems: "center", minWidth: 0 }}>
                <input type="checkbox" checked={periods?.includes(period) ?? false} onChange={() => setPeriods((previous) => previous?.includes(period) ? previous.filter((item) => item !== period) : [...(previous ?? []), period])}/>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{formatDateLabel(period, "month")}</span>
              </label>)}
            </div>
          </>}
          {!valid ? <small role="alert" style={{ color: "var(--bad)" }}>{ui.invalidDateRange}</small> : null}
          <div style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: 8, paddingTop: 6, borderTop: "1px solid var(--line)" }}>
            {mode === "period" ? <Button size="sm" variant="ghost" onClick={() => setPeriods([])}>{ui.clearSelection}</Button> : null}
            <Button size="sm" variant="ghost" onClick={clear}>{ui.noFilter}</Button>
            <Button size="sm" onClick={apply} disabled={!valid}>{ui.apply}</Button>
          </div>
        </div>
      </details>
    </div>;
}
function CostMonthControl({ value, onChange }: { value: VaiFilterValue; onChange: (value: VaiFilterValue) => void }) {
    const ui = useVaiUi();
    const [selected, setSelected] = useState<string[] | undefined>(value.values);
    const [from, setFrom] = useState(1);
    const [to, setTo] = useState(12);
    const root = useRef<HTMLDetailsElement>(null);
    const signature = JSON.stringify(value.values);
    useEffect(() => { setSelected(value.values); }, [signature]);
    useEffect(() => {
        const close = (event: PointerEvent) => {
            if (root.current && !root.current.contains(event.target as Node)) root.current.open = false;
        };
        const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && root.current) root.current.open = false; };
        document.addEventListener("pointerdown", close);
        document.addEventListener("keydown", escape);
        return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
    }, []);
    const allMonthsSelected = selected === undefined || selected.length === COST_MONTH_OPTIONS.length;
    const apply = () => {
        onChange(selected === undefined || selected.length === COST_MONTH_OPTIONS.length ? {} : { values: [...selected].sort() });
        if (root.current) root.current.open = false;
    };
    return <div style={{ display: "grid", gap: 7, minWidth: 0, width: "100%", maxWidth: "100%" }}>
      <span className="vd-label">{ui.comparableMonths}</span>
      <details ref={root} style={{ position: "relative", minWidth: 0, maxWidth: "100%" }}>
        <summary className="select" style={{ cursor: "pointer", minWidth: 0, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value.values === undefined ? ui.allMonths : value.values.length ? `${value.values.length} ${ui.monthsSelected}` : ui.noMonth}</summary>
        <div className="trjk-card" style={{ position: "absolute", top: "calc(100% + 5px)", left: 0, width: "min(320px, calc(100vw - 32px))", maxWidth: "calc(100vw - 32px)", boxSizing: "border-box", zIndex: 500, background: "var(--s-1)", padding: 14, boxShadow: "0 14px 34px #0005", overflow: "hidden" }}>
          <small className="muted" style={{ whiteSpace: "normal" }}>{ui.comparableMonthsHint}</small>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "12px 0" }}>
            <select className="select" aria-label={ui.fromMonth} value={from} onChange={(event) => setFrom(Number(event.target.value))} style={{ flex: "1 1 110px", minWidth: 0 }}>{COST_MONTH_OPTIONS.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select>
            <select className="select" aria-label={ui.toMonth} value={to} onChange={(event) => setTo(Number(event.target.value))} style={{ flex: "1 1 110px", minWidth: 0 }}>{COST_MONTH_OPTIONS.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select>
            <button type="button" disabled={from > to} onClick={() => setSelected(COST_MONTH_OPTIONS.slice(from - 1, to))} style={{ flex: "1 1 110px" }}>{ui.useRange}</button>
            <button type="button" disabled={from > to} onClick={() => setSelected((previous) => previous === undefined ? undefined : [...new Set([...previous, ...COST_MONTH_OPTIONS.slice(from - 1, to)])])} style={{ flex: "1 1 120px" }}>{ui.addRange}</button>
            <button type="button" disabled={from > to} onClick={() => {
                const remove = new Set(COST_MONTH_OPTIONS.slice(from - 1, to));
                setSelected((previous) => (previous ?? COST_MONTH_OPTIONS).filter((month) => !remove.has(month)));
            }} style={{ flex: "1 1 120px" }}>{ui.removeRange}</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 9 }}>
            {COST_MONTH_OPTIONS.map((month) => <label key={month} style={{ display: "flex", gap: 5, minWidth: 0 }}>
              <input type="checkbox" checked={selected === undefined || selected.includes(month)} onChange={() => setSelected((previous) => {
                  const next = previous ?? COST_MONTH_OPTIONS;
                  return next.includes(month) ? next.filter((item) => item !== month) : [...next, month];
              })}/><span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{month}</span>
            </label>)}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
            <button type="button" onClick={() => setSelected(allMonthsSelected ? [] : undefined)}>{allMonthsSelected ? ui.deselectAll : ui.selectAll}</button>
            <Button size="sm" onClick={apply}>{ui.apply}</Button>
          </div>
        </div>
      </details>
    </div>;
}
function FilterControl({ filter, rows, value, onChange, }: {
    filter: VaiFilterSpec;
    rows: VaiRow[];
    value: VaiFilterValue;
    onChange: (value: VaiFilterValue) => void;
}) {
    const ui = useVaiUi();
    const options = useMemo(() => filter.kind === "select"
        ? distinctValues(rows, filter.field, filter.source === "finance_costs" ? Infinity : 200)
        : [], [filter, rows]);
    const [search, setSearch] = useState("");
    const appliedSelected = value.values ??
        (value.value
            ? [value.value]
            : undefined);
    const appliedSignature = JSON.stringify(appliedSelected);
    const [draftSelected, setDraftSelected] = useState<string[] | undefined>(appliedSelected);
    useEffect(() => {
        setSearch("");
        setDraftSelected(appliedSelected);
    }, [filter.source, filter.field, appliedSignature]);
    const normalizedSearch = search
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
    const matchedOptions = useMemo(() => {
        if (!normalizedSearch)
            return options;
        return options.filter((option) => option
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .includes(normalizedSearch));
    }, [options, normalizedSearch]);
    useEffect(() => {
        if (!normalizedSearch)
            return;
        const next = [...matchedOptions];
        setDraftSelected(options.length > 0 && next.length === options.length ? undefined : next);
    }, [normalizedSearch, matchedOptions, options.length]);
    const visibleOptions = matchedOptions.slice(0, 250);
    const sourceName = VAI_SOURCE_MAP.get(filter.source)
        ?.name ??
        filter.source;
    const selectRootRef = useRef<HTMLDetailsElement | null>(null);
    useEffect(() => {
        if (filter.kind !== "select")
            return;
        const closeOnOutside = (event: PointerEvent) => {
            const root = selectRootRef.current;
            const target = event.target as Node | null;
            if (!root ||
                !target ||
                root.contains(target)) {
                return;
            }
            root.open = false;
        };
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape" &&
                selectRootRef.current) {
                selectRootRef.current.open = false;
            }
        };
        document.addEventListener("pointerdown", closeOnOutside);
        document.addEventListener("keydown", closeOnEscape);
        return () => {
            document.removeEventListener("pointerdown", closeOnOutside);
            document.removeEventListener("keydown", closeOnEscape);
        };
    }, [filter.kind]);
    if (filter.kind === "date_range") {
        return <DateFilterControl filter={filter} value={value} onChange={onChange}/>;
    }
    if (filter.source === "finance_costs" && filter.field === "month_label")
        return <CostMonthControl value={value} onChange={onChange}/>;
    const allSelected = draftSelected === undefined;
    const selectedSet = new Set(draftSelected ?? []);
    const appliedSet = new Set(appliedSelected ?? []);
    const selectedLabel = appliedSelected === undefined
        ? ui.all
        : appliedSet.size === 0
            ? ui.none
            : appliedSet.size === 1
                ? [...appliedSet][0]
                : `${appliedSet.size} ${ui.selected}`;
    const normalizeDraft = (next: string[]) => {
        const unique = [...new Set(next)];
        setDraftSelected(options.length > 0 && unique.length === options.length ? undefined : unique);
    };
    const toggleOption = (option: string) => {
        const next = allSelected
            ? options.filter((item) => item !== option)
            : selectedSet.has(option)
                ? [...selectedSet].filter((item) => item !== option)
                : [...selectedSet, option];
        normalizeDraft(next);
    };
    const addMatched = () => {
        if (allSelected)
            return;
        normalizeDraft([...selectedSet, ...matchedOptions]);
    };
    const removeMatched = () => {
        const base = allSelected ? options : [...selectedSet];
        const remove = new Set(matchedOptions);
        normalizeDraft(base.filter((item) => !remove.has(item)));
    };
    const applyDraft = () => {
        if (draftSelected === undefined || (options.length > 0 && draftSelected.length === options.length))
            onChange({});
        else
            onChange({ values: [...draftSelected] });
        if (selectRootRef.current)
            selectRootRef.current.open = false;
    };
    return (<div title={sourceName} style={{ display: "grid", gap: 5, minWidth: 0, width: "100%" }}>
      <span className="vd-label">{filter.label}</span>

      <details ref={selectRootRef} style={{
            position: "relative",
            minWidth: 0,
            width: "100%",
        }}>
        <summary className="select" title={selectedLabel} style={{
            listStyle: "none",
            cursor: "pointer",
            userSelect: "none",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            width: "100%",
            minWidth: 0,
        }}>
          {selectedLabel}
        </summary>

        <div style={{
            position: "absolute",
            zIndex: 500,
            top: "calc(100% + 5px)",
            left: 0,
            width: "min(360px, calc(100vw - 32px))",
            maxWidth: "calc(100vw - 32px)",
            maxHeight: 420,
            overflow: "auto",
            padding: 10,
            display: "grid",
            gap: 6,
            background: "var(--s-1, #071a24)",
            border: "1px solid var(--line, rgba(255,255,255,.16))",
            borderRadius: 8,
            boxShadow: "0 14px 34px rgba(0,0,0,.35)",
        }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <Button size="sm" variant="ghost" onClick={() => setDraftSelected(allSelected ? [] : undefined)}>
              {allSelected ? ui.deselectAll : ui.selectAll}
            </Button>

            {normalizedSearch ? <>
              <Button size="sm" variant="ghost" onClick={addMatched} disabled={!matchedOptions.length || allSelected}>{ui.addToSelection}</Button>
              <Button size="sm" variant="ghost" onClick={removeMatched} disabled={!matchedOptions.length}>{ui.removeFromSelection}</Button>
            </> : null}
          </div>

          <input className="input" type="search" value={search} placeholder={ui.searchValues} autoComplete="off" onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                applyDraft();
            }
        }} style={{
            width: "100%",
            minWidth: 0,
        }}/>

          {matchedOptions.length > visibleOptions.length ? <small className="muted">{ui.showingMatches} {matchedOptions.length.toLocaleString("es-PE")} {ui.matches}</small> : null}

          <div style={{ display: "grid", gap: 2 }}>
            {visibleOptions.map((option) => (<label key={option} style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 7px",
                cursor: "pointer",
                minWidth: 0,
            }}>
              <input type="checkbox" checked={allSelected ||
                selectedSet.has(option)} onChange={() => toggleOption(option)}/>

              <span style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
            }} title={option}>
                {option}
              </span>
            </label>))}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: 8, paddingTop: 6, borderTop: "1px solid var(--line)" }}>
            <Button size="sm" variant="ghost" onClick={() => {
                setDraftSelected(undefined);
                onChange({});
                if (selectRootRef.current)
                    selectRootRef.current.open = false;
            }}>{ui.clear}</Button>

            <Button size="sm" onClick={applyDraft}>{ui.apply}</Button>
          </div>
        </div>
      </details>
    </div>);
}
function WidgetPromptEditor({ widget, busy, onSubmit }: {
    widget: VaiWidgetSpec;
    busy: boolean;
    onSubmit: (instruction: string) => void;
}) {
    const ui = useVaiUi();
    const [open, setOpen] = useState(false);
    const [instruction, setInstruction] = useState("");
    const ready = instruction.trim().length >= 3 && !busy;

    function submit() {
        if (!ready)
            return;

        onSubmit(instruction.trim());
        setOpen(false);
        setInstruction("");
    }

    return <div data-vai-export-ignore style={{ position: "relative", minWidth: 0, alignSelf: "end", justifySelf: "end" }}>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setOpen((value) => !value)}
        disabled={busy}
        title={ui.edit}
        aria-label={ui.edit}
        style={{
            width: 30,
            minWidth: 30,
            height: 30,
            padding: 0,
            display: "inline-grid",
            placeItems: "center",
            borderRadius: 8,
        }}
      >
        {busy ? "…" : "✦"}
      </Button>

      {open ? <div className="trjk-card" style={{ position: "absolute", zIndex: 80, right: 0, top: "calc(100% + 6px)", width: "min(430px, 82vw)", padding: 10, display: "grid", gap: 8, boxShadow: "0 18px 45px rgba(0,0,0,.38)" }}>
          <strong style={{ fontSize: 12 }}>{widget.title}</strong>

          <textarea
            className="input"
            value={instruction}
            maxLength={VAI_PROMPT_MAX}
            rows={4}
            placeholder={ui.editPlaceholder}
            onChange={(event) => setInstruction(event.target.value.slice(0, VAI_PROMPT_MAX))}
            onKeyDown={(event) => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                    event.preventDefault();
                    submit();
                }
            }}
            autoFocus
          />

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
            <Button type="button" size="sm" variant="ghost" onClick={() => {
                setOpen(false);
                setInstruction("");
            }} disabled={busy}>
              {ui.cancel}
            </Button>

            <Button type="button" size="sm" variant="primary" onClick={submit} disabled={!ready}>
              {busy ? ui.editing : ui.apply}
            </Button>
          </div>
        </div> : null}
    </div>;
}

function WidgetSettingsPopover({ children }: {
    children?: ReactNode;
}) {
    const ui = useVaiUi();
    if (!children)
        return null;
    return <details data-vai-export-ignore style={{ position: "relative" }}>
      <summary title={`${ui.edit} · ${ui.filters}`} aria-label={`${ui.edit} · ${ui.filters}`} style={{
            listStyle: "none",
            width: 30,
            minWidth: 30,
            height: 30,
            padding: 0,
            display: "grid",
            placeItems: "center",
            borderRadius: 8,
            border: "1px solid var(--line)",
            background: "var(--s-1)",
            color: "var(--ink)",
            cursor: "pointer",
            userSelect: "none",
        }}>⚙</summary>
      <div className="trjk-card" style={{
            position: "absolute",
            zIndex: 85,
            right: 0,
            top: "calc(100% + 6px)",
            width: "min(720px, 86vw)",
            maxHeight: "min(70vh, 620px)",
            overflow: "auto",
            padding: 10,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))",
            gap: 8,
            boxShadow: "0 18px 45px rgba(0,0,0,.38)",
        }}>
        {children}
      </div>
    </details>;
}

function ScopedWidget({ id, order, widget, source, rows, loading = false, trendDateField = null, editor, crossFilterToken = null, onCrossFilter }: {
    id: string;
    order: number;
    widget: VaiWidgetSpec;
    source?: VaiSource;
    rows: VaiRow[];
    loading?: boolean;
    trendDateField?: string | null;
    editor?: ReactNode;
    crossFilterToken?: string | null;
    onCrossFilter?: (source: string, token: string, label: string, members: VaiRow[]) => void;
}) {
    const ui = useVaiUi();
    const metricKey = widget.metrics.join("|");
    const initialCurrency: "usd" | "pen" = widget.metrics.some((id) => /_pen(?=_|$)/.test(id)) ? "pen" : "usd";
    const [costCurrency, setCostCurrency] = useState<"usd" | "pen">(initialCurrency);
    useEffect(() => {
        setCostCurrency(initialCurrency);
    }, [widget.source, metricKey, initialCurrency]);
    const pairedCostMetrics = useMemo<Record<"usd" | "pen", string[]> | null>(() => {
        if (source?.id !== "finance_costs" || !widget.metrics.length)
            return null;
        const mapTo = (id: string, target: "usd" | "pen") => {
            const candidate = id.replace(/_(?:usd|pen)(?=_|$)/g, `_${target}`);
            return source.metrics.some((metric) => metric.id === candidate) ? candidate : null;
        };
        const usd = widget.metrics.map((id) => mapTo(id, "usd"));
        const pen = widget.metrics.map((id) => mapTo(id, "pen"));
        if (usd.some((id) => !id) || pen.some((id) => !id))
            return null;
        return { usd: usd as string[], pen: pen as string[] };
    }, [source, widget.metrics]);
    const scopedWidget = useMemo<VaiWidgetSpec>(() => pairedCostMetrics
        ? {
            ...widget,
            title: widget.title.replace(/\b(?:USD|PEN)\b/gi, costCurrency.toUpperCase()),
            metrics: pairedCostMetrics[costCurrency],
        }
        : widget, [widget, pairedCostMetrics, costCurrency]);
    const definitions = useMemo(() => widgetLocalFilters(scopedWidget.source).map((filter) => ({
        ...filter,
        label: source
            ? vaiField(source, filter.field)?.label ?? filter.label
            : filter.label,
    })), [scopedWidget.source, source]);
    const [state, setState] = useState<VaiFilterState>({});
    const localFilterKey = definitions.map((filter) => filterKey(filter)).join("|");
    useEffect(() => { setState({}); }, [scopedWidget.source, localFilterKey]);
    const filtered = useMemo(() => source && definitions.length ? applyFilters(source, rows, definitions, state) : rows, [source, rows, definitions, state]);
    const summary = definitions.map((filter) => {
        const values = state[filterKey(filter)]?.values;
        return `${filter.label}: ${values === undefined ? ui.all : values.length ? values.join(", ") : ui.none}`;
    }).join(" · ");
    const currencyControl = pairedCostMetrics ? (<label className="vai-scale-control" style={{ display: "grid", gap: 4, minWidth: 0, width: "100%" }}>
      <span>USD / PEN</span>
      <select className="select" value={costCurrency} onChange={(event) => setCostCurrency(event.target.value as "usd" | "pen")} style={{ width: "100%", minWidth: 0, height: 32 }}>
        <option value="usd">USD</option>
        <option value="pen">PEN</option>
      </select>
    </label>) : null;
    const localControls = definitions.length || currencyControl ? (<div className="vai-filters" data-vai-export-ignore aria-label={`Filtros de ${scopedWidget.title}`} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))", gap: 8, width: "100%", minWidth: 0, gridColumn: "1 / -1" }}>
      {currencyControl}
      {definitions.map((filter) => <FilterControl key={filterKey(filter)} filter={filter} rows={rows} value={state[filterKey(filter)] ?? {}} onChange={(value) => setState((previous) => ({ ...previous, [filterKey(filter)]: value }))}/>)}
    </div>) : undefined;
    return scopedWidget.type === "kpi"
        ? <MemoKpiCard id={id} order={order} widget={scopedWidget} source={source} rows={filtered} loading={loading} trendDateField={trendDateField} localControls={localControls} filterLabel={summary} editor={editor}/>
        : <MemoWidget id={id} order={order} widget={scopedWidget} source={source} rows={filtered} localControls={localControls} filterLabel={summary} editor={editor} crossFilterToken={crossFilterToken} onCrossFilter={onCrossFilter}/>;
}
function KpiCard({ id, order, widget, source, rows, loading, trendDateField, localControls, filterLabel, editor }: {
    id: string;
    order: number;
    widget: VaiWidgetSpec;
    source?: VaiSource;
    rows: VaiRow[];
    loading: boolean;
    trendDateField: string | null;
    localControls?: ReactNode;
    filterLabel?: string;
    editor?: ReactNode;
}) {
    const ui = useVaiUi();
    const result = useMemo(() => (source ? computeWidget(widget, source, rows, { trendDateField }) : null), [widget, source, rows, trendDateField]);
    if (!result || result.kind !== "kpi")
        return null;
    const waiting = loading;
    return (<VaiExportSection id={id} order={order} title={widget.title} kind="kpi">
    <div className="vai-kpi" data-tip="true" style={{ position: "relative" }}>
      {editor || localControls ? <div data-vai-export-ignore style={{ position: "absolute", top: 8, right: 8, zIndex: 40, display: "flex", alignItems: "center", gap: 6 }}>
        {editor}
        {localControls ? <WidgetSettingsPopover>{localControls}</WidgetSettingsPopover> : null}
      </div> : null}
      <span style={{ paddingRight: editor || localControls ? 74 : 0 }}>{widget.title}</span>
      <strong>{waiting ? "…" : formatValue(result.value, result.metric.format)}</strong>
      <small>
        {result.metric.label} · {rows.length.toLocaleString("es-PE")} {source?.id === "finance_mineral_purchases" ? "lotes" : ui.rows} · {source?.name}{filterLabel ? ` · ${filterLabel}` : ""}
      </small>
      <p className="muted" style={{ margin: "8px 0 0", fontSize: 11, lineHeight: 1.45, whiteSpace: "normal" }}>{source?.metrics.find((metric) => metric.id === result.metric.id)?.description}</p>
      <KpiTooltip label={widget.title} notes={result.notes} trend={result.trend} loading={waiting} footer={source?.metrics.find((metric) => metric.id === result.metric.id)?.description}/>
    </div>
    </VaiExportSection>);
}
function Widget({ id, order, widget, source, rows, localControls, filterLabel, editor, crossFilterToken = null, onCrossFilter }: {
    id: string;
    order: number;
    widget: VaiWidgetSpec;
    source?: VaiSource;
    rows: VaiRow[];
    localControls?: ReactNode;
    filterLabel?: string;
    editor?: ReactNode;
    crossFilterToken?: string | null;
    onCrossFilter?: (source: string, token: string, label: string, members: VaiRow[]) => void;
}) {
    const [scaleChoice, setScaleChoice] = useState<"auto" | ChartScaleMode>("auto");
    const [sortChoice, setSortChoice] = useState<VaiSortMode>(widget.sort ?? "value_desc");
    const [dimensionChoice, setDimensionChoice] = useState<string | null>(widget.dimension);
    const [breakdownChoice, setBreakdownChoice] = useState<string | null>(widget.breakdown ?? null);
    const ui = useVaiUi();
    const dimensionOptions = useMemo(() => source
        ? source.fields
            .filter((field) => field.role === "dimension" && !/^(?:is_|has_)/.test(field.id))
            .sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" }))
        : [], [source]);
    const hasAxisPicker = Boolean(widget.dimension) && ["bar", "line", "area", "combo", "lollipop", "radar"].includes(widget.type) && dimensionOptions.length > 1;
    const hasBreakdownPicker = Boolean(widget.dimension) && ["bar", "line", "area", "combo"].includes(widget.type) && dimensionOptions.length > 1;
    const activeDimension = hasAxisPicker ? dimensionChoice ?? widget.dimension : widget.dimension;
    const activeBreakdown = hasBreakdownPicker
        ? breakdownChoice === activeDimension ? null : breakdownChoice
        : widget.breakdown ?? null;
    const hasSortableXAxis = Boolean(activeDimension) && ["bar", "line", "area", "combo", "lollipop", "radar", "heatmap", "waterfall"].includes(widget.type);
    useEffect(() => {
        setSortChoice(widget.sort ?? "value_desc");
        setDimensionChoice(widget.dimension);
        setBreakdownChoice(widget.breakdown ?? null);
    }, [widget.sort, widget.dimension, widget.breakdown]);
    const effectiveWidget = useMemo(() => ({
        ...widget,
        dimension: activeDimension,
        breakdown: activeBreakdown,
        sort: hasSortableXAxis ? sortChoice : widget.sort,
    }), [widget, activeDimension, activeBreakdown, hasSortableXAxis, sortChoice]);
    const result = useMemo(() => source && widget.type !== "matrix" ? computeWidget(effectiveWidget, source, rows) : null, [effectiveWidget, source, rows, widget.type]);
    const costSummary = useMemo(() => source?.id === "finance_costs" ? costSummaryText(rows, widget.metrics.some((id) => source.metrics.find((metric) => metric.id === id)?.format === "pen") ? "pen" : "usd") : "", [widget, source, rows]);
    if (source && widget.type === "matrix")
        return <MatrixWidget id={id} order={order} widget={widget} rows={rows} source={source} controls={localControls} editor={editor}/>;
    if (!source || !result)
        return <section className="trjk-card" role="alert">{ui.noSource}</section>;
    if (result.kind === "unavailable")
        return <section className="trjk-card" role="status"><h3>{widget.title}</h3>{localControls ? <div data-vai-export-ignore style={{ marginBottom: 12 }}>{localControls}</div> : null}<p className="muted">{result.message}</p></section>;
    const lineLike = effectiveWidget.type === "line" || effectiveWidget.type === "area";
    const temporalAxis = Boolean(effectiveWidget.dateField) && (lineLike || !effectiveWidget.dimension);
    const axisLabel = temporalAxis
        ? `por ${ui[effectiveWidget.bucket ?? "month"]} de ${vaiField(source, effectiveWidget.dateField ?? "")?.label ?? effectiveWidget.dateField}`
        : effectiveWidget.dimension
            ? `por ${vaiField(source, effectiveWidget.dimension)?.label ?? effectiveWidget.dimension}`
            : "";
    const extras = [
        result.kind === "series" && result.breakdown ? `una serie por ${result.breakdown.toLowerCase()}` : "",
        result.kind === "series" && result.stack === "percent" ? "apilado al 100 %" : result.kind === "series" && result.stack ? "apilado" : "",
        result.kind === "series" && result.cumulative ? "acumulado" : "",
    ].filter(Boolean);
    const subtitle = [source.name, axisLabel, ...extras, filterLabel, costSummary ? `Resumen del filtro completo: ${costSummary}` : ""].filter(Boolean).join(" · ");
    if (result.kind === "table") {
        const tableControls = editor || localControls ? <>{editor}{localControls ? <WidgetSettingsPopover>{localControls}</WidgetSettingsPopover> : null}</> : undefined;
        return <TableWidget id={id} order={order} title={widget.title} subtitle={subtitle} data={result} source={source} controls={tableControls}/>;
    }
    if (result.kind !== "series")
        return null;
    const first = result.series[0];
    const formats = result.series.map((item) => chartFormat(item.format));
    const primaryFormat = formats[0] ?? chartFormat("decimal");
    const baseRender = lineLike ? "line" : "bar";
    const unitGroups = [...new Set(result.series.map((item) => chartAxisGroup(item.format)))];
    const explicitByUnit = new Map<string, "left" | "right">();
    effectiveWidget.metrics.forEach((metricId, index) => {
        const metric = source.metrics.find((item) => item.id === metricId);
        const side = effectiveWidget.seriesAxes?.[index];
        if (metric && side)
            explicitByUnit.set(chartAxisGroup(metric.format), side);
    });
    const firstSide = explicitByUnit.get(unitGroups[0]) ?? (explicitByUnit.get(unitGroups[1]) === "left" ? "right" : "left");
    const metricIndexForSeries = (seriesId: string) => {
        const metricId = seriesId.split(":")[0];
        const index = effectiveWidget.metrics.indexOf(metricId);
        return index >= 0 ? index : 0;
    };
    const series: ChartSeries[] = result.series.map((item, j) => {
        const metricIndex = metricIndexForSeries(item.id);
        return {
            label: item.label,
            color: item.other ? CHART_OTHER : CHART_COLORS[j % CHART_COLORS.length],
            digits: formats[j].digits,
            unit: formats[j].unit,
            axisKey: chartAxisGroup(item.format),
            seriesType: effectiveWidget.type === "pareto" ? (j === 0 ? "bar" : "line") : effectiveWidget.seriesTypes?.[metricIndex] ?? baseRender,
            axisSide: effectiveWidget.type === "pareto" ? (j === 0 ? "left" : "right") : effectiveWidget.seriesAxes?.[metricIndex] ?? (unitGroups.length === 1 && effectiveWidget.seriesAxes?.some(Boolean) ? "left" : undefined) ?? explicitByUnit.get(chartAxisGroup(item.format)) ?? (chartAxisGroup(item.format) === unitGroups[0] ? firstSide : firstSide === "left" ? "right" : "left"),
            axisRange: effectiveWidget.type === "pareto" && j === 1 ? [0, 100] : undefined,
        };
    });
    const chartRows: ChartRow[] = result.rows.map((row) => ({
        key: row.key,
        label: row.label,
        values: row.values.map((v, j) => (v == null ? null : v * formats[j].scale)),
        notes: row.notes,
    }));
    const crossPrefix = `${id}:`;
    const selectedRow = crossFilterToken?.startsWith(crossPrefix)
        ? result.rows.find((row) => crossFilterToken === `${crossPrefix}${row.key}` || crossFilterToken.startsWith(`${crossPrefix}${row.key}|series:`)) ?? null
        : null;
    const selectedKey = selectedRow?.key ?? null;
    const selectedLabel = selectedRow?.label ?? null;
    const selectSeriesRow = (key: string, seriesIndex?: number) => {
        const index = result.rows.findIndex((row) => row.key === key);
        if (index < 0)
            return;
        let members = result.table.rowMembers[index] ?? [];
        let label = result.rows[index].label;
        let token = `${crossPrefix}${key}`;
        if (seriesIndex != null && effectiveWidget.breakdown) {
            const seriesId = result.series[seriesIndex]?.id ?? "";
            const metricId = effectiveWidget.metrics.find((id) => seriesId.startsWith(`${id}:`));
            const category = metricId ? seriesId.slice(metricId.length + 1) : null;
            if (category && category !== "__others") {
                members = members.filter((row) => (toText(row[effectiveWidget.breakdown!]) || "Sin dato") === category);
                label = `${label} · ${result.series[seriesIndex]?.label ?? category}`;
                token = `${crossPrefix}${key}|series:${seriesId}`;
            }
        }
        onCrossFilter?.(source.id, token, label, members);
    };
    const selectSeriesLabel = (label: string | null) => {
        if (label === null && selectedKey) {
            selectSeriesRow(selectedKey);
            return;
        }
        const row = result.rows.find((item) => item.label === label);
        if (row)
            selectSeriesRow(row.key);
    };
    const values = chartRows.flatMap((row) => widget.type === "rank" || widget.type === "lollipop" ? [row.values[0]] : row.values);
    const logAllowed = canUseLogScale(values) && !result.stack && unitGroups.length === 1 && widget.type !== "pareto";
    const scale: ChartScaleMode = logAllowed && (scaleChoice === "log" || (scaleChoice === "auto" && prefersLogScale(values))) ? "log" : "linear";
    const hasBarSeries = series.some((item) => item.seriesType !== "line");
    const hasLineSeries = series.some((item) => item.seriesType === "line");
    const isCombo = widget.type === "pareto" || (["bar", "combo", "line", "area"].includes(widget.type) && hasBarSeries && hasLineSeries);
    const comboScale: ChartScaleMode = scale;
    const chartControlStyle: CSSProperties = { display: "grid", gap: 4, minWidth: 0, width: "100%", alignContent: "end" };
    const chartControlSelectStyle: CSSProperties = { width: "100%", minWidth: 0, maxWidth: "none", height: 32 };
    const scaleControls = widget.type === "rank" || widget.type === "lollipop" || ((widget.type === "bar" || widget.type === "combo" || lineLike) && !result.stack) ? (<label className="vai-scale-control" style={chartControlStyle} title={!logAllowed ? "La escala logarítmica requiere valores positivos; los ceros y negativos se muestran en escala lineal." : undefined}>
      <span>{ui.scale}</span>
      <select className="select" aria-label={`Escala de ${widget.title}`} value={scaleChoice} onChange={(event) => setScaleChoice(event.target.value as "auto" | ChartScaleMode)} style={chartControlSelectStyle}>
        <option value="auto">{ui.automatic}</option>
        <option value="linear">{ui.linear}</option>
        <option value="log" disabled={!logAllowed}>{ui.logarithmic}</option>
      </select>
    </label>) : null;
    const axisControls = hasAxisPicker ? (<label className="vai-scale-control" style={chartControlStyle}>
      <span>{ui.xAxis}</span>
      <select className="select" title={vaiField(source, activeDimension ?? "")?.label ?? activeDimension ?? ""} aria-label={`Campo del eje X de ${widget.title}`} value={activeDimension ?? ""} onChange={(event) => {
            const next = event.target.value || null;
            setDimensionChoice(next);
            if (next && breakdownChoice === next)
                setBreakdownChoice(null);
        }} style={chartControlSelectStyle}>
        {dimensionOptions.map((field) => <option key={field.id} value={field.id}>{field.label}</option>)}
      </select>
    </label>) : null;
    const breakdownControls = hasBreakdownPicker ? (<label className="vai-scale-control" style={chartControlStyle}>
      <span>{ui.split}</span>
      <select className="select" title={activeBreakdown ? vaiField(source, activeBreakdown)?.label ?? activeBreakdown : ui.noBreakdown} aria-label={`Segregación de ${widget.title}`} value={activeBreakdown ?? ""} onChange={(event) => setBreakdownChoice(event.target.value || null)} style={chartControlSelectStyle}>
        <option value="">{ui.noBreakdown}</option>
        {dimensionOptions.filter((field) => field.id !== activeDimension).map((field) => <option key={field.id} value={field.id}>{field.label}</option>)}
      </select>
    </label>) : null;
    const sortControls = hasSortableXAxis ? (<label className="vai-scale-control" style={chartControlStyle}>
      <span>{ui.orderX}</span>
      <select className="select" aria-label={`Orden del eje X de ${widget.title}`} value={sortChoice} onChange={(event) => setSortChoice(event.target.value as VaiSortMode)} style={chartControlSelectStyle}>
        <option value="value_desc">{ui.highLow}</option>
        <option value="value_asc">{ui.lowHigh}</option>
        <option value="label_asc">A → Z</option>
        <option value="label_desc">Z → A</option>
      </select>
    </label>) : null;
    const settings = localControls || axisControls || breakdownControls || scaleControls || sortControls ? <WidgetSettingsPopover><>{localControls}{axisControls}{breakdownControls}{sortControls}{scaleControls}</></WidgetSettingsPopover> : null;
    const controls = editor || settings ? <>{editor}{settings}</> : undefined;
    const dataTable = <WidgetDataTables widget={effectiveWidget} source={source} table={result.table} subtitle={subtitle}/>;
    const wrap = (chart: ReactNode) => <VaiExportSection id={id} order={order} title={widget.title} kind="chart" table={{ data: result.table, rows: result.table.rows }}>
    {chart}
    {result.notices?.length ? <p className="muted" style={{ fontSize: 11, margin: "7px 2px 0", whiteSpace: "normal", overflowWrap: "anywhere", lineHeight: 1.5 }}>{result.notices.join(" · ")}</p> : null}
  </VaiExportSection>;
    const minCategoryWidth = !result.temporal ? (widget.type === "histogram" ? 65 : chartRows.reduce((max, row) => Math.max(max, Math.min(148, Math.min(20, row.label.length) * 6.2 + 16)), 86)) : 0;
    const chartHeight = widget.type === "combo" || widget.type === "pareto" ? 340 : 290;
    if (widget.type === "heatmap")
        return wrap(<HeatmapChart title={widget.title} subtitle={subtitle} rows={chartRows} series={series} dataTable={dataTable} controls={controls}/>);
    if (widget.type === "waterfall")
        return wrap(<WaterfallChart title={widget.title} subtitle={subtitle} rows={chartRows} digits={primaryFormat.digits} unit={primaryFormat.unit} dataTable={dataTable} controls={controls}/>);
    if (widget.type === "histogram")
        return wrap(<ColumnChart title={widget.title} subtitle={subtitle} rows={chartRows} series={series.map((s) => ({ ...s, unit: ` ${ui.exactRows}` }))} digits={0} unit={` ${ui.exactRows}`} intervals minCategoryWidth={65} height={chartHeight} dataTable={dataTable} controls={controls} onSelect={onCrossFilter ? selectSeriesRow : undefined}/>);
    if (widget.type === "scatter" && result.series.length >= 2) {
        const [xSeries, ySeries] = result.series;
        return wrap(<ScatterChart title={widget.title} subtitle={subtitle} points={chartRows.flatMap((row) => (row.values[0] == null || row.values[1] == null ? [] : [{ label: row.label, x: row.values[0], y: row.values[1], notes: row.notes }]))} xLabel={xSeries.label} yLabel={ySeries.label} xDigits={formats[0].digits} xUnit={formats[0].unit} yDigits={formats[1].digits} yUnit={formats[1].unit} controls={controls} dataTable={dataTable}/>);
    }
    if (isCombo)
        return wrap(<ComboChart title={widget.title} subtitle={subtitle} rows={chartRows} series={series} digits={primaryFormat.digits} unit={primaryFormat.unit} scale={widget.type === "pareto" ? "linear" : comboScale} minCategoryWidth={minCategoryWidth} height={chartHeight} controls={controls} dataTable={dataTable} onSelect={onCrossFilter ? selectSeriesRow : undefined}/>);
    if (lineLike || (widget.type === "combo" && !hasBarSeries)) {
        return wrap(<LineChart title={widget.title} subtitle={subtitle} rows={chartRows} series={series} digits={primaryFormat.digits} unit={primaryFormat.unit} area={widget.type === "area" ? "all" : false} scale={scale} minCategoryWidth={minCategoryWidth} height={chartHeight} dataTable={dataTable} controls={controls} onSelect={onCrossFilter ? selectSeriesRow : undefined}/>);
    }
    if (widget.type === "bar" || widget.type === "combo") {
        return wrap(<ColumnChart title={widget.title} subtitle={subtitle} rows={chartRows} series={series} digits={primaryFormat.digits} unit={primaryFormat.unit} scale={scale} minCategoryWidth={minCategoryWidth} height={chartHeight} stacked={result.stack === "percent" ? "percent" : result.stack === "stack" ? "stack" : false} controls={controls} dataTable={dataTable} onSelect={onCrossFilter ? selectSeriesRow : undefined}/>);
    }
    if (widget.type === "radar") {
        return wrap(<RadarChart title={widget.title} subtitle={subtitle} rows={chartRows} series={series} controls={controls} dataTable={dataTable} onSelect={onCrossFilter ? selectSeriesRow : undefined}/>);
    }
    if (widget.type === "lollipop") {
        return wrap(<LollipopChart title={widget.title} subtitle={subtitle} rows={result.rows.filter((row) => row.values[0] != null).map((row) => ({ label: row.label, value: row.values[0]! * primaryFormat.scale, note: result.series[1] ? `${result.series[1].label}: ${formatValue(row.values[1], result.series[1].format)}` : undefined, notes: row.notes }))} digits={primaryFormat.digits} unit={primaryFormat.unit} scale={scale} selected={selectedLabel} onSelect={onCrossFilter ? (label) => selectSeriesLabel(label) : undefined} controls={controls} dataTable={dataTable}/>);
    }
    if (widget.type === "rank") {
        return wrap(<RankChart title={widget.title} subtitle={subtitle} rows={result.rows.filter((row) => row.values[0] != null).map((row) => ({ label: row.label, value: row.values[0]! * primaryFormat.scale, note: result.series[1] ? `${result.series[1].label}: ${formatValue(row.values[1], result.series[1].format)}` : undefined, notes: row.notes }))} digits={primaryFormat.digits} unit={primaryFormat.unit} scale={scale} selected={selectedLabel} onSelect={onCrossFilter ? (label) => selectSeriesLabel(label) : undefined} controls={controls} dataTable={dataTable}/>);
    }
    if (widget.type === "donut")
        return wrap(<DonutChart title={widget.title} subtitle={subtitle} centerLabel={first?.label ?? ""} items={result.rows.filter((row) => row.values[0] != null).map((row, i) => ({
                label: row.label,
                value: row.values[0]! * primaryFormat.scale,
                color: row.key === "__vai_other__" ? CHART_OTHER : CHART_COLORS[i % CHART_COLORS.length],
                notes: row.notes,
            }))} digits={primaryFormat.digits} unit={primaryFormat.unit} selected={selectedLabel} onSelect={onCrossFilter ? selectSeriesLabel : undefined} dataTable={dataTable} controls={controls}/>);
    return <section className="trjk-card" role="alert"><h3>{widget.title}</h3><p>No hay un renderer válido para «{widget.type}». No se reemplazó por otro tipo de gráfico.</p></section>;
}
const MemoWidget = memo(Widget);
const MemoKpiCard = memo(KpiCard);
function WidgetDataTables({ widget, source, table, subtitle }: {
    widget: VaiWidgetSpec;
    source: VaiSource;
    table: Extract<VaiWidgetData, {
        kind: "table";
    }>;
    subtitle: string;
}) {
    const ui = useVaiUi();
    const detail = useMemo(() => widgetDetailTable(widget, source, table), [widget, source, table]);
    return <div style={{ display: "grid", gap: 18 }}>
    <TableWidget title={`${ui.exactSummary} ${widget.title}`} subtitle={`${subtitle} · ${ui.exactSubtitle}`} data={table} source={source} compact/>
    {detail ? <TableWidget title={ui.backup} subtitle={`${source.grain} · ${ui.backupSubtitle}`} data={detail} source={source} compact/> : null}
  </div>;
}
function SourceHint({ source, columnId, columnLabel, }: {
    source: VaiSource;
    columnId: string;
    columnLabel: string;
}) {
    const ref = useRef<HTMLButtonElement>(null);
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState({
        top: 0,
        left: 0,
    });
    const field = vaiField(source, columnId);
    const metric = source.metrics.find((item) => item.id === columnId);
    const description = field?.description ??
        metric?.description ??
        source.grain;
    const baseFields = metric
        ? [
            metric.field,
            metric.field2,
            metric.numerator,
            metric.denominator,
            metric.weight,
            metric.distinctField,
        ]
            .filter((item): item is string => Boolean(item))
            .filter((item, index, list) => list.indexOf(item) ===
            index)
        : [];
    const show = () => {
        const node = ref.current;
        if (!node) {
            return;
        }
        const rect = node.getBoundingClientRect();
        const tooltipWidth = 370;
        setPosition({
            top: Math.min(rect.bottom + 8, window.innerHeight - 190),
            left: Math.max(12, Math.min(rect.left, window.innerWidth -
                tooltipWidth -
                12)),
        });
        setOpen(true);
    };
    return (<>
      <button ref={ref} type="button" aria-label={`Fuente de ${columnLabel}`} title={`GET ${source.endpoint}`} onMouseEnter={show} onMouseLeave={() => setOpen(false)} onFocus={show} onBlur={() => setOpen(false)} onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (open) {
                setOpen(false);
            }
            else {
                show();
            }
        }} style={{
            display: "inline-grid",
            placeItems: "center",
            width: 15,
            height: 15,
            padding: 0,
            flex: "0 0 15px",
            borderRadius: "50%",
            border: "1px solid currentColor",
            background: "transparent",
            color: "inherit",
            fontSize: 9,
            fontWeight: 800,
            lineHeight: 1,
            opacity: 0.55,
            cursor: "help",
        }}>
        ?
      </button>

      {open &&
            typeof document !==
                "undefined"
            ? createPortal(<div role="tooltip" style={{
                    position: "fixed",
                    zIndex: 20000,
                    top: position.top,
                    left: position.left,
                    width: "min(370px, calc(100vw - 24px))",
                    padding: 11,
                    display: "grid",
                    gap: 5,
                    pointerEvents: "none",
                    background: "var(--s-1, #071a24)",
                    color: "var(--ink, #fff)",
                    border: "1px solid var(--line, rgba(255,255,255,.2))",
                    borderRadius: 8,
                    boxShadow: "0 14px 34px rgba(0,0,0,.48)",
                    fontSize: 11,
                    fontWeight: 400,
                    lineHeight: 1.4,
                    whiteSpace: "normal",
                    textAlign: "left",
                }}>
              <strong>
                {columnLabel}
              </strong>

              <span>
                Endpoint API:{" "}
                <code style={{
                    fontSize: 10,
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                }}>
                  GET {source.endpoint}
                </code>
              </span>

              <span>
                Campo V-Ai:{" "}
                <code>
                  {columnId}
                </code>
              </span>

              {baseFields.length ? (<span>
                  Campo(s) base:{" "}
                  <code>
                    {baseFields.join(", ")}
                  </code>
                </span>) : null}

              {source.sqlView ? (<span>
                  Fuente SQL:{" "}
                  <code>
                    {source.sqlView}
                  </code>
                </span>) : null}

              {description ? (<span style={{
                        color: "var(--ink-2)",
                    }}>
                  {description}
                </span>) : null}
            </div>, document.body)
            : null}
    </>);
}
function CostDetailPanel({ title, rows, source, currency, onClose }: {
    title: string;
    rows: VaiRow[];
    source: VaiSource;
    currency: "usd" | "pen";
    onClose: () => void;
}) {
    const detail = useMemo(() => computeWidget({
        type: "table", title, source: source.id, metrics: [], seriesTypes: null,
        dimension: null, dateField: null, bucket: null, limit: null,
        columns: [...COST_DETAIL_COLUMNS, `amount_${currency}`],
    }, source, rows), [title, rows, source, currency]);
    return <section className="trjk-card" style={{ marginTop: 16, minWidth: 0 }}>
      <div className="trjk-toolbar"><h3>{title}</h3><Button size="sm" variant="ghost" onClick={onClose}>Cerrar detalle</Button></div>
      {detail?.kind === "table" ? <TableWidget title="Glosas y respaldo contable" subtitle="Registros originales del grupo seleccionado" data={detail} source={source} compact/> : null}
    </section>;
}
function MatrixWidget({ id, order, widget, rows, source, controls, editor }: {
    id: string;
    order: number;
    widget: VaiWidgetSpec;
    rows: VaiRow[];
    source: VaiSource;
    controls?: ReactNode;
    editor?: ReactNode;
}) {
    const ui = useVaiUi();
    const matrix = useMemo(() => computeMatrix(widget, source, rows), [widget, source, rows]);
    const [selected, setSelected] = useState<{ matrix: typeof matrix; node: VaiMatrixNode } | null>(null);
    const detailRows = useMemo(() => selected?.matrix === matrix ? matrix.records.filter((row) => selected.node.path.every((value, index) => toText(row[matrix.hierarchy[index]]) === value)) : [], [matrix, selected]);
    const getTable = useCallback(() => matrixExportTable(matrix, source), [matrix, source]);
    const format = useCallback((value: number | null) => formatValue(value, matrix.format), [matrix.format]);
    const currency = matrix.format === "pen" ? "pen" : "usd";
    const summary = useMemo(() => source.id === "finance_costs" ? costSummaryText(matrix.records, currency) : "", [source.id, matrix.records, currency]);
    return <>
      <VaiExportSection id={id} order={order} title={widget.title} kind="table" getTable={getTable}>
        <MatrixChart title={widget.title} subtitle={[`${ui.matrixRows}: ${matrix.hierarchy.map((field) => vaiField(source, field)?.label ?? field).join(" → ")}`, widget.matrixColumns?.length ? `${ui.matrixColumns}: ${widget.matrixColumns.map((field) => vaiField(source, field)?.label ?? field).join(" → ")}${widget.dateField ? ` → ${vaiField(source, widget.dateField)?.label ?? widget.dateField}` : ""}` : widget.dateField ? `${ui.matrixColumns}: ${vaiField(source, widget.dateField)?.label ?? widget.dateField}` : "", summary, ui.matrixExcelHint].filter(Boolean).join(" · ")} columns={matrix.columns} roots={matrix.roots} totals={matrix.totals} format={format} controls={<>{editor}{controls ? <WidgetSettingsPopover>{controls}</WidgetSettingsPopover> : null}<SourceHint source={source} columnId={widget.metrics[0]} columnLabel={ui.matrixSource}/></>} onDetail={source.id === "finance_costs" ? (node) => setSelected({ matrix, node }) : undefined}/>
      </VaiExportSection>
      {selected?.matrix === matrix && source.id === "finance_costs" ? <CostDetailPanel title={selected.node.path.join(" → ")} rows={detailRows} source={source} currency={currency} onClose={() => setSelected(null)}/> : null}
    </>;
}
function TableWidget({ id, order, title, subtitle, data, source, compact = false, controls }: {
    id?: string;
    order?: number;
    title: string;
    subtitle: string;
    data: Extract<VaiWidgetData, {
        kind: "table";
    }>;
    source?: VaiSource;
    compact?: boolean;
    controls?: ReactNode;
}) {
    const ui = useVaiUi();
    const excelColumns = useMemo<Array<ExcelColumnDef<(string | number | null)[]>>>(() => data.columns.map((column, index) => ({
        key: column.id,
        label: column.label,
        kind: column.format === "date" ? "date" : column.format === "text" ? "text" : "number",
        value: (row) => row[index],
    })), [data.columns]);
    const excel = useExcelColumnFilters(data.rows, excelColumns);
    const memberMap = useMemo(() => new Map(data.rows.map((row, index) => [row, data.rowMembers[index] ?? []])), [data]);
    const costMembers = useMemo(() => source?.id === "finance_costs" ? [...new Set(excel.rows.flatMap((row) => memberMap.get(row) ?? []))] : [], [source?.id, excel.rows, memberMap]);
    const mixedPeriods = useMemo(() => new Set(costMembers.map((row) => toText(row.period_label))).size > 1, [costMembers]);
    const safeData = useMemo(() => mixedPeriods ? {
        ...data,
        summaryRules: data.summaryRules.map((rule, index) => {
            const column = data.columns[index];
            const scoped = rule?.metric?.where?.some((condition) => ["period_label", "fiscal_year"].includes(condition.field));
            return ["usd", "pen"].includes(column.format) && !scoped ? null : rule;
        }),
    } : data, [data, mixedPeriods]);
    const summaries = useMemo(() => summarizeTable(safeData, excel.rows), [safeData, excel.rows]);
    const exportTable = useMemo(() => ({ data: safeData, rows: excel.rows }), [safeData, excel.rows]);
    const tableCurrency = data.columns.some((column) => column.format === "pen") ? "pen" : "usd";
    const costSummary = useMemo(() => costMembers.length ? costSummaryText(costMembers, tableCurrency) : "", [costMembers, tableCurrency]);
    const canDrill = source?.id === "finance_costs" && !compact;
    const [selectedRow, setSelectedRow] = useState<(string | number | null)[] | null>(null);
    const [pageSize, setPageSize] = useState(50);
    const [pagination, setPagination] = useState({ page: 1, count: excel.rows.length });
    const page = pagination.count === excel.rows.length ? pagination.page : 1;
    const setPage = (next: number) => setPagination({ page: next, count: excel.rows.length });
    const pageCount = pageSize === 0 ? 1 : Math.max(1, Math.ceil(excel.rows.length / pageSize));
    const safePage = Math.min(page, pageCount);
    const pageRows = pageSize === 0
        ? excel.rows
        : excel.rows.slice((safePage - 1) * pageSize, safePage * pageSize);
    return (<VaiExportSection id={id} order={order} title={title} kind="table" table={exportTable}>
    <section className={compact ? "vai-table-detail" : "trjk-card trjk-chart"}>
      {controls ? <div data-vai-export-ignore style={{ marginBottom: 12 }}>{controls}</div> : null}
      <div className="trjk-chart-head">
        <div>
          <h3>{title}</h3>
          <p className="trjk-chart-sub">
            {subtitle} · {excel.rows.length.toLocaleString("es-PE")} de {data.total.toLocaleString("es-PE")} filas
          </p>
        </div>
        <div className="trjk-actions" data-vai-export-ignore style={{ alignItems: "center", flexWrap: "wrap" }}>
          {excel.activeCount || excel.hasSort ? (<Button size="sm" variant="ghost" onClick={excel.clear}>
              {ui.clearColumns}
            </Button>) : null}
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="muted">{ui.tableRows}</span>
            <select className="select" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} style={{ width: 92 }}>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
              <option value={1000}>1000</option>
              <option value={0}>{ui.allRows}</option>
            </select>
          </label>
          {pageSize > 0 && pageCount > 1 ? (<>
              <Button size="sm" variant="ghost" disabled={safePage <= 1} onClick={() => setPage(Math.max(1, safePage - 1))}>
                {ui.previous}
              </Button>
              <span className="muted">
                {safePage.toLocaleString("es-PE")} / {pageCount.toLocaleString("es-PE")}
              </span>
              <Button size="sm" variant="ghost" disabled={safePage >= pageCount} onClick={() => setPage(Math.min(pageCount, safePage + 1))}>
                {ui.next}
              </Button>
            </>) : null}
        </div>
      </div>
      {data.rows.length ? (<div className="vai-table-scroll" style={{ overflow: "auto", maxWidth: "100%" }}>
          <table style={{ width: "max-content", minWidth: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 6, background: "var(--s-1)" }}>
              <tr>
                {data.columns.map((column, index) => {
                return (<th key={column.id} data-num={column.format !== "text" &&
                        column.format !== "date"} style={index === 0 ? { position: "sticky", left: 0, zIndex: 7, minWidth: 150, background: "var(--s-1)", boxShadow: "1px 0 0 var(--line)" } : undefined}>
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 6,
                    }}>
                        <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        minWidth: 0,
                    }}>
                          <span>
                            {column.label}
                          </span>

                          {source ? (<SourceHint source={source} columnId={column.id} columnLabel={column.label}/>) : null}
                        </span>

                        <ExcelHeaderFilter {...excel.headerProps(column.id)}/>
                      </div>
                    </th>);
            })}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, i) => (<tr key={`${safePage}-${i}`} role={canDrill ? "button" : undefined} tabIndex={canDrill ? 0 : undefined} aria-label={canDrill ? "Abrir detalle de la fila" : undefined} onClick={canDrill ? () => setSelectedRow(row) : undefined} onKeyDown={canDrill ? (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedRow(row);
                  }
              } : undefined} style={canDrill ? { cursor: "pointer" } : undefined}>
                  {row.map((cell, j) => (<td key={j} data-num={data.columns[j].format !== "text" && data.columns[j].format !== "date"} style={j === 0 ? { position: "sticky", left: 0, zIndex: 2, minWidth: 150, maxWidth: 320, background: "var(--s-1)", boxShadow: "1px 0 0 var(--line)", overflowWrap: "anywhere" } : undefined}>
                      {formatValue(cell, data.columns[j].format)}
                    </td>))}
                </tr>))}
            </tbody>
            <tfoot style={{ position: "sticky", bottom: 0, zIndex: 3 }}>
              <tr aria-label={`Resumen de ${excel.rows.length} filas filtradas`}>
                {data.columns.map((column, index) => {
                const summary = summaries[index];
                const hint = summary
                    ? `${column.label}: ${summary.label}. ${data.summaryRules[index]?.metric?.description ?? "Calculado sobre todas las filas filtradas."}`
                    : undefined;
                return (<td key={column.id} data-num={Boolean(summary)} title={hint} aria-label={summary ? `${hint} ${formatValue(summary.value, column.format)}` : undefined} style={{
                        position: "sticky",
                        bottom: 0,
                        left: index === 0 ? 0 : undefined,
                        zIndex: index === 0 ? 5 : 3,
                        padding: "12px 10px",
                        background: "linear-gradient(var(--s-2, transparent), var(--s-2, transparent)), var(--s-canvas, #ffffff)",
                        borderTop: "2px solid var(--brand-gold)",
                        boxShadow: "0 -4px 10px rgba(0, 0, 0, 0.12)",
                        color: "var(--ink)",
                        fontVariantNumeric: "tabular-nums",
                        verticalAlign: "middle",
                        whiteSpace: "nowrap",
                    }}>
                      {summary ? (<strong style={{ display: "block", fontSize: 12, fontWeight: 700 }}>
                          {formatValue(summary.value, column.format)}
                        </strong>) : index === 0 ? (<div style={{ display: "grid", gap: 3 }}>
                          <strong style={{ fontSize: 11, color: "var(--brand-gold)", letterSpacing: "0.04em" }}>
                            Resumen
                          </strong>
                          <span style={{ fontSize: 10, color: "var(--ink-2)" }}>
                            {excel.rows.length.toLocaleString("es-PE")} filas
                          </span>
                        </div>) : null}
                    </td>);
            })}
              </tr>
            </tfoot>
          </table>
        </div>) : (<div className="trjk-empty">Sin datos para los filtros seleccionados.</div>)}
      {costSummary ? <p className="muted" style={{ whiteSpace: "normal", lineHeight: 1.5 }}>Resumen de las filas filtradas, por período: {costSummary}</p> : null}
      {canDrill && source && selectedRow && memberMap.has(selectedRow) ? <CostDetailPanel title="Detalle de la fila seleccionada" rows={memberMap.get(selectedRow)!} source={source} currency={tableCurrency} onClose={() => setSelectedRow(null)}/> : null}
    </section>
    </VaiExportSection>);
}
type GenerateResponse = {
    ok: true;
    status: "ok" | "partial" | "unavailable";
    message: string;
    unavailable: string[];
    spec: VaiDashboardSpec | null;
    model?: string;
    language?: VaiLanguage;
} | {
    ok: false;
    error: string;
};
type ChangeResponse = {
    ok: true;
    mode: "edit_widget" | "translate";
    spec: VaiDashboardSpec;
    notes?: string[];
    model?: string;
    language: VaiLanguage;
} | {
    ok: false;
    error: string;
};
type ChangeSuccess = Extract<ChangeResponse, { ok: true }>;
type Board = {
    spec: VaiDashboardSpec;
    prompt: string;
    id: number | null;
    name: string;
    savedAt: string | null;
    message: string;
    notes: string[];
    saveError: string | null;
    model: string | null;
};
const STEPS = ["Validando la solicitud", "Identificando fuentes del catálogo", "Diseñando el dashboard con IA", "Validando la especificación", "Consultando datos reales"];
export default function VaiWorkspace() {
    const [items, setItems] = useState<VaiDashboardRecord[]>([]);
    const [inventoryLoading, setInventoryLoading] = useState(true);
    const [inventoryError, setInventoryError] = useState<string | null>(null);
    const [board, setBoard] = useState<Board | null>(null);
    const [generating, setGenerating] = useState<{
        step: number;
        prompt: string;
    } | null>(null);
    const [failure, setFailure] = useState<{
        message: string;
        unavailable: string[];
    } | null>(null);
    const [opening, setOpening] = useState<number | null>(null);
    const [pendingDelete, setPendingDelete] = useState<VaiDashboardRecord | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [refreshToken, setRefreshToken] = useState(0);
    const [titleDraft, setTitleDraft] = useState("");
    const [lastRequest, setLastRequest] = useState<VaiPromptRequest | null>(null);
    const [editingWidget, setEditingWidget] = useState<number | null>(null);
    const [translating, setTranslating] = useState(false);
    const [undoing, setUndoing] = useState(false);
    const [redoing, setRedoing] = useState(false);
    const [undoDepth, setUndoDepth] = useState(0);
    const [redoDepth, setRedoDepth] = useState(0);
    const stepTimers = useRef<number[]>([]);
    const undoStack = useRef<Board[]>([]);
    const redoStack = useRef<Board[]>([]);
    const translationCache = useRef(new Map<VaiLanguage, VaiDashboardSpec>());
    const translationPending = useRef(new Map<VaiLanguage, Promise<{ spec: VaiDashboardSpec; notes: string[] }>>());
    const translationEpoch = useRef(0);
    const language = board?.spec.language ?? "es";
    const ui = {
        ...VAI_UI_TEXT[language],
        ...VAI_UI_EXTRA[language],
    };
    const reloadInventory = useCallback(async () => {
        setInventoryLoading(true);
        setInventoryError(null);
        try {
            setItems(await listDashboards());
        }
        catch (error) {
            setInventoryError(error instanceof Error ? error.message : "No se pudo cargar el inventario");
        }
        finally {
            setInventoryLoading(false);
        }
    }, []);
    useEffect(() => {
        void reloadInventory();
    }, [reloadInventory]);
    useEffect(() => () => stepTimers.current.forEach((timer) => window.clearTimeout(timer)), []);
    function scheduleSteps(prompt: string) {
        stepTimers.current.forEach((timer) => window.clearTimeout(timer));
        setGenerating({ step: 0, prompt });
        stepTimers.current = [900, 2200].map((delay, i) => window.setTimeout(() => setGenerating((prev) => (prev ? { ...prev, step: i + 1 } : prev)), delay));
    }
    function clearRedo() {
        redoStack.current = [];
        setRedoDepth(0);
    }

    function pushUndo(snapshot: Board, clearForward = true) {
        undoStack.current = [...undoStack.current.slice(-19), snapshot];
        setUndoDepth(undoStack.current.length);

        if (clearForward)
            clearRedo();
    }

    function popUndo() {
        const next = undoStack.current.at(-1) ?? null;
        undoStack.current = undoStack.current.slice(0, -1);
        setUndoDepth(undoStack.current.length);
        return next;
    }

    function pushRedo(snapshot: Board) {
        redoStack.current = [...redoStack.current.slice(-19), snapshot];
        setRedoDepth(redoStack.current.length);
    }

    function popRedo() {
        const next = redoStack.current.at(-1) ?? null;
        redoStack.current = redoStack.current.slice(0, -1);
        setRedoDepth(redoStack.current.length);
        return next;
    }

    function clearHistory() {
        undoStack.current = [];
        redoStack.current = [];
        setUndoDepth(0);
        setRedoDepth(0);
    }


    async function requestChange(payload: Record<string, unknown>): Promise<ChangeSuccess> {
        const res = await fetch("/api/vai/generate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "same-origin",
            cache: "no-store",
            body: JSON.stringify(payload),
        });

        const response = (await res
            .json()
            .catch(() => ({
                ok: false,
                error: `HTTP ${res.status}`,
            }))) as ChangeResponse;

        if (res.status === 401)
            throw new Error("Tu sesión de V-Ai expiró. Vuelve al portal e ingresa de nuevo.");

        if (!res.ok || response.ok === false)
            throw new Error(response.ok === false ? response.error : `HTTP ${res.status}`);

        return response as ChangeSuccess;
    }

    async function translateSpec(spec: VaiDashboardSpec, target: VaiLanguage, prompt: string) {
        const response = await requestChange({
            mode: "translate",
            spec,
            target_language: target,
        });

        const checked = parseStoredSpec(response.spec, prompt);

        if (!checked.spec)
            throw new Error("La traducción devolvió una configuración inválida.");

        return {
            spec: checked.spec,
            notes: checked.notes,
        };
    }

    function resetTranslationCache(spec: VaiDashboardSpec) {
        translationEpoch.current += 1;
        translationCache.current = new Map([
            [spec.language, spec],
        ]);
        translationPending.current = new Map();
    }

    async function cachedTranslation(spec: VaiDashboardSpec, target: VaiLanguage, prompt: string) {
        const cached = translationCache.current.get(target);

        if (cached)
            return {
                spec: cached,
                notes: [] as string[],
            };

        const pending = translationPending.current.get(target);

        if (pending)
            return pending;

        const epoch = translationEpoch.current;
        let task!: Promise<{
            spec: VaiDashboardSpec;
            notes: string[];
        }>;

        task = translateSpec(spec, target, prompt)
            .then((result) => {
                if (epoch === translationEpoch.current)
                    translationCache.current.set(target, result.spec);

                return result;
            })
            .finally(() => {
                if (translationPending.current.get(target) === task)
                    translationPending.current.delete(target);
            });

        translationPending.current.set(target, task);

        return task;
    }

    function prefetchTranslations(current: Board) {
        translationCache.current.set(
            current.spec.language,
            current.spec
        );

        for (const target of ["es", "en", "fr"] as VaiLanguage[]) {
            if (
                target === current.spec.language ||
                translationCache.current.has(target)
            )
                continue;

            void cachedTranslation(
                current.spec,
                target,
                current.prompt
            ).catch(() => undefined);
        }
    }

    async function generate(request: VaiPromptRequest) {
        setLastRequest(request);
        setFailure(null);
        setBoard(null);
        clearHistory();
        scheduleSteps(request.prompt);
        let response: GenerateResponse;
        try {
            const res = await fetch("/api/vai/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                cache: "no-store",
                body: JSON.stringify(request),
            });
            response = (await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }))) as GenerateResponse;
            if (res.status === 401)
                response = { ok: false, error: "Tu sesión de V-Ai expiró. Vuelve al portal e ingresa de nuevo." };
        }
        catch {
            response = { ok: false, error: "No se pudo contactar al servicio de generación." };
        }
        stepTimers.current.forEach((timer) => window.clearTimeout(timer));
        if (response.ok === false) {
            setGenerating(null);
            setFailure({ message: response.error, unavailable: [] });
            return;
        }
        if (!response.spec) {
            setGenerating(null);
            setFailure({
                message: response.message || "Actualmente no existe información disponible en V-Ai para construir ese dashboard.",
                unavailable: response.unavailable,
            });
            return;
        }
        const checked = parseStoredSpec(response.spec, request.prompt);
        if (!checked.spec) {
            setGenerating(null);
            setFailure({ message: "La definición recibida no cumple el gráfico solicitado. No se guardó una versión distinta.", unavailable: checked.notes });
            return;
        }
        setGenerating({ step: 4, prompt: request.prompt });
        let spec = checked.spec;
        let localizedNotes: string[] = [];
        const detectedLanguage = response.language ?? spec.language ?? "es";

        if (detectedLanguage !== "es") {
            try {
                const translated = await translateSpec({
                    ...spec,
                    language: detectedLanguage,
                }, detectedLanguage, request.prompt);

                spec = translated.spec;
                localizedNotes = translated.notes;
            }
            catch (error) {
                setGenerating(null);
                setFailure({
                    message: error instanceof Error
                        ? error.message
                        : "No se pudo localizar el dashboard generado.",
                    unavailable: [],
                });
                return;
            }
        }

        const next: Board = {
            spec,
            prompt: request.prompt,
            id: null,
            name: spec.title,
            savedAt: null,
            message: response.status === "partial" ? response.message : "",
            notes: [...new Set([...response.unavailable, ...checked.notes, ...localizedNotes])],
            saveError: null,
            model: response.model ?? null,
        };
        try {
            const id = await saveDashboard({ name: next.name, description: next.spec.description, prompt: next.prompt, spec: next.spec, model: next.model, changeType: "save" });
            next.id = Number.isFinite(id) ? id : null;
            next.savedAt = new Date().toISOString();
        }
        catch (error) {
            next.saveError = error instanceof Error ? error.message : "No se pudo guardar el dashboard";
        }
        setGenerating(null);
        setTitleDraft(next.name);
        resetTranslationCache(next.spec);
        setBoard(next);
        setRefreshToken((token) => token + 1);
        prefetchTranslations(next);
        void reloadInventory();
    }
    async function open(item: VaiDashboardRecord) {
        setFailure(null);
        setOpening(item.dashboard_id);
        clearHistory();
        try {
            const detail = await getDashboard(item.dashboard_id);
            if (!detail)
                throw new Error("El dashboard ya no existe.");
            let raw: unknown = null;
            try {
                raw = JSON.parse(detail.spec_json);
            }
            catch {
                raw = null;
            }
            const { spec, notes } = parseStoredSpec(raw, detail.prompt_text);
            if (!spec) {
                setFailure({ message: `«${detail.dashboard_name}» ya no puede reconstruirse con el catálogo actual.`, unavailable: notes });
                setBoard(null);
                return;
            }
            const opened: Board = {
                spec: {
                    ...spec,
                    title: detail.dashboard_name,
                },
                prompt: detail.prompt_text,
                id: detail.dashboard_id,
                name: detail.dashboard_name,
                savedAt: detail.updated_at || detail.created_at,
                message: "",
                notes,
                saveError: null,
                model: detail.model_name ?? null,
            };

            setTitleDraft(opened.name);
            resetTranslationCache(opened.spec);
            setBoard(opened);
            setRefreshToken((token) => token + 1);
            prefetchTranslations(opened);
        }
        catch (error) {
            setFailure({ message: error instanceof Error ? error.message : "No se pudo abrir el dashboard", unavailable: [] });
        }
        finally {
            setOpening(null);
        }
    }
    async function persist(current: Board, name: string, changeType: "save" | "widget_edit" | "language" | "title" = "save") {
        try {
            const id = await saveDashboard({
                dashboard_id: current.id,
                name,
                description: current.spec.description,
                prompt: current.prompt,
                spec: {
                    ...current.spec,
                    title: name,
                },
                model: current.model,
                changeType,
            });

            setBoard((prev) => (
                prev
                    ? {
                        ...prev,
                        id: Number.isFinite(id) ? id : prev.id,
                        name,
                        spec: {
                            ...prev.spec,
                            title: name,
                        },
                        savedAt: new Date().toISOString(),
                        saveError: null,
                    }
                    : prev
            ));

            void reloadInventory();
            return true;
        }
        catch (error) {
            setBoard((prev) => (prev ? {
                ...prev,
                saveError: error instanceof Error
                    ? error.message
                    : "No se pudo guardar",
            } : prev));

            return false;
        }
    }

    async function editWidget(index: number, instruction: string) {
        if (!board || editingWidget !== null || translating || undoing || redoing)
            return;

        const current = board;
        const widget = current.spec.widgets[index];

        if (!widget)
            return;

        setFailure(null);

        if (isDeleteWidgetInstruction(instruction)) {
            if (current.spec.widgets.length <= 1) {
                setFailure({
                    message: "El dashboard debe conservar al menos un gráfico.",
                    unavailable: [],
                });
                return;
            }

            const widgets = current.spec.widgets.filter((_, widgetIndex) => widgetIndex !== index);
            const sources = [...new Set(widgets.map((item) => item.source))];
            const nextSpec: VaiDashboardSpec = {
                ...current.spec,
                widgets,
                sources,
                filters: current.spec.filters.filter((filter) => sources.includes(filter.source)),
            };
            const next: Board = {
                ...current,
                spec: nextSpec,
                saveError: null,
            };

            pushUndo(current);
            resetTranslationCache(next.spec);
            setBoard(next);
            prefetchTranslations(next);

            void persist(
                next,
                next.name,
                "widget_edit"
            );
            return;
        }

        const source = VAI_SOURCE_MAP.get(widget.source);
        const addedColumns = addedTableColumns(
            widget,
            source,
            instruction
        );
        const requestedType = simpleWidgetTypeInstruction(instruction);
        const localWidget = addedColumns
            ? {
                ...widget,
                columns: addedColumns,
            }
            : requestedType
                ? typeOnlyWidgetPatch(
                    widget,
                    requestedType
                )
                : null;

        if (localWidget) {
            const nextSpec: VaiDashboardSpec = {
                ...current.spec,
                widgets: current.spec.widgets.map((item, widgetIndex) => (
                    widgetIndex === index
                        ? localWidget
                        : item
                )),
            };
            const next: Board = {
                ...current,
                spec: nextSpec,
                saveError: null,
            };

            pushUndo(current);
            resetTranslationCache(next.spec);
            setBoard(next);
            prefetchTranslations(next);

            void persist(
                next,
                next.name,
                "widget_edit"
            );
            return;
        }

        setEditingWidget(index);
        setFailure(null);

        try {
            const response = await requestChange({
                mode: "edit_widget",
                spec: current.spec,
                widget_index: index,
                instruction,
                language: current.spec.language,
            });

            const checked = parseStoredSpec(response.spec, current.prompt);

            if (!checked.spec)
                throw new Error("El cambio del gráfico devolvió una configuración inválida.");

            const nextSpec = checked.spec;
            const notes = [
                ...(response.notes ?? []),
                ...checked.notes,
            ];

            const next: Board = {
                ...current,
                spec: nextSpec,
                name: nextSpec.title,
                notes: [...new Set([
                    ...current.notes,
                    ...notes,
                ])],
                saveError: null,
                model: response.model ?? current.model,
            };

            pushUndo(current);
            resetTranslationCache(next.spec);
            setBoard(next);
            setTitleDraft(next.name);
            prefetchTranslations(next);

            void persist(
                next,
                next.name,
                "widget_edit"
            );
        }
        catch (error) {
            setFailure({
                message: error instanceof Error
                    ? error.message
                    : "No se pudo editar el gráfico.",
                unavailable: [],
            });
        }
        finally {
            setEditingWidget(null);
        }
    }

    async function switchLanguage(target: VaiLanguage) {
        if (!board || target === board.spec.language || translating || editingWidget !== null || undoing || redoing)
            return;

        const current = board;
        const cached = translationCache.current.get(target);

        setFailure(null);

        if (cached) {
            const next: Board = {
                ...current,
                spec: cached,
                name: cached.title,
                saveError: null,
            };

            pushUndo(current);
            setBoard(next);
            setTitleDraft(next.name);

            void persist(
                next,
                next.name,
                "language"
            );

            prefetchTranslations(next);
            return;
        }

        setTranslating(true);

        try {
            const translated = await cachedTranslation(
                current.spec,
                target,
                current.prompt
            );

            const next: Board = {
                ...current,
                spec: translated.spec,
                name: translated.spec.title,
                notes: [...new Set([
                    ...current.notes,
                    ...translated.notes,
                ])],
                saveError: null,
            };

            pushUndo(current);
            setBoard(next);
            setTitleDraft(next.name);

            void persist(
                next,
                next.name,
                "language"
            );

            prefetchTranslations(next);
        }
        catch (error) {
            setFailure({
                message: error instanceof Error
                    ? error.message
                    : "No se pudo cambiar el idioma.",
                unavailable: [],
            });
        }
        finally {
            setTranslating(false);
        }
    }

    async function undoLastChange() {
        if (!board || undoing || redoing || editingWidget !== null || translating)
            return;

        const current = board;

        setUndoing(true);
        setFailure(null);

        try {
            if (current.id && !current.saveError) {
                const detail = await undoDashboard(current.id);

                if (!detail)
                    throw new Error("No hay cambios anteriores para deshacer.");

                let raw: unknown = null;

                try {
                    raw = JSON.parse(detail.spec_json);
                }
                catch {
                    raw = null;
                }

                const checked = parseStoredSpec(
                    raw,
                    detail.prompt_text
                );

                if (!checked.spec)
                    throw new Error("La revisión anterior ya no es compatible con el catálogo actual.");

                popUndo();
                pushRedo(current);

                const restored: Board = {
                    spec: {
                        ...checked.spec,
                        title: detail.dashboard_name,
                    },
                    prompt: detail.prompt_text,
                    id: detail.dashboard_id,
                    name: detail.dashboard_name,
                    savedAt: detail.updated_at || detail.created_at,
                    message: "",
                    notes: checked.notes,
                    saveError: null,
                    model: detail.model_name ?? null,
                };

                resetTranslationCache(restored.spec);
                setBoard(restored);
                setTitleDraft(restored.name);
                prefetchTranslations(restored);
                void reloadInventory();
                return;
            }

            const local = popUndo();

            if (!local)
                throw new Error("No hay cambios anteriores para deshacer.");

            pushRedo(current);
            resetTranslationCache(local.spec);
            setBoard(local);
            setTitleDraft(local.name);
            prefetchTranslations(local);
        }
        catch (error) {
            setFailure({
                message: error instanceof Error
                    ? error.message
                    : "No se pudo deshacer el cambio.",
                unavailable: [],
            });
        }
        finally {
            setUndoing(false);
        }
    }

    async function redoLastChange() {
        if (!board || redoing || undoing || editingWidget !== null || translating)
            return;

        const forward = popRedo();

        if (!forward) {
            setFailure({
                message: "No hay cambios posteriores para rehacer.",
                unavailable: [],
            });
            return;
        }

        const current = board;

        setRedoing(true);
        setFailure(null);

        try {
            pushUndo(current, false);

            const restored: Board = {
                ...forward,
                id: current.id ?? forward.id,
                saveError: null,
            };

            resetTranslationCache(restored.spec);
            setBoard(restored);
            setTitleDraft(restored.name);
            prefetchTranslations(restored);

            await persist(
                restored,
                restored.name,
                "save"
            );
        }
        catch (error) {
            setFailure({
                message: error instanceof Error
                    ? error.message
                    : "No se pudo rehacer el cambio.",
                unavailable: [],
            });
        }
        finally {
            setRedoing(false);
        }
    }
    function commitTitle() {
        if (!board)
            return;
        const name = titleDraft.trim().slice(0, 150);
        if (!name) {
            setTitleDraft(board.name);
            return;
        }
        if (name !== board.name || !board.id) {
            if (name !== board.name)
                pushUndo(board);

            void persist(
                board,
                name,
                "title"
            );
        }
    }
    async function confirmDelete() {
        if (!pendingDelete)
            return;
        setDeleting(true);
        try {
            await deleteDashboard(pendingDelete.dashboard_id);
            if (board?.id === pendingDelete.dashboard_id)
                setBoard(null);
            setPendingDelete(null);
            void reloadInventory();
        }
        catch (error) {
            setInventoryError(error instanceof Error ? error.message : "No se pudo eliminar");
            setPendingDelete(null);
        }
        finally {
            setDeleting(false);
        }
    }
    const deleteModal = pendingDelete && typeof document !== "undefined"
        ? createPortal(<div role="dialog" aria-modal="true" aria-labelledby="vai-delete-title" style={{ position: "fixed", inset: 0, zIndex: 12000, display: "flex", alignItems: "center", justifyContent: "center", padding: 18, background: "rgba(0,0,0,.68)" }} onMouseDown={(event) => {
                if (event.target === event.currentTarget && !deleting)
                    setPendingDelete(null);
            }}>
            <section className="panel-inner" style={{ width: "min(440px, 96vw)", padding: 18, display: "grid", gap: 12, background: "#071a24", borderColor: "rgba(147,211,230,.34)" }}>
              <h2 id="vai-delete-title" style={{ margin: 0, fontSize: 18 }}>Eliminar dashboard</h2>
              <p style={{ margin: 0 }}>
                Se eliminará la configuración de «{pendingDelete.dashboard_name}». Los datos de las fuentes no se modifican.
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <Button variant="ghost" onClick={() => setPendingDelete(null)} disabled={deleting}>
                  Cancelar
                </Button>
                <Button variant="danger" onClick={confirmDelete} disabled={deleting}>
                  {deleting ? "Eliminando…" : "Eliminar"}
                </Button>
              </div>
            </section>
          </div>, document.body)
        : null;
    return (<VaiLanguageContext.Provider value={language}><ChartLanguageProvider language={language}><div className="vai-shell">
      <div className="vai-main">
        {failure ? (<section className="trjk-card" style={{ display: "grid", gap: 10 }}>
            <div className="vai-message" data-error="true">{failure.message}</div>
            {failure.unavailable.length ? (<div className="vai-notes">
                <strong>No disponible en V-Ai:</strong>
                <ul>
                  {failure.unavailable.map((note, i) => (<li key={i}>{note}</li>))}
                </ul>
              </div>) : null}
            <div>
              <Button variant="ghost" size="sm" onClick={() => setFailure(null)}>
                Cerrar
              </Button>
            </div>
          </section>) : null}

        {!board && !generating ? <VaiPromptForm busy={opening != null} initial={lastRequest} onGenerate={generate}/> : null}

        {generating ? (<section className="trjk-card vai-progress" aria-live="polite">
            <h3>Generando dashboard</h3>
            <p className="muted" style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>«{generating.prompt}»</p>
            <div className="vai-bar">
              <span />
            </div>
            <ol>
              {STEPS.map((label, i) => (<li key={label} data-state={i < generating.step ? "done" : i === generating.step ? "active" : "pending"}>
                  {label}
                </li>))}
            </ol>
            <p className="muted" style={{ margin: 0, fontSize: 11 }}>OpenAI recibe solo el catálogo de metadatos; los datos reales se consultan después desde nuestros endpoints.</p>
          </section>) : null}

        {board ? (<section className="trjk-card" style={{ display: "grid", gap: 12 }}>
            <div className="vai-board-head" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
              <div style={{ display: "grid", gap: 4, minWidth: 0, flex: 1 }}>
                <input className="input vai-title" value={titleDraft} maxLength={150} onChange={(e) => setTitleDraft(e.target.value)} onBlur={commitTitle} onKeyDown={(e) => {
                if (e.key === "Enter")
                    (e.target as HTMLInputElement).blur();
                if (e.key === "Escape")
                    setTitleDraft(board.name);
            }} aria-label="Nombre del dashboard" title="Editar nombre; se guarda al salir del campo"/>
                <div className="vai-board-meta" style={{ whiteSpace: "normal", overflowWrap: "anywhere", overflow: "visible", textOverflow: "clip" }}>
                  {board.id ? `${ui.saved} · ${formatStamp(board.savedAt, language)}` : ui.unsaved}
                  {translating ? <span> · {ui.translating}</span> : null}
                  {editingWidget !== null ? <span> · {ui.editing}</span> : null}
                  {undoing ? <span> · {ui.undoing}</span> : null}
                  {redoing ? <span> · {ui.redoing}</span> : null}
                  {board.saveError ? <span style={{ color: "var(--bad)" }}> · {board.saveError}</span> : null}
                </div>
                <p className="vai-board-prompt" style={{ display: "block", whiteSpace: "pre-wrap", overflowWrap: "anywhere", overflow: "visible", textOverflow: "clip", WebkitLineClamp: "unset", maxHeight: "none", height: "auto", margin: "4px 0 0", lineHeight: 1.6 }}>

                  <span style={{ marginRight: 8 }}>{ui.prompt}:</span>
                  {board.prompt}
                </p>
              </div>
              <div className="trjk-actions" style={{ alignItems: "center", flexWrap: "wrap" }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--ink-2)" }}>
                  {ui.language}
                  <select
                    className="input"
                    value={board.spec.language}
                    disabled={translating || editingWidget !== null || undoing || redoing}
                    onChange={(event) => void switchLanguage(event.target.value as VaiLanguage)}
                    style={{
                        width: 112,
                        minHeight: 32,
                        padding: "4px 8px",
                    }}
                  >
                    <option value="es">Español</option>
                    <option value="en">English</option>
                    <option value="fr">Français</option>
                  </select>
                </label>

                <Button
                  size="sm"
                  variant="ghost"
                  disabled={undoing || redoing || translating || editingWidget !== null || (!board.id && undoDepth === 0)}
                  onClick={() => void undoLastChange()}
                  title={ui.undo}
                >
                  {undoing ? ui.undoing : `↶ ${ui.undo}`}
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  disabled={redoing || undoing || translating || editingWidget !== null || redoDepth === 0}
                  onClick={() => void redoLastChange()}
                  title={ui.redo}
                >
                  {redoing ? ui.redoing : `↷ ${ui.redo}`}
                </Button>

                {board.saveError ? (<Button size="sm" variant="primary" onClick={() => void persist(board, board.name)}>
                    {ui.retry}
                  </Button>) : null}

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setRefreshToken((token) => token + 1)}
                  disabled={translating || editingWidget !== null || undoing || redoing}
                >
                  {ui.refresh}
                </Button>

                <Button
                  size="sm"
                  variant="default"
                  onClick={() => setBoard(null)}
                  disabled={translating || editingWidget !== null || undoing || redoing}
                >
                  {ui.newDashboard}
                </Button>
              </div>
            </div>

            {board.message ? <div className="vai-message">{board.message}</div> : null}
            {board.notes.length ? (<div className="vai-notes">
                <strong>{ui.notes}:</strong>
                <ul>
                  {board.notes.map((note, i) => (<li key={i}>{note}</li>))}
                </ul>
              </div>) : null}

            <VaiDashboard spec={board.spec} refreshToken={refreshToken} editingWidget={editingWidget} onEditWidget={(index, instruction) => void editWidget(index, instruction)}/>
          </section>) : null}
      </div>

      <aside className="vai-side">
        <VaiInventory items={items} loading={inventoryLoading || opening != null} error={inventoryError} currentId={board?.id ?? null} onOpen={(item) => void open(item)} onDelete={setPendingDelete} onNew={() => {
            setBoard(null);
            setFailure(null);
        }} onReload={() => void reloadInventory()}/>
        <section className="trjk-card" style={{ fontSize: 11, color: "var(--ink-2)", display: "grid", gap: 6 }}>
          <h3 style={{ color: "var(--ink)" }}>{ui.howWorks}</h3>
          <p style={{ margin: 0 }}>{ui.howWorksAi}</p>
          <p style={{ margin: 0 }}>{ui.howWorksData}</p>
        </section>
      </aside>

      {deleteModal}
    </div></ChartLanguageProvider></VaiLanguageContext.Provider>);
}
