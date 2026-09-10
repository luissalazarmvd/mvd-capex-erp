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
  tmh_balance: string | null;
};

type Sgm = {
  lot: string;
  entry_date: string | null;
  tmh: string | null;
  tmh_departure: string | null;
  tmh_balance: string | null;
  next_corr: string | null;
};

type Role = "transport" | "sender" | "recipient";

type Party = {
  name: string | null;
  address: string | null;
  district: string | null;
  province: string | null;
  department: string | null;
  guide_number: string | null;
  source: string;
};

type Field = {
  key: string;
  label: string;
  max: number;
  kind?: "datetime" | "decimal";
  role?: Role;
};

type Draft = Record<string, string>;

const GROUPS: {
  title: string;
  fields: Field[];
}[] = [
  {
    title: "Documentos",
    fields: [
      {
        key: "transport_guide_number",
        label: "Guía transportista",
        max: 100,
      },
    ],
  },
  {
    title: "Transportista y vehículo",
    fields: [
      {
        key: "transport_ruc",
        label: "RUC transportista",
        max: 11,
        role: "transport",
      },
      {
        key: "transport_name",
        label: "Razón social transportista",
        max: 255,
      },
      {
        key: "driver_name",
        label: "Conductor",
        max: 255,
      },
      {
        key: "drive_license",
        label: "Licencia de conducir",
        max: 50,
      },
      {
        key: "plate_1",
        label: "Placa 1",
        max: 6,
      },
      {
        key: "plate_2",
        label: "Placa 2",
        max: 6,
      },
    ],
  },
  {
    title: "Remitente y origen",
    fields: [
      {
        key: "sender_ruc",
        label: "RUC remitente",
        max: 11,
        role: "sender",
      },
      {
        key: "sender_name",
        label: "Razón social remitente",
        max: 255,
      },
      {
        key: "origin_department",
        label: "Departamento de origen",
        max: 150,
      },
      {
        key: "origin_province",
        label: "Provincia de origen",
        max: 150,
      },
      {
        key: "origin_district",
        label: "Distrito de origen",
        max: 150,
      },
      {
        key: "origin_address",
        label: "Dirección de origen",
        max: 500,
      },
    ],
  },
  {
    title: "Destinatario y destino",
    fields: [
      {
        key: "recipient_ruc",
        label: "RUC destinatario",
        max: 11,
        role: "recipient",
      },
      {
        key: "recipient_name",
        label: "Razón social destinatario",
        max: 255,
      },
      {
        key: "destination_department",
        label: "Departamento de destino",
        max: 150,
      },
      {
        key: "destination_province",
        label: "Provincia de destino",
        max: 150,
      },
      {
        key: "destination_district",
        label: "Distrito de destino",
        max: 150,
      },
      {
        key: "destination_address",
        label: "Dirección de destino",
        max: 500,
      },
    ],
  },
  {
    title: "Carga y traslado · hora Perú",
    fields: [
      {
        key: "load_ini",
        label: "Inicio de carga",
        max: 23,
        kind: "datetime",
      },
      {
        key: "load_fin",
        label: "Fin de carga",
        max: 23,
        kind: "datetime",
      },
      {
        key: "departure_date",
        label: "Salida",
        max: 23,
        kind: "datetime",
      },
    ],
  },
];

const FIELDS = GROUPS.flatMap((group) => group.fields);
const SCALE = BigInt(1000000);
const text = (value: unknown) => value == null ? "" : String(value);
const code = (value: string) => value.trim().toUpperCase();

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

  const amount =
    BigInt(whole) * SCALE +
    BigInt(fraction.padEnd(6, "0"));

  return negative ? -amount : amount;
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

function draftOf(guide?: Guide): Draft {
  return Object.fromEntries([
    ["guide_number", guide?.guide_number || ""],
    ...FIELDS.map((field) => [
      field.key,
      text(guide?.[field.key]),
    ]),
  ]);
}

