"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { apiGet, apiPost } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import {
  ExcelHeaderFilter,
  useExcelColumnFilters,
  type ExcelColumnDef,
} from "../ui/ExcelFilters";
import TRJKardexQuoteEditor, { type QuoteSaved } from "./TRJKardexQuoteEditor";
import {
  invoiceKey,
  isOperationalLot,
  kardexCents,
  kardexDecimal,
  kardexFormat as fmt,
  kardexUnits,
  normalizeInvoiceNumber,
  type KardexGuide,
  type KardexInvoice,
  type KardexLot,
} from "../../lib/trjKardex";

type Carrier = { ruc: string; name: string | null };
const today = () =>
  new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
const moneyInput = (value: string) => Number(value).toFixed(2);
const moneyValid = (value: string) => /^\d{1,12}(?:\.\d{1,2})?$/.test(value);
const invoiceColumns: ExcelColumnDef<KardexInvoice>[] = [
  { key: "document_number", label: "Factura", value: (r) => r.document_number },
  {
    key: "transport_name",
    label: "Transportista",
    value: (r) => r.transport_name,
  },
  { key: "ruc", label: "RUC", value: (r) => r.ruc },
  {
    key: "document_date",
    label: "Fecha",
    kind: "date",
    value: (r) => r.document_date,
  },
  {
    key: "guide_count",
    label: "Guías",
    kind: "number",
    value: (r) => r.guide_count,
  },
  {
    key: "amount_usd",
    label: "USD ingresado",
    kind: "number",
    value: (r) => r.amount_usd,
  },
  {
    key: "calculated",
    label: "USD guías",
    kind: "number",
    value: (r) => r.calculated_amount_usd,
  },
  {
    key: "difference",
    label: "Diferencia USD",
    kind: "number",
    value: (r) =>
      kardexDecimal(
        kardexUnits(r.amount_usd) - kardexUnits(r.calculated_amount_usd),
      ),
  },
  {
    key: "amount_usd_con",
    label: "USD Concar",
    kind: "number",
    value: (r) => r.amount_usd_con,
  },
  {
    key: "accounting",
    label: "Subd. / Comp. / Sec.",
    value: (r) =>
      r.subledger_num
        ? `${r.subledger_num} / ${r.comp_num} / ${r.secu_num}`
        : "",
  },
  { key: "status_name", label: "Estado", value: (r) => r.status_name },
];
const guideColumns: ExcelColumnDef<KardexGuide>[] = [
  { key: "guide_number", label: "Guía", value: (r) => r.guide_number },
  {
    key: "departure_date",
    label: "Salida",
    kind: "date",
    value: (r) => r.departure_date?.slice(0, 10),
  },
  { key: "plate_1", label: "Placa", value: (r) => r.plate_1 },
  {
    key: "tmh_departure",
    label: "TMH salida",
    kind: "number",
    value: (r) => r.tmh_departure,
  },
  {
    key: "amount_usd",
    label: "USD calculado",
    kind: "number",
    value: (r) => r.amount_usd,
  },
];

