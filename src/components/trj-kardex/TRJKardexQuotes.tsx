"use client";

import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { apiGet, apiPost } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import ExcelHeaderFilter, {
  compareExcelValues,
  matchesExcelFilter,
  type ExcelColumnFilter,
  type ExcelFilterKind,
  type ExcelSortDirection,
} from "./ExcelHeaderFilter";

type Guide = {
  guide_number: string;
  [key: string]: string | null;
};

type Lot = {
  lot: string;
  lot_corr: string;
  guide_number: string;
  tmh_departure: string | null;
  tmh_arrival: string | null;
};

type Invoice = {
  document_number: string;
  document_date: string | null;
  subjournal_code: string;
  voucher_number: string;
  sequence_number: string;
  usd_amount: string | null;
};

type Saved = {
  guide: Guide;
  rows: Lot[];
};

type QuoteExcelFilterKey =
  | "guide_number"
  | "transport_name"
  | "arrival_date"
  | "tmh_arrival"
  | "pu_transport_usd"
  | "amount_usd"
  | "document_number"
  | "invoice_amount_usd"
  | "accounting_reference";

const QUOTE_EXCEL_COLUMNS: Array<{
  key: QuoteExcelFilterKey;
  label: string;
  kind: ExcelFilterKind;
}> = [
  {
    key: "guide_number",
    label: "Guía",
    kind: "text",
  },
  {
    key: "transport_name",
    label: "Transportista",
    kind: "text",
  },
  {
    key: "arrival_date",
    label: "Llegada",
    kind: "date",
  },
  {
    key: "tmh_arrival",
    label: "TMH llegada",
    kind: "number",
  },
  {
    key: "pu_transport_usd",
    label: "PU USD",
    kind: "number",
  },
  {
    key: "amount_usd",
    label: "Importe USD",
    kind: "number",
  },
  {
    key: "document_number",
    label: "Factura",
    kind: "text",
  },
  {
    key: "invoice_amount_usd",
    label: "Importe contable USD",
    kind: "number",
  },
  {
    key: "accounting_reference",
    label: "Subd. / Comp. / Sec.",
    kind: "text",
  },
];

function quoteExcelFilterKind(
  key: QuoteExcelFilterKey
): ExcelFilterKind {
  if (key === "arrival_date") {
    return "date";
  }

  if (
    key === "tmh_arrival" ||
    key === "pu_transport_usd" ||
    key === "amount_usd" ||
    key === "invoice_amount_usd"
  ) {
    return "number";
  }

  return "text";
}

function quoteExcelValue(
  guide: Guide,
  key: QuoteExcelFilterKey
) {
  if (key === "arrival_date") {
    return text(
      guide.arrival_date
    ).slice(0, 10);
  }

  if (key === "accounting_reference") {
    return guide.subledger_num
      ? `${guide.subledger_num} / ${guide.comp_num || ""} / ${guide.secu_num || ""}`
      : "";
  }

  return text(guide[key]);
}

const SCALE = BigInt(1000000);
const text = (value: unknown) => value == null ? "" : String(value);

const identity = (row: Lot) =>
  JSON.stringify([
    row.lot,
    row.lot_corr,
    row.guide_number,
  ]);

const decimalValid = (value: string) =>
  /^\d{1,12}(\.\d{1,6})?$/.test(value.trim());

function units(value: unknown): bigint | null {
  const raw = text(value).trim();

  if (!/^-?\d+(\.\d{1,6})?$/.test(raw)) return null;

  const negative = raw.startsWith("-");
  const [whole, fraction = ""] = raw.replace(/^-/, "").split(".");

  const result =
    BigInt(whole) * SCALE +
    BigInt(fraction.padEnd(6, "0"));

  return negative ? -result : result;
}

function decimalString(value: bigint) {
  const negative = value < BigInt(0);
  const absolute = negative ? -value : value;

  return (
    `${negative ? "-" : ""}${absolute / SCALE}.` +
    `${String(absolute % SCALE).padStart(6, "0")}`
  );
}

function fmt(value: unknown, money = false) {
  if (
    value == null ||
    value === "" ||
    !Number.isFinite(Number(value))
  ) {
    return "—";
  }

  return Number(value).toLocaleString("es-PE", {
    minimumFractionDigits: money ? 2 : 3,
    maximumFractionDigits: money ? 2 : 6,
  });
}