function partyValues(role: Role, party?: Party): Draft {
  const result: Draft = {
    [`${role}_name`]: party?.name || "",
  };

  if (role !== "transport") {
    const prefix = role === "sender"
      ? "origin"
      : "destination";

    for (
      const key of [
        "address",
        "district",
        "province",
        "department",
      ] as const
    ) {
      result[`${prefix}_${key}`] = party?.[key] || "";
    }
  }

  return result;
}

function LotHistory({
  lot,
  rows,
}: {
  lot: string;
  rows: Lot[];
}) {
  const matches = rows.filter(
    (row) => code(row.lot) === code(lot)
  );

  if (!matches.length) {
    return <span className="muted">Sin salidas anteriores</span>;
  }

  return (
    <details className="trjg-history">
      <summary
        title={matches
          .map(
            (row) =>
              `${row.guide_number} · ${row.lot_corr}: ${fmt(row.tmh_departure)} TMH`
          )
          .join("\n")}
      >
        Ver {new Set(matches.map((row) => row.guide_number)).size} guía(s)
      </summary>

      <div className="trjg-scroll">
        <table>
          <thead>
            <tr>
              <th>Guía</th>
              <th>Corr.</th>
              <th>Salida</th>
              <th>Llegada</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((row) => (
              <tr key={identity(row)}>
                <td>{row.guide_number}</td>
                <td>{row.lot_corr}</td>
                <td>{fmt(row.tmh_departure)}</td>
                <td>{fmt(row.tmh_arrival)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export default function TRJKardexGuides() {
  const [guides, setGuides] = useState<Guide[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [sgm, setSgm] = useState<Sgm[]>([]);
  const [draft, setDraft] = useState<Draft>(draftOf());
  const [original, setOriginal] = useState<Draft>(draftOf());
  const [active, setActive] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [lotSearch, setLotSearch] = useState("");
  const [newLot, setNewLot] = useState("");
  const [newDeparture, setNewDeparture] = useState("");

  const [editing, setEditing] = useState<{
    row: Lot;
    value: string;
  } | null>(null);

  const [candidates, setCandidates] = useState<
    Partial<Record<Role, Party[]>>
  >({});

  const [lookupBusy, setLookupBusy] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  const gate = useRef(false);
  const epoch = useRef(0);
  const draftRef = useRef(draft);

  const writeDraft = (next: Draft) => {
    draftRef.current = next;
    setDraft(next);
  };

  const notify = (value: string, failed = false) => {
    setMessage(value);
    setError(failed);
  };

  const load = useCallback(async () => {
    const responses = await Promise.all([
      apiGet("/api/trjkar/guides"),
      apiGet("/api/trjkar"),
      apiGet("/api/trjkar/sgm-hist"),
    ]);

    for (const response of responses) {
      if (
        response?.ok === false ||
        !Array.isArray(response?.rows)
      ) {
        throw new Error(response?.error || "Respuesta inválida");
      }
    }

    const next = responses[0].rows as Guide[];

    setGuides(next);
    setLots(responses[1].rows as Lot[]);
    setSgm(responses[2].rows as Sgm[]);

    return next;
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

  const activeGuide = guides.find(
    (guide) => guide.guide_number === active
  );

  const guideLots = useMemo(
    () => lots.filter((row) => row.guide_number === active),
    [lots, active]
  );

  const sgmByLot = useMemo(
    () => new Map(sgm.map((row) => [code(row.lot), row])),
    [sgm]
  );

  const changedFields = FIELDS.filter(
    (field) =>
      draft[field.key].trim() !== original[field.key].trim()
  );

  const dirty = creating
    ? Object.values(draft).some((value) => value.trim())
    : changedFields.length > 0;

  const unsaved =
    dirty ||
    !!editing ||
    !!newLot ||
    !!newDeparture;

  const blockedLots =
    !active ||
    creating ||
    dirty ||
    loading ||
    saving;

  const selectedSgm = sgmByLot.get(code(newLot));

  const cleanupExists = guideLots.some(
    (row) => code(row.lot) === "LIMPIEZA"
  );

  const availableLots = sgm.filter(
    (row) => code(row.lot).includes(code(lotSearch))
  );

  const filtered = useMemo(() => {
    const needle = code(search);

    return guides.filter((guide) =>
      [
        guide.guide_number,
        guide.transport_name,
        guide.transport_ruc,
        guide.plate_1,
        guide.recipient_name,
      ].some((value) => code(text(value)).includes(needle))
    );
  }, [guides, search]);

  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const currentPage = Math.min(page, pages);

  const visible = filtered.slice(
    (currentPage - 1) * 20,
    currentPage * 20
  );

  let guideError = "";

  if (
    !draft.guide_number.trim() ||
    draft.guide_number.trim().length > 100
  ) {
    guideError = "Ingresa el número de guía remitente";
  }

  if (
    creating &&
    guides.some(
      (guide) =>
        code(guide.guide_number) === code(draft.guide_number)
    )
  ) {
    guideError = "La guía ya existe; ábrela desde el histórico";
  }

  for (const field of FIELDS) {
    const value = draft[field.key].trim();

    if (value.length > field.max) {
      guideError =
        `${field.label}: máximo ${field.max} caracteres`;
    }

    if (field.role && value && !/^\d{11}$/.test(value)) {
      guideError = `${field.label}: deben ser 11 dígitos`;
    }

    if (
      field.kind === "decimal" &&
      value &&
      !decimalValid(value)
    ) {
      guideError =
        `${field.label}: número no negativo, hasta 6 decimales`;
    }

    if (
      field.kind === "datetime" &&
      value &&
      !dateKey(value)
    ) {
      guideError = `${field.label}: fecha u hora inválida`;
    }
  }

  if (
    draft.load_fin &&
    (
      !draft.load_ini ||
      dateKey(draft.load_fin) <= dateKey(draft.load_ini)
    )
  ) {
    guideError = "Fin de carga debe ser posterior al inicio";
  }


  function departureError(
    lot: string,
    value: string,
    old?: Lot
  ) {
    if (!lot) return "Selecciona un lote";

    if (!decimalValid(value)) {
      return "Ingresa TMH válidas, hasta 6 decimales";
    }

    const amount = units(value)!;

    if (!old && amount <= BigInt(0)) {
      return "La salida inicial debe ser mayor a cero";
    }

    if (code(lot) === "LIMPIEZA") {
      return !old && cleanupExists
        ? "Esta guía ya tiene LIMPIEZA"
        : "";
    }

    const balance = units(
      sgmByLot.get(code(lot))?.tmh_balance
    );

    if (balance == null) {
      return "El lote no tiene saldo disponible en SGM";
    }

    if (!old && !sgmByLot.get(code(lot))?.next_corr) {
      return "Se agotaron los correlativos";
    }

    return amount >
      balance + (units(old?.tmh_departure) ?? BigInt(0))
      ? "Las TMH superan el saldo del lote"
      : "";
  }

  function openGuide(guide?: Guide) {
    if (gate.current || loading) return;

    if (
      unsaved &&
      !window.confirm(
        "Hay cambios sin guardar. ¿Deseas descartarlos?"
      )
    ) {
      return;
    }

    epoch.current += 1;
    setLookupBusy(null);

    const next = draftOf(guide);

    writeDraft(next);
    setOriginal(next);
    setActive(guide?.guide_number || null);
    setCreating(!guide);
    setCandidates({});
    setNewLot("");
    setNewDeparture("");
    setEditing(null);
    setLotSearch("");
    notify("");
  }

  function change(field: Field, value: string) {
    const next = {
      ...draftRef.current,
      [field.key]: value,
    };

    if (
      field.role &&
      value !== draftRef.current[field.key]
    ) {
      Object.assign(next, partyValues(field.role));

      setCandidates((current) => ({
        ...current,
        [field.role!]: [],
      }));
    }

    writeDraft(next);
  }

  async function lookup(role: Role) {
    const ruc = draftRef.current[`${role}_ruc`].trim();

    if (!/^\d{11}$/.test(ruc) || gate.current) return;

    const ticket = ++epoch.current;

    setLookupBusy(role);

    try {
      const response = await apiGet(
        `/api/trjkar/lookups?role=${role}&ruc=${encodeURIComponent(ruc)}`
      );

      if (
        ticket !== epoch.current ||
        draftRef.current[`${role}_ruc`].trim() !== ruc
      ) {
        return;
      }

      if (response?.ok === false) {
        throw new Error(response.error);
      }

      const rows = (response.rows || []) as Party[];

      setCandidates((current) => ({
        ...current,
        [role]: rows,
      }));

      if (rows[0]) {
        const next = { ...draftRef.current };

        for (
          const [key, value] of Object.entries(
            partyValues(role, rows[0])
          )
        ) {
          if (!next[key].trim()) {
            next[key] = value;
          }
        }

        writeDraft(next);
      } else {
        notify(
          "No hay datos históricos para ese RUC. Puedes completarlos manualmente"
        );
      }
    } catch (e) {
      if (ticket === epoch.current) {
        notify(
          e instanceof Error
            ? e.message
            : "No se pudo consultar el RUC",
          true
        );
      }
    } finally {
      if (ticket === epoch.current) {
        setLookupBusy(null);
      }
    }
  }

  function acceptSave(response: {
    guide: Guide;
    rows: Lot[];
  }) {
    setGuides((current) => [
      response.guide,
      ...current.filter(
        (guide) =>
          guide.guide_number !== response.guide.guide_number
      ),
    ]);

    setLots((current) => [
      ...current.filter(
        (row) =>
          row.guide_number !== response.guide.guide_number
      ),
      ...response.rows,
    ]);

    const next = draftOf(response.guide);

    writeDraft(next);
    setOriginal(next);
    setActive(response.guide.guide_number);
    setCreating(false);
  }

  async function saveGuide() {
    if (
      gate.current ||
      guideError ||
      lookupBusy ||
      !dirty
    ) {
      return;
    }

    gate.current = true;
    setSaving(true);
    notify("");
    epoch.current += 1;

    try {
      const body: Record<string, unknown> = {
        guide_number: code(draft.guide_number),
        create_only: creating,
      };

      for (
        const field of creating ? FIELDS : changedFields
      ) {
        const value = draft[field.key].trim();

        if (!creating || value) {
          body[field.key] = value || null;
        }
      }

      const response = await apiPost(
        "/api/trjkar/guides/insert",
        body
      );

      if (!response?.ok) {
        throw new Error(
          response?.error || "No se pudo guardar la guía"
        );
      }

      acceptSave(response);
      notify("Guía guardada. Puedes agregar sus lotes");
    } catch (e) {
      notify(
        e instanceof Error ? e.message : "No se pudo guardar",
        true
      );
    } finally {
      gate.current = false;
      setSaving(false);
    }
  }

  async function saveLot(old?: Lot) {
    const lot = old?.lot || newLot;
    const value = old ? editing?.value || "" : newDeparture;

    if (
      gate.current ||
      blockedLots ||
      departureError(lot, value, old)
    ) {
      return;
    }

    gate.current = true;
    setSaving(true);
    notify("");

    try {
      const response = await apiPost(
        "/api/trjkar/lots/insert",
        {
          guide_number: active,
          lot,
          ...(old ? { lot_corr: old.lot_corr } : {}),
          tmh_departure: value.trim(),
        }
      );

      if (!response?.ok) {
        throw new Error(
          response?.error || "No se pudo guardar el lote"
        );
      }

      acceptSave(response);
      setNewLot("");
      setNewDeparture("");
      setEditing(null);

      notify(
        `Lote guardado · correlativo ${response.saved?.[0]?.lot_corr || ""}`
      );

      try {
        await load();
      } catch {
        notify(
          "Lote guardado. No se pudo refrescar el saldo; actualiza antes de continuar",
          true
        );
      }
    } catch (e) {
      notify(
        e instanceof Error ? e.message : "No se pudo guardar",
        true
      );

      try {
        await load();
      } catch {}
    } finally {
      gate.current = false;
      setSaving(false);
    }
  }

  async function refresh() {
    if (
      gate.current ||
      (
        unsaved &&
        !window.confirm(
          "¿Descartar los cambios sin guardar y actualizar?"
        )
      )
    ) {
      return;
    }

    epoch.current += 1;
    setLookupBusy(null);
    setLoading(true);

    try {
      const next = await load();

      const selected = next.find(
        (guide) => guide.guide_number === active
      );

      const values = draftOf(selected);

      writeDraft(values);
      setOriginal(values);
      setCandidates({});
      setNewLot("");
      setNewDeparture("");
      setEditing(null);
      setCreating(false);
      setActive(selected?.guide_number || null);
      notify("");
    } catch (e) {
      notify(
        e instanceof Error
          ? e.message
          : "No se pudo actualizar",
        true
      );
    } finally {
      setLoading(false);
    }
  }

  const newLotError = departureError(newLot, newDeparture);

  const editError = editing
    ? departureError(
        editing.row.lot,
        editing.value,
        editing.row
      )
    : "";

  return (
    <div className="trjk-guides">
      <style>{`
        .trjk-guides{position:relative;display:grid;gap:10px;min-width:0;min-height:0}
        .trjk-guides .trjg-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;min-width:0}
        .trjk-guides .trjg-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;min-width:0}
        .trjk-guides label{display:grid;gap:5px;font-size:12px;font-weight:800;min-width:0}
        .trjk-guides .input{width:100%;min-width:0;height:34px;padding:6px 8px;box-sizing:border-box}
        .trjk-guides fieldset{border:0;padding:0;margin:0;min-width:0}
        .trjk-guides .trjg-section{border-top:1px solid rgba(147,211,230,.22);padding-top:12px;margin-top:12px;min-width:0}
        .trjk-guides h3{margin:0 0 10px;font-size:14px}
        .trjk-guides .trjg-scroll{overflow:auto;max-height:52vh;min-width:0;max-width:100%}
        .trjk-guides table{border-collapse:collapse;width:max-content;min-width:100%;font-size:12px}
        .trjk-guides th{background:#163b49;position:sticky;top:0;z-index:1;text-align:left}
        .trjk-guides td,.trjk-guides th{padding:8px 10px;border-bottom:1px solid rgba(147,211,230,.16);white-space:nowrap}
        .trjk-guides tr[data-active=true]{background:rgba(94,128,25,.28)}
        .trjk-guides .trjg-message{padding:8px 10px;border:1px solid rgba(147,211,230,.35);border-radius:8px;background:rgba(11,77,107,.5)}
        .trjk-guides .trjg-error{color:#ffd3ba;border-color:#d85d27}
        .trjk-guides .trjg-metrics{display:flex;gap:20px;flex-wrap:wrap;padding:10px 0;font-size:13px}
        .trjk-guides .trjg-history summary{cursor:pointer;color:#a4dbea}
        .trjk-guides .trjg-history[open]{min-width:min(310px,100%)}
        .trjk-guides button:disabled{opacity:.45;cursor:not-allowed}
        .trjk-guides .trjg-note{font-size:12px;opacity:.8;margin-top:8px}
        @media (max-width:900px){
          .trjk-guides .trjg-grid{grid-template-columns:minmax(0,1fr)}
          .trjk-guides .trjg-bar{align-items:stretch}
        }
      `}</style>

      <div className="trjg-bar">
        <div>
          <h2 style={{ margin: 0, fontSize: 19 }}>
            Kardex de transporte · Guías
          </h2>
          <div className="muted" style={{ fontSize: 12 }}>
            Registro de guías remitentes y salidas por lote
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <Button
            onClick={() => void refresh()}
            disabled={loading || saving}
          >
            Actualizar
          </Button>

          <Button
            onClick={() => openGuide()}
            disabled={loading || saving}
          >
            Nueva guía
          </Button>
        </div>
      </div>

      {message && (
        <div
          role={error ? "alert" : "status"}
          className={`trjg-message ${error ? "trjg-error" : ""}`}
        >
          {message}
        </div>
      )}

      <section
        className="panel-inner"
        style={{ padding: 12, background: "#0b4d6b" }}
      >
        <div className="trjg-bar" style={{ marginBottom: 10 }}>
          <input
            className="input"
            style={{ maxWidth: 500 }}
            aria-label="Buscar guías"
            placeholder="Buscar guía, transportista, RUC o placa"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />

          <span className="muted">
            {filtered.length} guía(s)
          </span>
        </div>

        <div className="trjg-scroll">
          <table>
            <thead>
              <tr>
                <th>Detalle</th>
                <th>Guía remitente</th>
                <th>Transportista</th>
                <th>Placa</th>
                <th>Salida</th>
                <th>TMH salida</th>
                <th>TMH llegada</th>
              </tr>
            </thead>

            <tbody>
              {visible.map((guide) => (
                <tr
                  key={guide.guide_number}
                  data-active={active === guide.guide_number}
                >
                  <td>
                    <Button
                      size="sm"
                      onClick={() => openGuide(guide)}
                      disabled={saving || loading}
                      aria-expanded={active === guide.guide_number}
                    >
                      Abrir
                    </Button>
                  </td>
                  <td>
                    <strong>{guide.guide_number}</strong>
                  </td>
                  <td>{guide.transport_name || "—"}</td>
                  <td>{guide.plate_1 || "—"}</td>
                  <td>{dateLabel(guide.departure_date)}</td>
                  <td>{fmt(guide.tmh_departure)}</td>
                  <td>{fmt(guide.tmh_arrival)}</td>
                </tr>
              ))}

              {!visible.length && (
                <tr>
                  <td colSpan={7}>
                    {loading
                      ? "Cargando..."
                      : "No hay guías para mostrar"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="trjg-bar" style={{ marginTop: 10 }}>
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

      {(creating || active) && (
        <section
          className="panel-inner"
          style={{
            padding: 12,
            background: "var(--panel2)",
            borderColor: "rgba(147,211,230,.5)",
            maxHeight: "calc(100vh - 330px)",
            minHeight: 0,
            overflow: "auto",
          }}
        >
          <div className="trjg-bar">
            <h3>
              {creating ? "Nueva guía remitente" : `Guía ${active}`}
            </h3>

            <Button
              onClick={() => void saveGuide()}
              disabled={
                saving ||
                loading ||
                !!lookupBusy ||
                !!guideError ||
                !dirty ||
                !!editing
              }
            >
              {saving
                ? "Guardando..."
                : creating
                  ? "Crear guía"
                  : "Guardar guía"}
            </Button>
          </div>

          <fieldset disabled={saving || loading}>
            <label style={{ maxWidth: 350 }}>
              Número de guía remitente
              <input
                className="input"
                value={draft.guide_number}
                maxLength={100}
                readOnly={!creating}
                onChange={(e) =>
                  writeDraft({
                    ...draftRef.current,
                    guide_number: e.target.value,
                  })
                }
              />
            </label>

            {GROUPS.map((group) => (
              <div
                className="trjg-section"
                key={group.title}
              >
                <h3>{group.title}</h3>

                <div className="trjg-grid">
                  {group.fields.map((field) => (
                    <label key={field.key}>
                      {field.label}

                      <input
                        className="input"
                        type={
                          field.kind === "datetime"
                            ? "datetime-local"
                            : "text"
                        }
                        step={
                          field.kind === "datetime"
                            ? "0.001"
                            : undefined
                        }
                        inputMode={
                          field.kind === "decimal" || field.role
                            ? "decimal"
                            : "text"
                        }
                        maxLength={field.max}
                        value={draft[field.key]}
                        onChange={(e) =>
                          change(field, e.target.value)
                        }
                        onBlur={
                          field.role
                            ? () => void lookup(field.role!)
                            : undefined
                        }
                      />

                      {field.role && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => void lookup(field.role!)}
                            disabled={
                              !!lookupBusy ||
                              !/^\d{11}$/.test(draft[field.key])
                            }
                          >
                            {lookupBusy === field.role
                              ? "Buscando..."
                              : "Buscar datos históricos"}
                          </Button>

                          {!!candidates[field.role]?.length && (
                            <select
                              className="input"
                              value=""
                              aria-label={`Datos históricos de ${field.label}`}
                              onChange={(e) => {
                                const selected =
                                  candidates[field.role!]?.[
                                    Number(e.target.value)
                                  ];

                                if (selected) {
                                  writeDraft({
                                    ...draftRef.current,
                                    ...partyValues(
                                      field.role!,
                                      selected
                                    ),
                                  });
                                }
                              }}
                            >
                              <option value="">
                                Aplicar otra referencia histórica
                              </option>

                              {candidates[field.role]!.map(
                                (party, index) => (
                                  <option
                                    value={index}
                                    key={index}
                                  >
                                    {party.name} ·{" "}
                                    {party.address || party.source}
                                    {party.guide_number
                                      ? ` · ${party.guide_number}`
                                      : ""}
                                  </option>
                                )
                              )}
                            </select>
                          )}
                        </>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </fieldset>

          <div className="trjg-metrics">
            <span>
              TMH salida:{" "}
              <strong>{fmt(activeGuide?.tmh_departure)}</strong>
            </span>

            <span>
              TMH llegada:{" "}
              <strong>{fmt(activeGuide?.tmh_arrival)}</strong>
            </span>

            <span>
              Importe guardado USD:{" "}
              <strong>{fmt(activeGuide?.amount_usd, true)}</strong>
            </span>
          </div>

          {guideError && (
            <div className="trjg-message trjg-error">
              {guideError}
            </div>
          )}

          <div className="trjg-section">
            <h3>Lotes de la guía</h3>

            {creating ? (
              <div className="trjg-note">
                Primero crea la guía. Luego podrás agregar lotes.
              </div>
            ) : (
              <>
                {dirty && (
                  <div className="trjg-note">
                    Guarda los cambios de la guía antes de modificar
                    sus lotes.
                  </div>
                )}

                <fieldset
                  disabled={blockedLots || !!editing}
                  style={{ margin: "12px 0" }}
                >
                  <div className="trjg-grid">
                    <label>
                      Filtrar histórico de lotes
                      <input
                        className="input"
                        value={lotSearch}
                        onChange={(e) =>
                          setLotSearch(e.target.value)
                        }
                        placeholder="Código de lote"
                      />
                    </label>

                    <label>
                      Lote SGM
                      <select
                        className="input"
                        value={newLot}
                        onChange={(e) => {
                          setNewLot(e.target.value);
                          setNewDeparture("");
                        }}
                      >
                        <option value="">Seleccionar lote</option>

                        {newLot === "LIMPIEZA" && (
                          <option value="LIMPIEZA">
                            LIMPIEZA
                          </option>
                        )}

                        {newLot &&
                          newLot !== "LIMPIEZA" &&
                          !availableLots.some(
                            (row) => row.lot === newLot
                          ) && (
                            <option value={newLot}>
                              {newLot}
                            </option>
                          )}

                        {availableLots.map((row) => (
                          <option
                            key={row.lot}
                            value={row.lot}
                          >
                            {row.lot} · Saldo{" "}
                            {fmt(row.tmh_balance)} TMH
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      TMH de salida
                      <input
                        className="input"
                        inputMode="decimal"
                        maxLength={19}
                        value={newDeparture}
                        onChange={(e) =>
                          setNewDeparture(e.target.value)
                        }
                      />
                    </label>

                    <label>
                      Correlativo automático
                      <input
                        className="input"
                        readOnly
                        value={
                          newLot === "LIMPIEZA"
                            ? "0001"
                            : selectedSgm?.next_corr || "—"
                        }
                      />
                    </label>
                  </div>

                  <div
                    className="trjg-bar"
                    style={{ marginTop: 10 }}
                  >
                    <div>
                      <Button
                        size="sm"
                        disabled={
                          blockedLots ||
                          cleanupExists ||
                          !!editing
                        }
                        onClick={() => {
                          setNewLot("LIMPIEZA");
                          setNewDeparture("");
                        }}
                      >
                        Agregar LIMPIEZA
                      </Button>

                      <span
                        style={{ marginLeft: 12, fontSize: 12 }}
                      >
                        {newLot === "LIMPIEZA"
                          ? "Sin saldo SGM · una fila por guía"
                          : `Saldo del lote: ${fmt(selectedSgm?.tmh_balance)} TMH`}
                      </span>
                    </div>

                    <Button
                      disabled={
                        blockedLots ||
                        !!editing ||
                        !!newLotError
                      }
                      onClick={() => void saveLot()}
                    >
                      Guardar lote
                    </Button>
                  </div>
                </fieldset>

                {newLot && (
                  <div
                    style={{
                      display: "grid",
                      gap: 8,
                      marginBottom: 12,
                    }}
                  >
                    {newDeparture && newLotError && (
                      <span className="trjg-error">
                        {newLotError}
                      </span>
                    )}

                    {newLot !== "LIMPIEZA" && (
                      <LotHistory lot={newLot} rows={lots} />
                    )}
                  </div>
                )}

                <div className="trjg-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Lote</th>
                        <th>Corr.</th>
                        <th>TMH salida</th>
                        <th>TMH llegada</th>
                        <th>Saldo total lote</th>
                        <th>Distribución</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>

                    <tbody>
                      {guideLots.map((row) => {
                        const isEditing =
                          editing &&
                          identity(editing.row) === identity(row);

                        return (
                          <tr key={identity(row)}>
                            <td>
                              <strong>{row.lot}</strong>
                            </td>

                            <td>{row.lot_corr}</td>

                            <td>
                              {isEditing ? (
                                <input
                                  aria-label={`Salida ${row.lot} ${row.lot_corr}`}
                                  className="input"
                                  style={{ width: 130 }}
                                  inputMode="decimal"
                                  value={editing.value}
                                  disabled={saving}
                                  onChange={(e) =>
                                    setEditing({
                                      row,
                                      value: e.target.value,
                                    })
                                  }
                                />
                              ) : (
                                fmt(row.tmh_departure)
                              )}
                            </td>

                            <td>{fmt(row.tmh_arrival)}</td>

                            <td>
                              {code(row.lot) === "LIMPIEZA"
                                ? "No aplica"
                                : fmt(
                                    sgmByLot.get(code(row.lot))
                                      ?.tmh_balance ??
                                    row.tmh_balance
                                  )}
                            </td>

                            <td>
                              {code(row.lot) !== "LIMPIEZA" && (
                                <LotHistory
                                  lot={row.lot}
                                  rows={lots}
                                />
                              )}
                            </td>

                            <td>
                              {isEditing ? (
                                <div
                                  style={{
                                    display: "flex",
                                    gap: 6,
                                  }}
                                >
                                  <Button
                                    size="sm"
                                    disabled={
                                      blockedLots ||
                                      !!editError ||
                                      editing.value ===
                                        text(row.tmh_departure)
                                    }
                                    onClick={() => void saveLot(row)}
                                  >
                                    Guardar
                                  </Button>

                                  <Button
                                    size="sm"
                                    disabled={saving}
                                    onClick={() => setEditing(null)}
                                  >
                                    Cancelar
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  disabled={
                                    blockedLots ||
                                    !!editing ||
                                    !!newLot
                                  }
                                  onClick={() =>
                                    setEditing({
                                      row,
                                      value: text(
                                        row.tmh_departure
                                      ),
                                    })
                                  }
                                >
                                  Editar salida
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}

                      {!guideLots.length && (
                        <tr>
                          <td colSpan={7}>
                            Esta guía todavía no tiene lotes.
                          </td>
                        </tr>
                      )}
                    </tbody>

                    <tfoot>
                      <tr>
                        <th colSpan={2}>Total guía</th>
                        <td>{fmt(activeGuide?.tmh_departure)}</td>
                        <td>{fmt(activeGuide?.tmh_arrival)}</td>
                        <td colSpan={3} />
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {editing && editError && (
                  <div
                    className="trjg-message trjg-error"
                    style={{ marginTop: 8 }}
                  >
                    {editError}
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}