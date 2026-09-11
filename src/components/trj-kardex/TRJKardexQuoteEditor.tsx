"use client";

import React, { useEffect, useRef, useState } from "react";
import { apiPost } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import { FastCellInput } from "../fixassets/FastCellInput";
import type {
  KardexGuide as Guide,
  KardexLot as Lot,
} from "../../lib/trjKardex";
export type QuoteSaved = { guide: Guide; rows: Lot[] };
const SCALE = BigInt(1000000);
const text = (value: unknown) => (value == null ? "" : String(value));

const identity = (row: Lot) =>
  JSON.stringify([row.lot, row.lot_corr, row.guide_number]);

const decimalValid = (value: string) =>
  /^(?:\d{1,12}(?:\.\d{1,3})?|\.\d{1,3})$/.test(value.trim());

const moneyValid = (value: string) =>
  /^(?:\d{1,12}(?:\.\d{1,2})?|\.\d{1,2})$/.test(value.trim());

const decimalPayload = (value: string) => {
  const trimmed = value.trim();

  return trimmed.startsWith(".") ? `0${trimmed}` : trimmed;
};

function fixedInputValue(value: unknown, decimals: number) {
  const raw = text(value).trim();

  if (!raw) return "";

  const number = Number(raw);

  return Number.isFinite(number) ? number.toFixed(decimals) : raw;
}

const tmhInputValue = (value: unknown) => fixedInputValue(value, 3);

const moneyInputValue = (value: unknown) => fixedInputValue(value, 2);

