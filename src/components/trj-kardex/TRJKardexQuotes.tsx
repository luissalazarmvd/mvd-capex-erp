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

  let validation = "";

  if (arrival && !dateKey(arrival)) {
    validation = "La fecha de llegada no es válida";
  }

  if (
    arrival &&
    guide.departure_date &&
    dateKey(arrival) < dateKey(guide.departure_date)
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
    <section
      className="panel-inner"
      style={{
        padding: 14,
        background: "var(--panel2)",
        borderColor: "rgba(147,211,230,.5)",
      }}
    >
      <div className="trjq-bar">
        <div>
          <h3 style={{ margin: 0 }}>
            Guía {guide.guide_number}
          </h3>

          <div
            className="muted"
            style={{ fontSize: 12, marginTop: 5 }}
          >
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
        <div
          className="trjq-grid"
          style={{ marginTop: 14 }}
        >
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

        <div className="trjq-metrics">
          <span>
            TMH salida
            <strong>{fmt(guide.tmh_departure)}</strong>
          </span>

          <span>
            TMH llegada ingresadas
            <strong>{fmt(decimalString(total))}</strong>
          </span>

          <span>
            Importe calculado USD
            <strong>
              {fmt(
                calculated == null
                  ? null
                  : decimalString(calculated),
                true
              )}
            </strong>
          </span>

          <span>
            Lotes con llegada
            <strong>
              {filled.length} / {lots.length}
            </strong>
          </span>
        </div>

        {filled.length < lots.length && (
          <div className="trjq-note">
            El importe mostrado es parcial: faltan TMH de llegada
            en {lots.length - filled.length} lote(s).
          </div>
        )}

        <div
          className="trjq-scroll"
          style={{ marginTop: 12 }}
        >
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
                        className="input"
                        style={{
                          width: 150,
                          borderColor: invalid
                            ? "#d85d27"
                            : undefined,
                        }}
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
      </fieldset>

      <div
        className="panel-inner"
        style={{
          padding: 12,
          marginTop: 12,
          background: "rgba(2,35,52,.3)",
        }}
      >
        <h3 style={{ margin: "0 0 10px", fontSize: 14 }}>
          Factura · registro contable
        </h3>

        <div className="trjq-grid">
          <span>
            Documento
            <br />
            <strong>{document || "—"}</strong>
          </span>

          <span>
            Fecha de documento
            <br />
            <strong>{dateLabel(invoice?.document_date)}</strong>
          </span>

          <span>
            Subdiario / comprobante / secuencia
            <br />
            <strong>{reference}</strong>
          </span>

          <span>
            Importe contable USD
            <br />
            <strong>{fmt(invoice?.usd_amount, true)}</strong>
          </span>
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
              No se encontró esta factura para el RUC del
              transportista. Puedes guardarla y completar el cruce
              cuando esté en el histórico.
            </div>
          )}

        {invoiceMatches.length > 1 && (
          <div className="trjq-note">
            Hay {invoiceMatches.length} líneas contables. Se
            muestra la más reciente con el mismo criterio de tus
            vistas; no es una suma de líneas.
          </div>
        )}
      </div>

      {(validation || message) && (
        <div
          role="alert"
          className="trjq-message trjq-error"
          style={{ marginTop: 12 }}
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

  const filtered = useMemo(
    () =>
      guides.filter((guide) => {
        const matches = [
          guide.guide_number,
          guide.transport_name,
          guide.transport_ruc,
          guide.document_number,
        ].some((value) =>
          text(value)
            .toUpperCase()
            .includes(search.trim().toUpperCase())
        );

        const details =
          byGuide.get(guide.guide_number) || [];

        const pending =
          !guide.arrival_date ||
          guide.pu_transport_usd == null ||
          !guide.document_number ||
          !details.length ||
          details.some((row) => row.tmh_arrival == null);

        return matches && (!pendingOnly || pending);
      }),
    [guides, byGuide, search, pendingOnly]
  );

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
        .trjk-quotes{display:grid;gap:12px;min-width:0}
        .trjk-quotes .trjq-bar{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
        .trjk-quotes .trjq-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;font-size:12px}
        .trjk-quotes label{display:grid;gap:5px;min-width:0;font-size:12px}
        .trjk-quotes .input{width:100%;min-width:0;box-sizing:border-box}
        .trjk-quotes fieldset{border:0;padding:0;margin:0;min-width:0}
        .trjk-quotes .trjq-scroll{overflow:auto;max-height:52vh;min-width:0}
        .trjk-quotes table{border-collapse:collapse;width:100%;font-size:12px}
        .trjk-quotes th{background:#163b49;position:sticky;top:0;z-index:1;text-align:left}
        .trjk-quotes th,.trjk-quotes td{padding:9px 10px;border-bottom:1px solid rgba(147,211,230,.16);white-space:nowrap}
        .trjk-quotes tr[data-active=true]{background:rgba(94,128,25,.28)}
        .trjk-quotes .trjq-metrics{display:flex;gap:24px;flex-wrap:wrap;padding:14px 0;font-size:12px}
        .trjk-quotes .trjq-metrics strong{display:block;font-size:18px;margin-top:4px}
        .trjk-quotes .trjq-message{padding:10px 12px;border:1px solid rgba(147,211,230,.4);border-radius:8px;background:rgba(11,77,107,.5)}
        .trjk-quotes .trjq-error{color:#ffd3ba;border-color:#d85d27}
        .trjk-quotes .trjq-note{font-size:12px;opacity:.8;margin-top:10px}
        .trjk-quotes button:disabled{opacity:.45;cursor:not-allowed}
      `}</style>

      <div className="trjq-bar">
        <div>
          <h2 style={{ margin: 0, fontSize: 19 }}>
            Kardex de transporte · Valorización
          </h2>

          <div className="muted" style={{ fontSize: 12 }}>
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

      <section
        className="panel-inner"
        style={{ padding: 12, background: "#0b4d6b" }}
      >
        <div className="trjq-bar">
          <input
            className="input"
            style={{ maxWidth: 480 }}
            value={search}
            aria-label="Buscar valorizaciones"
            placeholder="Buscar guía, transportista, RUC o factura"
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
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

          <span>
            {filtered.length} guía(s) · Importe guardado USD{" "}
            <strong>
              {fmt(decimalString(totalAmount), true)}
            </strong>
          </span>
        </div>

        <div
          className="trjq-scroll"
          style={{ marginTop: 12 }}
        >
          <table>
            <thead>
              <tr>
                <th>Detalle</th>
                <th>Guía</th>
                <th>Transportista</th>
                <th>Llegada</th>
                <th>TMH llegada</th>
                <th>PU USD</th>
                <th>Importe USD</th>
                <th>Factura</th>
                <th>Importe contable USD</th>
                <th>Subd. / Comp. / Sec.</th>
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

        <div className="trjq-bar" style={{ marginTop: 10 }}>
          <span>
            Página {currentPage} de {pages}
          </span>

          <div style={{ display: "flex", gap: 6 }}>
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