function InvoiceDetail({
  invoice,
  guides,
  lots,
  busy,
  onBusy,
  onDirty,
  onSaved,
  mutate,
  onAdd,
}: {
  invoice: KardexInvoice;
  guides: KardexGuide[];
  lots: KardexLot[];
  busy: boolean;
  onBusy: (value: boolean) => void;
  onDirty: (value: boolean) => void;
  onSaved: (result: QuoteSaved) => void;
  mutate: (path: string, body: Record<string, unknown>) => Promise<boolean>;
  onAdd: () => void;
}) {
  const [activeGuide, setActiveGuide] = useState<string | null>(null);
  const [guideDirty, setGuideDirty] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [date, setDate] = useState(invoice.document_date);
  const [amount, setAmount] = useState(moneyInput(invoice.amount_usd));
  const [revision, setRevision] = useState(0);
  const closed = invoice.status_name === "CERRADO";
  const metadataDirty =
    date !== invoice.document_date || amount !== moneyInput(invoice.amount_usd);
  const dirty = metadataDirty || guideDirty;
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  const calculated = guides.reduce(
    (sum, guide) =>
      sum +
      kardexUnits(
        guide.guide_number === activeGuide && guideDirty
          ? preview
          : guide.amount_usd,
      ),
    BigInt(0),
  );
  const difference = kardexUnits(amount) - calculated;
  const identity = {
    ruc: invoice.ruc,
    document_number: invoice.document_number,
  };
  const valid =
    moneyValid(amount) && /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today();

  function toggleGuide(guide: KardexGuide) {
    if (busy) return;
    if (
      guideDirty &&
      !window.confirm("Hay cambios de llegada sin guardar. ¿Descartarlos?")
    )
      return;
    setGuideDirty(false);
    setPreview(null);
    setActiveGuide(
      activeGuide === guide.guide_number ? null : guide.guide_number,
    );
  }
  async function action(action: "close" | "delete") {
    if (busy || dirty || closed) return;
    const word = action === "close" ? "cerrar" : "eliminar";
    const detail =
      action === "close"
        ? `Se bloquearán las ${guides.length} guías. Diferencia actual: USD ${fmt(kardexDecimal(difference))}.`
        : "Se eliminará la factura y se quitará su vínculo; las guías y sus lotes se conservan.";
    const confirmation = window.prompt(
      `${detail} Escribe "${word}" para confirmar.`,
    );
    if (confirmation?.trim().toLowerCase() !== word) return;
    await mutate(`/api/trjkar/invo/${action}`, { ...identity, confirmation });
  }
  return (
    <section
      className="trjk-card trjk-invoice-detail"
      aria-label={`Detalle factura ${invoice.document_number}`}
    >
      <div className="trjk-toolbar">
        <div>
          <h3>
            {invoice.document_number}{" "}
            <span className="trjk-badge">{invoice.status_name}</span>
          </h3>
          <p className="muted">
            {invoice.transport_name || invoice.ruc} · {invoice.ruc}
          </p>
        </div>
        <div className="trjk-actions">
          <Button size="sm" disabled={busy || dirty || closed} onClick={onAdd}>
            Agregar guías
          </Button>
          <Button
            size="sm"
            disabled={busy || dirty || closed || !guides.length}
            onClick={() => void action("close")}
          >
            Cerrar
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={busy || dirty || closed}
            onClick={() => void action("delete")}
          >
            Eliminar factura
          </Button>
        </div>
      </div>
      <div className="trjk-invoice-metrics">
        <label>
          Fecha de factura
          <input
            className="input"
            aria-label="Fecha de factura en edición"
            type="date"
            max={today()}
            value={date}
            disabled={busy || closed}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label>
          USD ingresado
          <input
            className="input"
            aria-label="Monto de factura en edición"
            inputMode="decimal"
            value={amount}
            disabled={busy || closed}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <div>
          <span>
            USD calculado de guías{guideDirty ? " · vista previa" : ""}
          </span>
          <strong>
            {guideDirty && preview == null
              ? "Revisar datos"
              : fmt(kardexDecimal(calculated))}
          </strong>
        </div>
        <div
          data-state={
            kardexCents(difference) === BigInt(0) ? "valid" : "invalid"
          }
        >
          <span>Diferencia USD</span>
          <strong>
            {guideDirty && preview == null
              ? "—"
              : fmt(kardexDecimal(difference))}
          </strong>
        </div>
        <div>
          <span>USD Concar</span>
          <strong>{fmt(invoice.amount_usd_con)}</strong>
        </div>
      </div>
      <div className="trjk-toolbar">
        <span className="muted">
          {invoice.subledger_num
            ? `Asiento: ${invoice.subledger_num} / ${invoice.comp_num} / ${invoice.secu_num}`
            : "Aún sin coincidencia en Concar"}
        </span>
        <Button
          size="sm"
          disabled={busy || closed || !metadataDirty || guideDirty || !valid}
          onClick={async () => {
            await mutate("/api/trjkar/invo/update", {
              ...identity,
              document_date: date,
              amount_usd: amount,
            });
          }}
        >
          Guardar factura
        </Button>
      </div>
      {dirty && (
        <p className="muted">
          Guarda los cambios antes de cerrar, quitar guías o eliminar la
          factura.
        </p>
      )}
      {metadataDirty && !valid && (
        <p className="trjk-error" role="alert">
          Revisa la fecha y el monto: usa una fecha no futura y USD no negativo
          con hasta 2 decimales.
        </p>
      )}
      <div className="trjk-guide-stack">
        {guides.map((guide) => (
          <div className="trjk-guide-item" key={guide.guide_number}>
            <div className="trjk-toolbar">
              <button
                className="trjk-expand"
                aria-expanded={activeGuide === guide.guide_number}
                disabled={busy}
                onClick={() => toggleGuide(guide)}
              >
                <span>{activeGuide === guide.guide_number ? "▾" : "▸"}</span>
                <strong>{guide.guide_number}</strong>
                <span>{guide.plate_1 || "Sin placa"}</span>
                <span>Salida {fmt(guide.tmh_departure, 3)} TMH</span>
                <span>Llegada {fmt(guide.tmh_arrival, 3)} TMH</span>
                <span>USD {fmt(guide.amount_usd)}</span>
              </button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy || dirty || closed}
                onClick={() => {
                  if (
                    window.confirm(
                      `¿Quitar ${guide.guide_number} de esta factura? Se conservarán la guía y sus lotes.`,
                    )
                  ) {
                    void mutate("/api/trjkar/invo/unlink", {
                      ...identity,
                      guide_number: guide.guide_number,
                    });
                  }
                }}
              >
                Quitar
              </Button>
            </div>
            {activeGuide === guide.guide_number && (
              <TRJKardexQuoteEditor
                key={`${guide.guide_number}:${revision}`}
                guide={guide}
                lots={lots.filter(
                  (row) =>
                    row.guide_number === guide.guide_number &&
                    isOperationalLot(row),
                )}
                disabled={busy || metadataDirty}
                onBusy={onBusy}
                onDirty={setGuideDirty}
                onPreview={setPreview}
                onSaved={(result) => {
                  setGuideDirty(false);
                  setRevision((n) => n + 1);
                  onSaved(result);
                }}
              />
            )}
          </div>
        ))}
        {!guides.length && (
          <p className="muted">
            Sin guías vinculadas. Puedes agregar guías o eliminar esta factura.
          </p>
        )}
      </div>
    </section>
  );
}