function dateLabel(value: unknown) {
  const raw = text(value);

  return raw
    ? `${raw.slice(8, 10)}/${raw.slice(5, 7)}/${raw.slice(0, 4)} ${raw.slice(11, 16)}`.trim()
    : "—";
}

function dateKey(value: string) {
  const match = value.match(
    /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/
  );

  if (!match || Number(value.slice(0, 4)) < 1) return "";

  const normalized =
    `${match[1]}T${match[2]}:${match[3] || "00"}.` +
    `${(match[4] || "").padEnd(3, "0")}`;

  const parsed = new Date(`${normalized}Z`);

  return Number.isFinite(parsed.getTime()) &&
    parsed.toISOString() === `${normalized}Z`
    ? normalized
    : "";
}

function peruNowInputValue() {
  return new Date(Date.now() - 5 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);
}

function QuoteEditor({
  guide,
  lots,
  onSaved,
  onBusy,
  onDirty,
}: {
  guide: Guide;
  lots: Lot[];
  onSaved: (result: Saved) => void;
  onBusy: (busy: boolean) => void;
  onDirty: (dirty: boolean) => void;
}) {
  const [arrival, setArrival] = useState(
    text(guide.arrival_date)
  );

  const [rate, setRate] = useState(
    text(guide.pu_transport_usd)
  );

  const [document, setDocument] = useState(
    text(guide.document_number)
  );

  const [values, setValues] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        lots.map((row) => [
          identity(row),
          text(row.tmh_arrival),
        ])
      )
  );

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceError, setInvoiceError] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const gate = useRef(false);
  const listId = useId();

  const dirty =
    arrival !== text(guide.arrival_date) ||
    rate.trim() !== text(guide.pu_transport_usd).trim() ||
    document.trim() !== text(guide.document_number).trim() ||
    lots.some(
      (row) =>
        values[identity(row)].trim() !==
        text(row.tmh_arrival).trim()
    );

  useEffect(() => {
    onDirty(dirty);
  }, [dirty, onDirty]);

  useEffect(() => {
    let cancelled = false;

    if (!guide.transport_ruc) return;

    setInvoiceLoading(true);
    setInvoiceError("");

    void apiGet(
      `/api/trjkar/veta-hist?ruc=${encodeURIComponent(guide.transport_ruc)}`
    )
      .then((response) => {
        if (cancelled) return;

        if (
          response?.ok === false ||
          !Array.isArray(response?.rows)
        ) {
          throw new Error(
            response?.error || "Respuesta inválida"
          );
        }

        setInvoices(response.rows as Invoice[]);
      })
      .catch((e) => {
        if (!cancelled) {
          setInvoiceError(
            e instanceof Error
              ? e.message
              : "No se pudieron consultar las facturas"
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setInvoiceLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [guide.transport_ruc]);

  const filled = lots.filter(
    (row) => values[identity(row)].trim() !== ""
  );

  const total = filled.reduce(
    (sum, row) =>
      sum +
      (units(values[identity(row)]) ?? BigInt(0)),
    BigInt(0)
  );

  const rateUnits = units(rate);

  const calculated =
    rateUnits != null && filled.length
      ? (
          total * rateUnits +
          SCALE / BigInt(2)
        ) / SCALE
      : null;

  const invoiceMatches = invoices.filter(
    (row) =>
      row.document_number.trim().toUpperCase() ===
      document.trim().toUpperCase()
  );

  const invoice = invoiceMatches[0];

  const documents = [
    ...new Set(
      invoices
        .map((row) => row.document_number)
        .filter((value) => value.length <= 50)
    ),
  ];

  const reference = invoice
    ? `${invoice.subjournal_code} / ${invoice.voucher_number} / ${invoice.sequence_number}`
    : "—";

  const arrivalKey = arrival ? dateKey(arrival) : "";
  const departureKey = guide.departure_date
    ? dateKey(text(guide.departure_date))
    : "";

  const maxDateTimePe = peruNowInputValue();
  const maxDateTimeKeyPe = dateKey(maxDateTimePe);

  let validation = "";

  if (arrival && !arrivalKey) {
    validation = "La fecha de llegada no es válida";
  } else if (
    arrivalKey &&
    arrivalKey > maxDateTimeKeyPe
  ) {
    validation = "La llegada no puede ser futura (hora Perú)";
  } else if (
    arrivalKey &&
    departureKey &&
    arrivalKey < departureKey
  ) {
    validation = "La llegada no puede ser anterior a la salida";
  }

  if (rate.trim() && !decimalValid(rate)) {
    validation =
      "El PU debe ser no negativo y tener hasta 6 decimales";
  }

  if (document.trim().length > 50) {
    validation = "La factura admite hasta 50 caracteres";
  }

  if (
    lots.some(
      (row) =>
        values[identity(row)].trim() &&
        !decimalValid(values[identity(row)])
    )
  ) {
    validation =
      "Revisa las TMH de llegada: números no negativos, hasta 6 decimales";
  }

  if (
    total >= BigInt("1000000000000000000") ||
    (
      calculated != null &&
      calculated >= BigInt("1000000000000000000")
    )
  ) {
    validation = "Las TMH o el importe superan el máximo permitido";
  }

  async function save() {
    if (gate.current || validation || !dirty) return;

    gate.current = true;
    setSaving(true);
    onBusy(true);
    setMessage("");

    try {
      const body: Record<string, unknown> = {
        guide_number: guide.guide_number,
      };

      if (arrival !== text(guide.arrival_date)) {
        body.arrival_date = arrival || null;
      }

      if (
        rate.trim() !== text(guide.pu_transport_usd).trim()
      ) {
        body.pu_transport_usd = rate.trim() || null;
      }

      if (
        document.trim() !==
        text(guide.document_number).trim()
      ) {
        body.document_number = document.trim() || null;
      }

      const changed = lots.filter(
        (row) =>
          values[identity(row)].trim() !==
          text(row.tmh_arrival).trim()
      );

      if (changed.length) {
        body.lots = changed.map((row) => ({
          lot: row.lot,
          lot_corr: row.lot_corr,
          guide_number: row.guide_number,
          tmh_arrival: values[identity(row)].trim() || null,
        }));
      }

      const response = await apiPost(
        "/api/trjkar/guides/insert",
        body
      );

      if (!response?.ok) {
        throw new Error(
          response?.error || "No se pudo guardar"
        );
      }

      onDirty(false);
      onSaved(response as Saved);
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "No se pudo guardar"
      );
    } finally {
      gate.current = false;
      setSaving(false);
      onBusy(false);
    }
  }

  return (
    <section className="trjq-card trjq-editor">
      <div className="trjq-editor-head">
        <div>
          <div className="trjq-editor-title">
            <h3>Guía {guide.guide_number}</h3>
            <span className="trjq-status">
              {filled.length === lots.length && lots.length
                ? "COMPLETA"
                : "PENDIENTE"}
            </span>
          </div>

          <div className="trjq-subtitle">
            {guide.transport_name || "Sin transportista"} · RUC{" "}
            {guide.transport_ruc || "—"} · Placa{" "}
            {guide.plate_1 || "—"}
          </div>
        </div>

        <Button
          onClick={() => void save()}
          disabled={saving || !!validation || !dirty}
        >
          {saving ? "Guardando..." : "Guardar valorización"}
        </Button>
      </div>

      <fieldset disabled={saving}>
        <div className="trjq-entry-card">
          <div className="trjq-section-title">
            Datos de valorización
          </div>

          <div className="trjq-entry-grid">
            <label>
              Fecha de salida
              <input
                className="input"
                readOnly
                value={dateLabel(guide.departure_date)}
              />
            </label>

            <label>
              Llegada · hora Perú
              <input
                className="input"
                type="datetime-local"
                step="0.001"
                min={text(guide.departure_date).slice(0, 16) || undefined}
                max={maxDateTimePe}
                value={arrival}
                onChange={(e) => setArrival(e.target.value)}
              />
            </label>

            <label>
              PU transporte · USD/TMH
              <input
                className="input"
                inputMode="decimal"
                maxLength={19}
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
            </label>

            <label>
              Factura de transporte
              <input
                className="input"
                maxLength={50}
                list={listId}
                value={document}
                onChange={(e) => setDocument(e.target.value)}
              />

              <datalist id={listId}>
                {documents.map((value) => (
                  <option key={value} value={value} />
                ))}
              </datalist>
            </label>
          </div>
        </div>

        <div className="trjq-kpis">
          <div className="trjq-kpi" data-tone="departure">
            <span>TMH salida</span>
            <strong>{fmt(guide.tmh_departure)}</strong>
          </div>

          <div className="trjq-kpi" data-tone="arrival">
            <span>TMH llegada</span>
            <strong>{fmt(decimalString(total))}</strong>
          </div>

          <div className="trjq-kpi" data-tone="amount">
            <span>Importe calculado USD</span>
            <strong>
              {fmt(
                calculated == null
                  ? null
                  : decimalString(calculated),
                true
              )}
            </strong>
          </div>

          <div className="trjq-kpi" data-tone="lots">
            <span>Lotes con llegada</span>
            <strong>
              {filled.length} / {lots.length}
            </strong>
          </div>
        </div>

        {filled.length < lots.length && (
          <div className="trjq-note trjq-inline-note">
            Importe parcial: faltan TMH de llegada en{" "}
            {lots.length - filled.length} lote(s).
          </div>
        )}

        <div className="trjq-lots-card">
          <div className="trjq-section-title">
            Llegadas por lote
          </div>

          <div className="trjq-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Lote</th>
                  <th>Correlativo</th>
                  <th>TMH salida</th>
                  <th>TMH llegada</th>
                  <th>Diferencia TMH</th>
                </tr>
              </thead>

              <tbody>
                {lots.map((row) => {
                  const value = values[identity(row)];
                  const arrivalUnits = units(value);
                  const departureUnits = units(row.tmh_departure);

                  const invalid =
                    !!value.trim() &&
                    !decimalValid(value);

                  return (
                    <tr key={identity(row)}>
                      <td>
                        <strong>{row.lot}</strong>
                      </td>

                      <td>{row.lot_corr}</td>

                      <td>{fmt(row.tmh_departure)}</td>

                      <td>
                        <input
                          className={`input trjq-tmh-input ${invalid ? "trjq-input-error" : ""}`}
                          aria-label={`Llegada ${row.lot} ${row.lot_corr}`}
                          aria-invalid={invalid}
                          inputMode="decimal"
                          maxLength={19}
                          value={value}
                          onChange={(e) =>
                            setValues((current) => ({
                              ...current,
                              [identity(row)]: e.target.value,
                            }))
                          }
                        />
                      </td>

                      <td>
                        {arrivalUnits != null &&
                        departureUnits != null
                          ? fmt(
                              decimalString(
                                arrivalUnits - departureUnits
                              )
                            )
                          : "—"}
                      </td>
                    </tr>
                  );
                })}

                {!lots.length && (
                  <tr>
                    <td colSpan={5}>
                      Agrega los lotes desde Guías.
                    </td>
                  </tr>
                )}
              </tbody>

              <tfoot>
                <tr>
                  <th colSpan={2}>Total guía</th>
                  <td>{fmt(guide.tmh_departure)}</td>
                  <td>{fmt(decimalString(total))}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </fieldset>

      <div className="trjq-invoice-card">
        <div className="trjq-section-title">
          Factura · registro contable
        </div>

        <div className="trjq-invoice-grid">
          <div>
            <span>Documento</span>
            <strong>{document || "—"}</strong>
          </div>

          <div>
            <span>Fecha de documento</span>
            <strong>{dateLabel(invoice?.document_date)}</strong>
          </div>

          <div>
            <span>Subdiario / comprobante / secuencia</span>
            <strong>{reference}</strong>
          </div>

          <div>
            <span>Importe contable USD</span>
            <strong>{fmt(invoice?.usd_amount, true)}</strong>
          </div>
        </div>

        {invoiceLoading && (
          <div className="trjq-note">
            Consultando histórico contable...
          </div>
        )}

        {invoiceError && (
          <div className="trjq-error">
            {invoiceError}
          </div>
        )}

        {!invoiceLoading &&
          !invoiceError &&
          document.trim() &&
          !invoice && (
            <div className="trjq-note">
              No se encontró esta factura para el RUC del transportista. Puedes guardarla y completar el cruce cuando esté en el histórico.
            </div>
          )}

        {invoiceMatches.length > 1 && (
          <div className="trjq-note">
            Hay {invoiceMatches.length} líneas contables. Se muestra la más reciente con el mismo criterio de las vistas.
          </div>
        )}
      </div>

      {(validation || message) && (
        <div
          role="alert"
          className="trjq-message trjq-error"
        >
          {validation || message}
        </div>
      )}
    </section>
  );
}

export default function TRJKardexQuotes() {
  const [guides, setGuides] = useState<Guide[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pendingOnly, setPendingOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [quoteColumnFilters, setQuoteColumnFilters] = useState<
    Partial<Record<QuoteExcelFilterKey, ExcelColumnFilter>>
  >({});
  const [quoteExcelSort, setQuoteExcelSort] = useState<{
    key: QuoteExcelFilterKey;
    direction: ExcelSortDirection;
  } | null>(null);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    const [headers, details] = await Promise.all([
      apiGet("/api/trjkar/guides"),
      apiGet("/api/trjkar"),
    ]);

    for (const response of [headers, details]) {
      if (
        response?.ok === false ||
        !Array.isArray(response?.rows)
      ) {
        throw new Error(
          response?.error || "Respuesta inválida"
        );
      }
    }

    setGuides(headers.rows as Guide[]);
    setLots(details.rows as Lot[]);
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    void load()
      .catch((e) => {
        setError(true);
        setMessage(
          e instanceof Error ? e.message : "No se pudo cargar"
        );
      })
      .finally(() => setLoading(false));
  }, [load]);

  const byGuide = useMemo(() => {
    const result = new Map<string, Lot[]>();

    for (const row of lots) {
      result.set(row.guide_number, [
        ...(result.get(row.guide_number) || []),
        row,
      ]);
    }

    return result;
  }, [lots]);

  const quoteExcelValues = useMemo(
    () =>
      Object.fromEntries(
        QUOTE_EXCEL_COLUMNS.map((column) => [
          column.key,
          guides.map((guide) =>
            quoteExcelValue(
              guide,
              column.key
            )
          ),
        ])
      ) as Record<
        QuoteExcelFilterKey,
        string[]
      >,
    [guides]
  );

  const filtered = useMemo(() => {
    const needle =
      search
        .trim()
        .toUpperCase();

    const searched =
      guides.filter((guide) => {
        const matches = [
          guide.guide_number,
          guide.transport_name,
          guide.transport_ruc,
          guide.document_number,
        ].some((value) =>
          text(value)
            .toUpperCase()
            .includes(needle)
        );

        const details =
          byGuide.get(
            guide.guide_number
          ) || [];

        const pending =
          !guide.arrival_date ||
          guide.pu_transport_usd == null ||
          !guide.document_number ||
          !details.length ||
          details.some(
            (row) =>
              row.tmh_arrival == null
          );

        return (
          matches &&
          (
            !pendingOnly ||
            pending
          )
        );
      });

    const excelFiltered =
      searched.filter((guide) =>
        (
          Object.entries(
            quoteColumnFilters
          ) as Array<
            [
              QuoteExcelFilterKey,
              ExcelColumnFilter
            ]
          >
        ).every(([key, filter]) =>
          matchesExcelFilter(
            quoteExcelValue(
              guide,
              key
            ),
            filter,
            quoteExcelFilterKind(key)
          )
        )
      );

    if (!quoteExcelSort) {
      return excelFiltered;
    }

    return [...excelFiltered].sort(
      (a, b) =>
        compareExcelValues(
          quoteExcelValue(
            a,
            quoteExcelSort.key
          ),
          quoteExcelValue(
            b,
            quoteExcelSort.key
          ),
          quoteExcelFilterKind(
            quoteExcelSort.key
          ),
          quoteExcelSort.direction
        )
    );
  }, [
    guides,
    byGuide,
    search,
    pendingOnly,
    quoteColumnFilters,
    quoteExcelSort,
  ]);

  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const currentPage = Math.min(page, pages);

  const selected = guides.find(
    (guide) => guide.guide_number === active
  );

  const totalAmount = filtered.reduce(
    (sum, guide) =>
      sum + (units(guide.amount_usd) || BigInt(0)),
    BigInt(0)
  );

  function open(guide: Guide) {
    if (
      busy ||
      loading ||
      (
        dirty &&
        !window.confirm(
          "Hay cambios sin guardar. ¿Deseas descartarlos?"
        )
      )
    ) {
      return;
    }

    setActive(guide.guide_number);
    setDirty(false);
    setRevision((value) => value + 1);
    setMessage("");
  }

  async function refresh() {
    if (
      busy ||
      (
        dirty &&
        !window.confirm(
          "¿Descartar los cambios y actualizar?"
        )
      )
    ) {
      return;
    }

    setLoading(true);

    try {
      await load();
      setDirty(false);
      setMessage("");
    } catch (e) {
      setError(true);
      setMessage(
        e instanceof Error
          ? e.message
          : "No se pudo actualizar"
      );
    } finally {
      setLoading(false);
    }
  }

  function saved(result: Saved) {
    setGuides((current) =>
      current.map((guide) =>
        guide.guide_number === result.guide.guide_number
          ? result.guide
          : guide
      )
    );

    setLots((current) => [
      ...current.filter(
        (row) =>
          row.guide_number !== result.guide.guide_number
      ),
      ...result.rows,
    ]);

    setDirty(false);
    setRevision((value) => value + 1);
    setError(false);
    setMessage("Valorización y llegadas guardadas");
  }

  return (
    <div className="trjk-quotes">
      <style>{`
        .trjk-quotes{height:100%;max-height:calc(100dvh - 68px);overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-gutter:stable;display:grid;align-content:start;gap:10px;min-width:0;min-height:0;padding:0 6px 56px 0}
        .trjk-quotes *{box-sizing:border-box}
        .trjk-quotes .trjq-page-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;padding:2px 2px 0}
        .trjk-quotes .trjq-title{margin:0;font-size:18px;line-height:1.15}
        .trjk-quotes .trjq-subtitle{font-size:11px;opacity:.78;margin-top:3px}
        .trjk-quotes .trjq-card{min-width:0;border:1px solid rgba(147,211,230,.26);border-radius:10px;background:linear-gradient(180deg,rgba(7,71,101,.80),rgba(5,61,87,.72));box-shadow:0 6px 18px rgba(0,0,0,.08)}
        .trjk-quotes .trjq-list-card{padding:10px 12px}
        .trjk-quotes .trjq-bar{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;min-width:0}
        .trjk-quotes .trjq-search{width:min(420px,100%);height:32px;padding:5px 9px;font-size:12px}
        .trjk-quotes .trjq-toolbar-right{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:11px}
        .trjk-quotes .trjq-check{display:flex;align-items:center;gap:6px!important;font-size:11px!important;font-weight:600;cursor:pointer}
        .trjk-quotes .trjq-count{display:inline-flex;align-items:center;padding:4px 9px;border-radius:999px;background:rgba(147,211,230,.10);font-size:11px}
        .trjk-quotes .trjq-table-scroll{overflow-x:auto;overflow-y:visible;max-width:100%;margin-top:8px;border-radius:6px;border:1px solid rgba(147,211,230,.13)}
        .trjk-quotes table{border-collapse:collapse;width:max-content;min-width:100%;font-size:11px}
        .trjk-quotes th{background:#143444;text-align:left;color:#fff;font-weight:600}
        .trjk-quotes th,.trjk-quotes td{padding:7px 9px;border-bottom:1px solid rgba(147,211,230,.13);white-space:nowrap;vertical-align:middle}
        .trjk-quotes tbody tr:hover{background:rgba(147,211,230,.06)}
        .trjk-quotes tr[data-active=true]{background:rgba(117,151,41,.24)}
        .trjk-quotes .trjq-pagination{margin-top:8px;font-size:11px}
        .trjk-quotes .trjq-actions{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
        .trjk-quotes .trjq-editor{padding:11px 12px 14px;background:linear-gradient(180deg,rgba(5,56,82,.92),rgba(4,48,70,.82));border-color:rgba(151,205,58,.40)}
        .trjk-quotes .trjq-editor-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:9px}
        .trjk-quotes .trjq-editor-title{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
        .trjk-quotes .trjq-editor-title h3{margin:0;font-size:14px}
        .trjk-quotes .trjq-status{display:inline-flex;align-items:center;padding:3px 8px;border-radius:999px;font-size:10px;font-weight:600;background:rgba(151,205,58,.13);border:1px solid rgba(151,205,58,.32)}
        .trjk-quotes .trjq-entry-card{padding:9px 10px 10px;border:1px solid rgba(147,211,230,.18);border-left:3px solid rgba(191,145,217,.72);border-radius:6px;background:rgba(75,41,94,.08)}
        .trjk-quotes .trjq-section-title{font-size:12px;font-weight:700;margin-bottom:8px}
        .trjk-quotes .trjq-entry-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}
        .trjk-quotes label{display:grid;gap:4px;min-width:0;font-size:11px;font-weight:600}
        .trjk-quotes .input{width:100%;min-width:0;height:30px;padding:4px 8px;font-size:11px;line-height:1.2;border-radius:6px}
        .trjk-quotes input[list]{background:#0d222e;color:#fff;border:1px solid rgba(147,211,230,.35)}
        .trjk-quotes input[readonly]{opacity:.82;background:rgba(255,255,255,.035)}
        .trjk-quotes fieldset{border:0;padding:0;margin:0;min-width:0}
        .trjk-quotes .trjq-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:9px}
        .trjk-quotes .trjq-kpi{position:relative;display:grid;gap:3px;padding:8px 10px;border:1px solid rgba(147,211,230,.16);border-radius:6px;background:rgba(147,211,230,.055);overflow:hidden}
        .trjk-quotes .trjq-kpi:before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:rgba(147,211,230,.65)}
        .trjk-quotes .trjq-kpi[data-tone=arrival]:before{background:rgba(151,205,58,.78)}
        .trjk-quotes .trjq-kpi[data-tone=amount]:before{background:rgba(240,178,72,.78)}
        .trjk-quotes .trjq-kpi[data-tone=lots]:before{background:rgba(191,145,217,.72)}
        .trjk-quotes .trjq-kpi span{font-size:10px;opacity:.78}
        .trjk-quotes .trjq-kpi strong{font-size:15px}
        .trjk-quotes .trjq-inline-note{margin-top:7px;padding-left:1px}
        .trjk-quotes .trjq-lots-card{margin-top:9px;padding:9px 10px 10px;border:1px solid rgba(151,205,58,.28);border-left:3px solid rgba(151,205,58,.78);border-radius:6px;background:rgba(62,84,24,.09)}
        .trjk-quotes .trjq-tmh-input{width:118px}
        .trjk-quotes .trjq-input-error{border-color:#d85d27!important}
        .trjk-quotes .trjq-invoice-card{margin-top:9px;padding:9px 10px 10px;border:1px solid rgba(240,178,72,.28);border-left:3px solid rgba(240,178,72,.78);border-radius:6px;background:rgba(103,67,13,.08)}
        .trjk-quotes .trjq-invoice-grid{display:grid;grid-template-columns:1fr 1fr 1.5fr 1fr;gap:8px}
        .trjk-quotes .trjq-invoice-grid>div{min-width:0;padding:7px 8px;border-radius:6px;background:rgba(2,35,52,.23);border:1px solid rgba(147,211,230,.10)}
        .trjk-quotes .trjq-invoice-grid span{display:block;font-size:9px;opacity:.72;margin-bottom:3px}
        .trjk-quotes .trjq-invoice-grid strong{display:block;font-size:11px;overflow-wrap:anywhere}
        .trjk-quotes .trjq-message{padding:7px 9px;border:1px solid rgba(147,211,230,.35);border-radius:6px;background:rgba(11,77,107,.45);font-size:11px}
        .trjk-quotes .trjq-error{color:#ebb086;border-color:#d85d27}
        .trjk-quotes .trjq-note{font-size:10px;opacity:.82;margin-top:7px}
        .trjk-quotes button:disabled{opacity:.45;cursor:not-allowed}
        @media (max-width:1100px){
          .trjk-quotes .trjq-entry-grid,.trjk-quotes .trjq-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}
          .trjk-quotes .trjq-invoice-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
        }
        @media (max-width:700px){
          .trjk-quotes{max-height:calc(100dvh - 56px);padding-right:3px}
          .trjk-quotes .trjq-page-head{align-items:flex-start}
          .trjk-quotes .trjq-toolbar-right{width:100%;justify-content:space-between}
          .trjk-quotes .trjq-entry-grid,.trjk-quotes .trjq-kpis,.trjk-quotes .trjq-invoice-grid{grid-template-columns:1fr}
        }
      `}</style>

      <div className="trjq-page-head">
        <div>
          <h2 className="trjq-title">
            Kardex de transporte · Valorización
          </h2>

          <div className="trjq-subtitle">
            Llegadas, tarifa por guía y referencia de factura
          </div>
        </div>

        <Button
          disabled={busy || loading}
          onClick={() => void refresh()}
        >
          Actualizar
        </Button>
      </div>

      {message && (
        <div
          role={error ? "alert" : "status"}
          className={`trjq-message ${error ? "trjq-error" : ""}`}
        >
          {message}
        </div>
      )}

      <section className="trjq-card trjq-list-card">
        <div className="trjq-bar">
          <input
            className="input trjq-search"
            value={search}
            aria-label="Buscar valorizaciones"
            placeholder="Buscar guía, transportista, RUC o factura"
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />

          <div className="trjq-toolbar-right">
            <label className="trjq-check">
              <input
                type="checkbox"
                checked={pendingOnly}
                onChange={(e) => {
                  setPendingOnly(e.target.checked);
                  setPage(1);
                }}
              />
              Solo pendientes
            </label>

            <span className="trjq-count">
              {filtered.length} guía(s)
            </span>

            <span className="trjq-count">
              USD guardado {fmt(decimalString(totalAmount), true)}
            </span>
          </div>
        </div>

        <div className="trjq-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Detalle</th>

                {QUOTE_EXCEL_COLUMNS.map(
                  (column) => (
                    <th key={column.key}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 5,
                        }}
                      >
                        <span>
                          {column.label}
                        </span>

                        <ExcelHeaderFilter
                          label={column.label}
                          kind={column.kind}
                          values={
                            quoteExcelValues[
                              column.key
                            ] || []
                          }
                          filter={
                            quoteColumnFilters[
                              column.key
                            ]
                          }
                          sortDirection={
                            quoteExcelSort?.key ===
                            column.key
                              ? quoteExcelSort.direction
                              : undefined
                          }
                          onApply={(filter) => {
                            setQuoteColumnFilters(
                              (current) => ({
                                ...current,
                                [column.key]:
                                  filter,
                              })
                            );
                            setPage(1);
                          }}
                          onSort={(direction) => {
                            setQuoteExcelSort({
                              key: column.key,
                              direction,
                            });
                            setPage(1);
                          }}
                        />
                      </div>
                    </th>
                  )
                )}
              </tr>
            </thead>

            <tbody>
              {filtered
                .slice(
                  (currentPage - 1) * 20,
                  currentPage * 20
                )
                .map((guide) => (
                  <tr
                    key={guide.guide_number}
                    data-active={guide.guide_number === active}
                  >
                    <td>
                      <Button
                        size="sm"
                        disabled={busy || loading}
                        onClick={() => open(guide)}
                        aria-expanded={
                          active === guide.guide_number
                        }
                      >
                        Abrir
                      </Button>
                    </td>

                    <td>
                      <strong>{guide.guide_number}</strong>
                    </td>

                    <td>{guide.transport_name || "—"}</td>
                    <td>{dateLabel(guide.arrival_date)}</td>
                    <td>{fmt(guide.tmh_arrival)}</td>
                    <td>{fmt(guide.pu_transport_usd, true)}</td>
                    <td>{fmt(guide.amount_usd, true)}</td>
                    <td>{guide.document_number || "—"}</td>
                    <td>{fmt(guide.invoice_amount_usd, true)}</td>

                    <td>
                      {guide.subledger_num
                        ? `${guide.subledger_num} / ${guide.comp_num || "—"} / ${guide.secu_num || "—"}`
                        : "—"}
                    </td>
                  </tr>
                ))}

              {!filtered.length && (
                <tr>
                  <td colSpan={10}>
                    {loading
                      ? "Cargando..."
                      : "No hay guías para mostrar"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="trjq-bar trjq-pagination">
          <span>
            Página {currentPage} de {pages}
          </span>

          <div className="trjq-actions">
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

      {selected && !loading && (
        <QuoteEditor
          key={`${selected.guide_number}:${revision}`}
          guide={selected}
          lots={byGuide.get(selected.guide_number) || []}
          onSaved={saved}
          onBusy={setBusy}
          onDirty={setDirty}
        />
      )}
    </div>
  );
}