function units(value: unknown): bigint | null {
  const raw = text(value).trim();

  if (!/^-?(?:\d+(?:\.\d{1,6})?|\.\d{1,6})$/.test(raw)) return null;

  const negative = raw.startsWith("-");
  const [whole, fraction = ""] = raw.replace(/^-/, "").split(".");

  const result = BigInt(whole || "0") * SCALE + BigInt(fraction.padEnd(6, "0"));

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
  if (value == null || value === "" || !Number.isFinite(Number(value))) {
    return "—";
  }

  return Number(value).toLocaleString("es-PE", {
    minimumFractionDigits: money ? 2 : 3,
    maximumFractionDigits: money ? 2 : 3,
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
    /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/,
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
  return new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

export default function TRJKardexQuoteEditor({
  guide,
  lots,
  onSaved,
  onBusy,
  onDirty,
  onPreview,
  disabled,
}: {
  guide: Guide;
  lots: Lot[];
  onSaved: (result: QuoteSaved) => void;
  onBusy: (busy: boolean) => void;
  onDirty: (dirty: boolean) => void;
  onPreview: (amount: string | null) => void;
  disabled: boolean;
}) {
  const [arrival, setArrival] = useState(text(guide.arrival_date).slice(0, 16));

  const [rate, setRate] = useState(moneyInputValue(guide.pu_transport_usd));

  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      lots.map((row) => [identity(row), tmhInputValue(row.tmh_arrival)]),
    ),
  );

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const gate = useRef(false);
  const readOnly = guide.status_name === "CERRADO";

  const dirty =
    arrival !== text(guide.arrival_date).slice(0, 16) ||
    rate.trim() !== moneyInputValue(guide.pu_transport_usd) ||
    lots.some(
      (row) => values[identity(row)].trim() !== tmhInputValue(row.tmh_arrival),
    );

  useEffect(() => {
    onDirty(dirty);
  }, [dirty, onDirty]);

  const filled = lots.filter((row) => values[identity(row)].trim() !== "");

  const total = filled.reduce(
    (sum, row) => sum + (units(values[identity(row)]) ?? BigInt(0)),
    BigInt(0),
  );

  const rateUnits = units(rate);

  const calculated =
    rateUnits != null && filled.length
      ? (total * rateUnits + SCALE / BigInt(2)) / SCALE
      : null;

  const arrivalKey = arrival ? dateKey(arrival) : "";
  const departureKey = guide.departure_date
    ? dateKey(text(guide.departure_date))
    : "";

  const maxDateTimePe = peruNowInputValue();
  const maxDateTimeKeyPe = dateKey(maxDateTimePe);

  let validation = "";

  if (arrival && !arrivalKey) {
    validation = "La fecha de llegada no es válida";
  } else if (arrivalKey && arrivalKey > maxDateTimeKeyPe) {
    validation = "La llegada no puede ser futura (hora Perú)";
  } else if (arrivalKey && departureKey && arrivalKey < departureKey) {
    validation = "La llegada no puede ser anterior a la salida";
  }

  if (rate.trim() && !moneyValid(rate)) {
    validation = "El PU debe ser no negativo y tener hasta 2 decimales";
  }

  if (
    lots.some(
      (row) =>
        values[identity(row)].trim() && !decimalValid(values[identity(row)]),
    )
  ) {
    validation =
      "Revisa las TMH de llegada: números no negativos, hasta 3 decimales";
  }

  if (
    total >= BigInt("1000000000000000000") ||
    (calculated != null && calculated >= BigInt("1000000000000000000"))
  ) {
    validation = "Las TMH o el importe superan el máximo permitido";
  }

  async function save() {
    if (gate.current || disabled || readOnly || validation || !dirty) return;

    gate.current = true;
    setSaving(true);
    onBusy(true);
    setMessage("");

    try {
      const body: Record<string, unknown> = {
        guide_number: guide.guide_number,
      };

      if (arrival !== text(guide.arrival_date).slice(0, 16)) {
        body.arrival_date = arrival ? `${arrival.slice(0, 16)}:00.000` : null;
      }

      if (rate.trim() !== moneyInputValue(guide.pu_transport_usd)) {
        body.pu_transport_usd = rate.trim() ? decimalPayload(rate) : null;
      }

      const changed = lots.filter(
        (row) =>
          values[identity(row)].trim() !== tmhInputValue(row.tmh_arrival),
      );

      const changedRows = changed.map((row) => ({
        lot: row.lot,
        lot_corr: row.lot_corr,
        guide_number: row.guide_number,
        tmh_arrival: values[identity(row)].trim()
          ? decimalPayload(values[identity(row)])
          : null,
      }));
      let response: QuoteSaved | undefined;
      for (
        let offset = 0;
        offset < Math.max(1, changedRows.length);
        offset += 100
      ) {
        const result = await apiPost("/api/trjkar/guides/insert", {
          ...body,
          ...(changedRows.length
            ? { lots: changedRows.slice(offset, offset + 100) }
            : {}),
        });
        if (!result?.ok) throw new Error(result?.error || "No se pudo guardar");
        response = result as QuoteSaved;
      }

      onDirty(false);
      if (response) onSaved(response);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      gate.current = false;
      setSaving(false);
      onBusy(false);
    }
  }

  useEffect(() => {
    onPreview(
      validation || calculated == null ? null : decimalString(calculated),
    );
  }, [calculated, validation, onPreview]);

  return (
    <section className="trjq-card trjq-editor">
      <div className="trjq-editor-head">
        <div>
          <div className="trjq-editor-title">
            <h3>Guía {guide.guide_number}</h3>
            <span className="trjq-status">
              {readOnly
                ? "CERRADO"
                : filled.length === lots.length && lots.length
                  ? "COMPLETA"
                  : "PENDIENTE"}
            </span>
          </div>

          <div className="trjq-subtitle">
            {guide.transport_name || "Sin transportista"} · RUC{" "}
            {guide.transport_ruc || "—"} · Placa {guide.plate_1 || "—"}
          </div>
        </div>

        <Button
          onClick={() => void save()}
          disabled={disabled || readOnly || saving || !!validation || !dirty}
        >
          {saving ? "Guardando..." : "Guardar valorización"}
        </Button>
      </div>

      <fieldset disabled={disabled || saving || readOnly}>
        <div className="trjq-entry-card">
          <div className="trjq-section-title">Datos de valorización</div>

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
                step="60"
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
                maxLength={15}
                value={rate}
                onChange={(e) => {
                  const value = e.target.value;

                  if (/^(?:\d{0,12}(?:\.\d{0,2})?|\.\d{0,2})$/.test(value)) {
                    setRate(value);
                  }
                }}
              />
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
              {fmt(calculated == null ? null : decimalString(calculated), true)}
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

        <div className="trjq-lots-layout">
          <div className="trjq-lots-card">
            <div className="trjq-section-title">Llegadas por lote</div>

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

                    const invalid = !!value.trim() && !decimalValid(value);

                    return (
                      <tr
                        key={identity(row)}
                        data-state={
                          invalid
                            ? "invalid"
                            : value.trim() !== tmhInputValue(row.tmh_arrival)
                              ? "valid"
                              : undefined
                        }
                      >
                        <td>
                          <strong>{row.lot}</strong>
                        </td>

                        <td>{row.lot_corr}</td>

                        <td>{fmt(row.tmh_departure)}</td>

                        <td>
                          <FastCellInput
                            className={`input trjq-tmh-input ${invalid ? "trjq-input-error" : ""}`}
                            aria-label={`Llegada ${row.lot} ${row.lot_corr}`}
                            aria-invalid={invalid}
                            inputMode="decimal"
                            maxLength={16}
                            value={value}
                            onLiveChange={(next) =>
                              setValues((current) => ({
                                ...current,
                                [identity(row)]: next,
                              }))
                            }
                            onCommit={(next) =>
                              setValues((current) => ({
                                ...current,
                                [identity(row)]: next,
                              }))
                            }
                          />
                        </td>

                        <td>
                          {arrivalUnits != null && departureUnits != null
                            ? fmt(decimalString(arrivalUnits - departureUnits))
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}

                  {!lots.length && (
                    <tr>
                      <td colSpan={5}>Agrega los lotes desde Guías.</td>
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
        </div>
      </fieldset>

      {(validation || message) && (
        <div role="alert" className="trjq-message trjq-error">
          {validation || message}
        </div>
      )}
    </section>
  );
}