export default function TRJKardexQuotes() {
  const [guides, setGuides] = useState<KardexGuide[]>([]);
  const [lots, setLots] = useState<KardexLot[]>([]);
  const [invoices, setInvoices] = useState<KardexInvoice[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [carrier, setCarrier] = useState("");
  const [searchedCarrier, setSearchedCarrier] = useState("");
  const [document, setDocument] = useState("");
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [pendingOnly, setPendingOnly] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const gate = useRef(false);
  const builder = useRef<HTMLElement>(null);
  const normalized = normalizeInvoiceNumber(document);
  const builderDirty = selected.size > 0 || !!document || !!amount;

  const load = useCallback(async () => {
    const responses = await Promise.all([
      apiGet("/api/trjkar/guides"),
      apiGet("/api/trjkar"),
      apiGet("/api/trjkar/invo"),
      apiGet("/api/trjkar/ruc-history?role=transport"),
    ]);
    for (const response of responses)
      if (!Array.isArray(response?.rows))
        throw new Error("Respuesta de Kardex inválida");
    setGuides(responses[0].rows);
    setLots(responses[1].rows);
    setInvoices(responses[2].rows);
    setCarriers(responses[3].rows);
  }, []);
  useEffect(() => {
    void load()
      .catch((e) => {
        setError(true);
        setMessage(e.message);
      })
      .finally(() => setLoading(false));
  }, [load]);
  useEffect(() => {
    if (!dirty && !builderDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, builderDirty]);

  const available = useMemo(
    () =>
      guides.filter(
        (g) =>
          searchedCarrier &&
          g.transport_ruc === searchedCarrier &&
          !g.document_number &&
          g.status_name !== "CERRADO",
      ),
    [guides, searchedCarrier],
  );
  const guideExcel = useExcelColumnFilters(available, guideColumns);
  const filtered = useMemo(
    () =>
      invoices.filter(
        (row) =>
          (!pendingOnly || row.status_name !== "CERRADO") &&
          `${row.document_number} ${row.ruc} ${row.transport_name || ""}`
            .toUpperCase()
            .includes(search.trim().toUpperCase()),
      ),
    [invoices, pendingOnly, search],
  );
  const excel = useExcelColumnFilters(filtered, invoiceColumns);
  const pages = Math.max(1, Math.ceil(excel.rows.length / 20));
  const currentPage = Math.min(page, pages);
  const activeInvoice = invoices.find((row) => invoiceKey(row) === active);
  const invoiceGuides = activeInvoice
    ? guides.filter(
        (g) =>
          g.transport_ruc === activeInvoice.ruc &&
          g.document_number === activeInvoice.document_number,
      )
    : [];
  const carrierOptions = [
    ...new Map(
      [
        ...carriers,
        ...guides
          .filter((g) => g.transport_ruc)
          .map((g) => ({ ruc: g.transport_ruc!, name: g.transport_name })),
      ].map((r) => [r.ruc, r]),
    ).values(),
  ].sort((a, b) => (a.name || a.ruc).localeCompare(b.name || b.ruc));

  async function mutate(path: string, body: Record<string, unknown>) {
    if (gate.current || busy) return false;
    gate.current = true;
    setBusy(true);
    setError(false);
    setMessage("");
    let saved = false;
    try {
      await apiPost(path, body);
      saved = true;
      if (path.endsWith("/insert")) {
        setSelected(new Set());
        setDocument("");
        setAmount("");
      }
      if (path.endsWith("/delete")) setActive(null);
      await load();
      setRevision((n) => n + 1);
      setDirty(false);
      setMessage("Operación guardada");
      return true;
    } catch (e) {
      setError(true);
      setMessage(
        `${saved ? "La operación se guardó, pero falló la recarga. Pulsa Actualizar. " : ""}${e instanceof Error ? e.message : "No se pudo completar"}`,
      );
      return false;
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }
  function savedGuide(result: QuoteSaved) {
    setGuides((current) =>
      current.map((g) =>
        g.guide_number === result.guide.guide_number ? result.guide : g,
      ),
    );
    setLots((current) => [
      ...current.filter((r) => r.guide_number !== result.guide.guide_number),
      ...result.rows,
    ]);
    setInvoices((current) =>
      current.map((invoice) => {
        if (
          invoice.ruc !== result.guide.transport_ruc ||
          invoice.document_number !== result.guide.document_number
        )
          return invoice;
        const total = guides
          .filter(
            (g) =>
              g.transport_ruc === invoice.ruc &&
              g.document_number === invoice.document_number,
          )
          .reduce(
            (sum, g) =>
              sum +
              kardexUnits(
                g.guide_number === result.guide.guide_number
                  ? result.guide.amount_usd
                  : g.amount_usd,
              ),
            BigInt(0),
          );
        return { ...invoice, calculated_amount_usd: kardexDecimal(total) };
      }),
    );
  }
  function openInvoice(invoice: KardexInvoice) {
    if (busy || loading) return;
    if (
      dirty &&
      !window.confirm("¿Descartar cambios sin guardar de la factura abierta?")
    )
      return;
    setDirty(false);
    setActive(active === invoiceKey(invoice) ? null : invoiceKey(invoice));
  }

  return (
    <div className="trjk-workspace trjk-quotes">
      <div className="trjk-toolbar">
        <div>
          <h2>Valorización de transporte</h2>
          <p className="muted">
            Vincula varias guías a una factura y concilia sus llegadas.
          </p>
        </div>
        <Button
          disabled={loading || busy}
          onClick={async () => {
            if (
              dirty &&
              !window.confirm("¿Descartar cambios del detalle y actualizar?")
            )
              return;
            setLoading(true);
            try {
              await load();
              setRevision((n) => n + 1);
              setDirty(false);
              setSelected(new Set());
              setError(false);
              setMessage("Datos actualizados");
            } catch (e) {
              setError(true);
              setMessage(
                e instanceof Error ? e.message : "No se pudo actualizar",
              );
            } finally {
              setLoading(false);
            }
          }}
        >
          Actualizar
        </Button>
      </div>
      {message && (
        <div
          className="trjk-message"
          data-error={error}
          role={error ? "alert" : "status"}
        >
          {message}
        </div>
      )}
      <section ref={builder} className="trjk-card">
        <h3>Vincular guías a una factura</h3>
        <fieldset disabled={loading || busy || dirty}>
          <div className="trjk-builder">
            <label>
              Transportista
              <select
                className="input"
                value={carrier}
                onChange={(e) => {
                  setCarrier(e.target.value);
                  setSearchedCarrier("");
                  setSelected(new Set());
                  setDocument("");
                  setAmount("");
                }}
              >
                <option value="">Seleccionar transportista</option>
                {carrierOptions.map((r) => (
                  <option key={r.ruc} value={r.ruc}>
                    {r.name || r.ruc} · {r.ruc}
                  </option>
                ))}
              </select>
            </label>
            <Button
              disabled={!carrier || busy || loading || dirty}
              onClick={() => {
                setSearchedCarrier(carrier);
                setSelected(new Set());
                guideExcel.clear();
              }}
            >
              Buscar
            </Button>
            <label>
              Factura
              <input
                className="input"
                placeholder="E001-0000000123"
                maxLength={15}
                value={document}
                onChange={(e) => setDocument(e.target.value.toUpperCase())}
                onBlur={() => {
                  if (normalized) {
                    setDocument(normalized);
                    const existing = invoices.find(
                      (r) =>
                        r.ruc === carrier && r.document_number === normalized,
                    );
                    if (existing) {
                      setDate(existing.document_date);
                      setAmount(moneyInput(existing.amount_usd));
                    }
                  }
                }}
              />
            </label>
            <label>
              Fecha
              <input
                className="input"
                type="date"
                max={today()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label>
              Monto USD
              <input
                className="input"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <Button
              variant="primary"
              disabled={
                busy ||
                loading ||
                dirty ||
                !normalized ||
                !moneyValid(amount) ||
                !date ||
                date > today() ||
                !selected.size ||
                selected.size > 100 ||
                carrier !== searchedCarrier
              }
              onClick={async () => {
                const key = invoiceKey({
                  ruc: carrier,
                  document_number: normalized,
                });
                if (
                  await mutate("/api/trjkar/invo/insert", {
                    ruc: carrier,
                    document_number: normalized,
                    document_date: date,
                    amount_usd: amount,
                    guide_numbers: [...selected],
                  })
                )
                  setActive(key);
              }}
            >
              Vincular ({selected.size})
            </Button>
          </div>
        </fieldset>
        {document && !normalized && (
          <p className="trjk-error">
            Usa 4 caracteres de serie y hasta 10 dígitos después del guion.
          </p>
        )}
        {searchedCarrier && (
          <>
            <div className="trjk-toolbar">
              <span className="muted">
                {available.length} guías abiertas sin factura · máximo 100 por
                operación
              </span>
              <Button
                size="sm"
                disabled={busy || dirty}
                onClick={() => {
                  guideExcel.clear();
                }}
              >
                Limpiar filtros
              </Button>
            </div>
            <div className="trjk-table-scroll trjk-available">
              <table>
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        aria-label="Seleccionar guías visibles (hasta 100)"
                        disabled={busy || dirty || !guideExcel.rows.length}
                        checked={
                          guideExcel.rows.length > 0 &&
                          guideExcel.rows
                            .slice(0, 100)
                            .every((g) => selected.has(g.guide_number))
                        }
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? new Set(
                                  guideExcel.rows
                                    .slice(0, 100)
                                    .map((g) => g.guide_number),
                                )
                              : new Set(),
                          )
                        }
                      />
                    </th>
                    {guideColumns.map((c) => (
                      <th key={c.key}>
                        <div className="trjk-column">
                          {c.label}
                          <ExcelHeaderFilter
                            {...guideExcel.headerProps(c.key)}
                          />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {guideExcel.rows.map((g) => (
                    <tr
                      key={g.guide_number}
                      data-selected={selected.has(g.guide_number)}
                    >
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Vincular ${g.guide_number}`}
                          checked={selected.has(g.guide_number)}
                          disabled={
                            busy ||
                            dirty ||
                            (!selected.has(g.guide_number) &&
                              selected.size >= 100)
                          }
                          onChange={(e) => {
                            const next = new Set(selected);
                            if (e.target.checked) next.add(g.guide_number);
                            else next.delete(g.guide_number);
                            setSelected(next);
                          }}
                        />
                      </td>
                      {guideColumns.map((c) => (
                        <td key={c.key}>
                          {c.kind === "number"
                            ? fmt(c.value(g), c.key === "tmh_departure" ? 3 : 2)
                            : String(c.value(g) || "—")}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {!guideExcel.rows.length && (
                    <tr>
                      <td colSpan={6}>
                        No hay guías disponibles para este transportista.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
      <section className="trjk-card">
        <div className="trjk-toolbar">
          <h3>Facturas ({excel.rows.length})</h3>
          <input
            className="input trjk-search"
            aria-label="Buscar facturas"
            placeholder="Factura, RUC o transportista"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <label className="trjk-check">
            <input
              type="checkbox"
              checked={pendingOnly}
              onChange={(e) => {
                setPendingOnly(e.target.checked);
                setPage(1);
              }}
            />
            Solo abiertas
          </label>
          <Button
            size="sm"
            onClick={() => {
              excel.clear();
              setSearch("");
              setPendingOnly(false);
              setPage(1);
            }}
          >
            Limpiar filtros
          </Button>
        </div>
        <div className="trjk-table-scroll trjk-invoice-list">
          <table>
            <thead>
              <tr>
                <th>Detalle</th>
                {invoiceColumns.map((c) => (
                  <th key={c.key}>
                    <div className="trjk-column">
                      {c.label}
                      <ExcelHeaderFilter {...excel.headerProps(c.key)} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {excel.rows
                .slice((currentPage - 1) * 20, currentPage * 20)
                .map((invoice) => (
                  <tr
                    key={invoiceKey(invoice)}
                    data-selected={active === invoiceKey(invoice)}
                  >
                    <td>
                      <Button
                        size="sm"
                        disabled={loading || busy}
                        aria-expanded={active === invoiceKey(invoice)}
                        onClick={() => openInvoice(invoice)}
                      >
                        {active === invoiceKey(invoice) ? "Contraer" : "Abrir"}
                      </Button>
                    </td>
                    {invoiceColumns.map((c) => (
                      <td key={c.key}>
                        {c.kind === "number"
                          ? fmt(
                              c.value(invoice),
                              c.key === "guide_count" ? 0 : 2,
                            )
                          : String(c.value(invoice) || "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              {!excel.rows.length && (
                <tr>
                  <td colSpan={12}>
                    {loading ? "Cargando…" : "Sin facturas para mostrar"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="trjk-toolbar">
          <span className="muted">
            Página {currentPage} de {pages}
          </span>
          <div className="trjk-actions">
            <Button
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
            >
              Anterior
            </Button>
            <Button
              size="sm"
              disabled={currentPage >= pages}
              onClick={() => setPage(currentPage + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      </section>
      {activeInvoice && (
        <InvoiceDetail
          key={`${invoiceKey(activeInvoice)}:${revision}`}
          invoice={activeInvoice}
          guides={invoiceGuides}
          lots={lots}
          busy={busy || loading}
          onBusy={setBusy}
          onDirty={setDirty}
          onSaved={savedGuide}
          mutate={mutate}
          onAdd={() => {
            if (
              builderDirty &&
              !window.confirm(
                "¿Reemplazar los datos de vinculación que estás preparando?",
              )
            )
              return;
            setCarrier(activeInvoice.ruc);
            setSearchedCarrier(activeInvoice.ruc);
            setDocument(activeInvoice.document_number);
            setDate(activeInvoice.document_date);
            setAmount(moneyInput(activeInvoice.amount_usd));
            setSelected(new Set());
            guideExcel.clear();
            builder.current?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }}
        />
      )}
    </div>
  );
}
