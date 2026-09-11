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
  bags_tot: string | null;
  bags_used: string | null;
  balance_obs: string | null;
  tmh_balance: string | null;
};

type Sgm = {
  lot: string;
  entry_date: string | null;
  tmh: string | null;
  tmh_departure: string | null;
  tmh_balance: string | null;
  next_corr: string | null;
  last_guide_number: string | null;
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

type RucHistory = {
  ruc: string;
  name: string | null;
  source: string;
};

type Field = {
  key: string;
  label: string;
  max: number;
  kind?: "date" | "datetime" | "decimal";
  decimals?: number;
  role?: Role;
};

type Draft = Record<string, string>;

type GuideExcelFilterKey =
  | "guide_number"
  | "transport_name"
  | "plate_1"
  | "departure_date"
  | "tmh_departure"
  | "tmh_arrival";

const GUIDE_EXCEL_COLUMNS: Array<{
  key: GuideExcelFilterKey;
  label: string;
  kind: ExcelFilterKind;
}> = [
  {
    key: "guide_number",
    label: "Guía remitente",
    kind: "text",
  },
  {
    key: "transport_name",
    label: "Transportista",
    kind: "text",
  },
  {
    key: "plate_1",
    label: "Placa Camión",
    kind: "text",
  },
  {
    key: "departure_date",
    label: "Salida",
    kind: "date",
  },
  {
    key: "tmh_departure",
    label: "TMH salida",
    kind: "number",
  },
  {
    key: "tmh_arrival",
    label: "TMH llegada",
    kind: "number",
  },
];

function guideExcelFilterKind(
  key: GuideExcelFilterKey
): ExcelFilterKind {
  if (key === "departure_date") {
    return "date";
  }

  if (
    key === "tmh_departure" ||
    key === "tmh_arrival"
  ) {
    return "number";
  }

  return "text";
}

function guideExcelValue(
  guide: Guide,
  key: GuideExcelFilterKey
) {
  if (key === "departure_date") {
    return text(
      guide.departure_date
    ).slice(0, 10);
  }

  return text(guide[key]);
}

const GROUPS: {
  title: string;
  tone: string;
  fields: Field[];
}[] = [
  {
    title: "Documentos",
    tone: "document",
    fields: [
      {
        key: "guide_date",
        label: "Fecha guía remitente",
        max: 10,
        kind: "date",
      },
      {
        key: "transport_guide_number",
        label: "Guía transportista",
        max: 15,
      },
      {
        key: "transport_guide_date",
        label: "Fecha guía transportista",
        max: 10,
        kind: "date",
      },
    ],
  },
  {
    title: "Transportista y vehículo",
    tone: "transport",
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
        key: "drive_license",
        label: "Licencia de conducir",
        max: 9,
      },
      {
        key: "driver_name",
        label: "Conductor",
        max: 255,
      },
      {
        key: "plate_1",
        label: "Placa Camión",
        max: 6,
      },
      {
        key: "plate_2",
        label: "Placa Carroza",
        max: 6,
      },
    ],
  },
  {
    title: "Remitente y origen",
    tone: "origin",
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
    tone: "destination",
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
    tone: "movement",
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

const REQUIRED_GUIDE_FIELDS = [
  ["transport_guide_number", "Guía transportista"],
  ["transport_ruc", "RUC transportista"],
  ["transport_name", "Razón social transportista"],
  ["drive_license", "Licencia de conducir"],
  ["driver_name", "Conductor"],
  ["plate_1", "Placa Camión"],
  ["plate_2", "Placa Carroza"],
  ["sender_ruc", "RUC remitente"],
  ["sender_name", "Razón social remitente"],
  ["origin_department", "Departamento de origen"],
  ["origin_province", "Provincia de origen"],
  ["origin_district", "Distrito de origen"],
  ["origin_address", "Dirección de origen"],
  ["recipient_ruc", "RUC destinatario"],
  ["recipient_name", "Razón social destinatario"],
  ["destination_department", "Departamento de destino"],
  ["destination_province", "Provincia de destino"],
  ["destination_district", "Distrito de destino"],
  ["destination_address", "Dirección de destino"],
] as const;

const GEO_AUTOCOMPLETE_FIELDS = [
  "origin_department",
  "origin_province",
  "origin_district",
  "destination_department",
  "destination_province",
  "destination_district",
] as const;

type GeoAutocompleteField =
  typeof GEO_AUTOCOMPLETE_FIELDS[number];

type PeruDepartment = {
  id: string;
  name: string;
};

type PeruProvince = {
  id: string;
  name: string;
  department_id: string;
};

type PeruDistrict = {
  id: string;
  name: string;
  province_id: string;
  department_id: string;
};

type GeoSuggestion = {
  department: string;
  province?: string;
  district?: string;
  source: "PERU" | "HIST";
};

const UBIGEO_PERU_URLS = {
  departments:
    "https://raw.githubusercontent.com/leandrofrancisco03/Ubigeo-Peru-2026/main/json/ubigeo_peru_2026_departamentos.json",
  provinces:
    "https://raw.githubusercontent.com/leandrofrancisco03/Ubigeo-Peru-2026/main/json/ubigeo_peru_2026_provincias.json",
  districts:
    "https://raw.githubusercontent.com/leandrofrancisco03/Ubigeo-Peru-2026/main/json/ubigeo_peru_2026_distritos.json",
};

const SCALE = BigInt(1000000);
const text = (value: unknown) => value == null ? "" : String(value);
const code = (value: string) => value.trim().toUpperCase();
const isCleanupLot = (value: string) =>
  /^(?:\d{2}-)?LIMPIEZA$/.test(code(value));

const DEFAULT_MVD_RUC = "20536126440";
const DEFAULT_MVD_NAME = "MINERA VETA DORADA S.A.C.";

function peruNowInputValue() {
  return new Date(Date.now() - 5 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);
}

function peruTodayInputValue() {
  return peruNowInputValue().slice(0, 10);
}

function dateOnlyKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return "";
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  return Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
    ? value
    : "";
}

function lotInputValue(value: string) {
  const safe = value
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9-]/g, "");

  const compact = safe.replace(/-/g, "");

  if (!compact.startsWith("TRJ")) {
    return safe.slice(0, 20);
  }

  const digits = compact
    .slice(3)
    .replace(/\D/g, "")
    .slice(0, 7);

  const year = digits.slice(0, 2);
  const number = digits.slice(2, 7);

  return (
    `TRJ${year ? `-${year}` : ""}` +
    `${number ? `-${number}` : ""}`
  );
}

function lotMatchesInput(lot: string, value: string) {
  const needle = code(value).replace(/[^A-Z0-9]/g, "");

  if (!needle) return true;

  const candidate = code(lot).replace(/[^A-Z0-9]/g, "");

  if (candidate.includes(needle)) return true;

  const match = code(lot).match(
    /^TRJ-(\d{2})-(\d{1,5})$/
  );

  if (!match) return false;

  const digits = value
    .replace(/\D/g, "")
    .replace(/^0+(?=\d)/, "");

  if (!digits) return false;

  const shortNumber = match[2].replace(/^0+(?=\d)/, "");

  return (
    shortNumber.includes(digits) ||
    `${match[1]}${shortNumber}`.includes(digits)
  );
}

function lotDisplayValue(row: Sgm) {
  return `${row.lot} · Saldo ${fmt(row.tmh_balance)} TMH`;
}

function guideDraftValue(value: string) {
  const compact = value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  let letters = "";
  let prefixDigits = "";
  let suffixDigits = "";

  for (const char of compact) {
    if (letters.length < 2) {
      if (/[A-Z]/.test(char)) letters += char;
      continue;
    }

    if (prefixDigits.length < 2) {
      if (/\d/.test(char)) prefixDigits += char;
      continue;
    }

    if (/\d/.test(char)) {
      suffixDigits += char;
    }
  }

  const prefix = `${letters}${prefixDigits}`;

  if (prefix.length < 4) {
    return prefix;
  }

  const suffix = suffixDigits
    .slice(0, 10)
    .replace(/^0+(?=\d)/, "");

  return suffix
    ? `${prefix}-${suffix}`
    : prefix;
}

function guideDisplayValue(value: string) {
  const draft = guideDraftValue(value);

  const match = draft.match(
    /^([A-Z]{2}\d{2})(?:-(\d{1,10}))?$/
  );

  if (!match) {
    return draft;
  }

  return match[2]
    ? `${match[1]}-${match[2].padStart(10, "0")}`
    : `${match[1]}-`;
}

function guideEditValue(
  value: string,
  previousValue: string
) {
  const previousDraft = guideDraftValue(previousValue);
  const previousDisplay = guideDisplayValue(previousDraft);

  const previousMatch = previousDraft.match(
    /^([A-Z]{2}\d{2})(?:-(\d{1,10}))?$/
  );

  if (
    previousMatch &&
    value.length === previousDisplay.length + 1 &&
    value.startsWith(previousDisplay)
  ) {
    const char = value.slice(-1);
    const suffix = previousMatch[2] || "";

    if (/\d/.test(char) && suffix.length < 10) {
      return `${previousMatch[1]}-${suffix}${char}`;
    }
  }

  if (
    previousMatch &&
    value.length === previousDisplay.length - 1 &&
    previousDisplay.startsWith(value)
  ) {
    const suffix = previousMatch[2] || "";

    if (suffix.length > 1) {
      return `${previousMatch[1]}-${suffix.slice(0, -1)}`;
    }

    if (suffix.length === 1) {
      return previousMatch[1];
    }

    return previousMatch[1].slice(0, -1);
  }

  return guideDraftValue(value);
}

function guideStorageValue(value: string) {
  const match = guideDraftValue(value).match(
    /^([A-Z]{2}\d{2})-(\d{1,10})$/
  );

  return match
    ? `${match[1]}-${match[2].padStart(10, "0")}`
    : "";
}

function driveLicenseDraftValue(value: string) {
  const compact = value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  let letter = "";
  let digits = "";

  for (const char of compact) {
    if (!letter) {
      if (/[A-Z]/.test(char)) letter = char;
      continue;
    }

    if (digits.length < 8 && /\d/.test(char)) {
      digits += char;
    }
  }

  return `${letter}${digits}`;
}

function driveLicenseDisplay(value: string) {
  const normalized = driveLicenseDraftValue(value);

  return normalized.length > 1
    ? `${normalized[0]}-${normalized.slice(1)}`
    : normalized;
}

const identity = (row: Lot) =>
  JSON.stringify([
    row.lot,
    row.lot_corr,
    row.guide_number,
  ]);

const decimalValid = (value: string, decimals = 3) =>
  new RegExp(
    `^(?:\\d{1,12}(?:\\.\\d{1,${decimals}})?|\\.\\d{1,${decimals}})$`
  ).test(value.trim());

const decimalPayload = (value: string) => {
  const trimmed = value.trim();

  return trimmed.startsWith(".")
    ? `0${trimmed}`
    : trimmed;
};

function tmhInputValue(value: unknown) {
  const raw = text(value).trim();

  if (!raw) return "";

  const number = Number(raw);

  return Number.isFinite(number)
    ? number.toFixed(3)
    : raw;
}

function fieldClass(field: Field) {
  if (field.kind === "datetime") return "trjg-field trjg-span-4";
  if (field.key === "transport_guide_number") return "trjg-field trjg-span-3";
  if (field.key.endsWith("_ruc")) return "trjg-field trjg-span-2";
  if (field.key.endsWith("_address")) return "trjg-field trjg-span-4";
  if (field.key.endsWith("_name") || field.key === "driver_name") {
    return "trjg-field trjg-span-3";
  }
  if (
    field.key.endsWith("_department") ||
    field.key.endsWith("_province") ||
    field.key.endsWith("_district")
  ) {
    return "trjg-field trjg-span-2";
  }
  return "trjg-field trjg-span-2";
}

function units(value: unknown): bigint | null {
  const raw = text(value).trim();

  if (!/^-?(?:\d+(?:\.\d{1,6})?|\.\d{1,6})$/.test(raw)) return null;

  const negative = raw.startsWith("-");
  const [whole, fraction = ""] = raw.replace(/^-/, "").split(".");

  const amount =
    BigInt(whole || "0") * SCALE +
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
    maximumFractionDigits: money ? 2 : 3,
  });
}

function fmtBags(value: unknown) {
  if (
    value == null ||
    value === "" ||
    !Number.isFinite(Number(value))
  ) {
    return "—";
  }

  return Number(value).toLocaleString("es-PE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  });
}

function hasVisibleTmhBalance(value: unknown) {
  const amount = units(value);

  if (
    amount == null ||
    amount <= BigInt(0)
  ) {
    return false;
  }

  return (
    (amount + BigInt(500)) /
      BigInt(1000)
  ) > BigInt(0);
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
  const values = Object.fromEntries([
    [
      "guide_number",
      guideDraftValue(guide?.guide_number || ""),
    ],
    ...FIELDS.map((field) => [
      field.key,
      field.kind === "datetime"
        ? text(guide?.[field.key]).slice(0, 16)
        : field.kind === "date"
          ? text(guide?.[field.key]).slice(0, 10)
          : field.key === "transport_guide_number"
            ? guideDraftValue(text(guide?.[field.key]))
            : field.key === "drive_license"
              ? driveLicenseDraftValue(text(guide?.[field.key]))
              : text(guide?.[field.key]),
    ]),
  ]) as Draft;

  if (!guide) {
    values.sender_ruc = DEFAULT_MVD_RUC;
    values.sender_name = DEFAULT_MVD_NAME;
    values.recipient_ruc = DEFAULT_MVD_RUC;
    values.recipient_name = DEFAULT_MVD_NAME;
  }

  return values;
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
        Ver guías ({new Set(matches.map((row) => row.guide_number)).size})
      </summary>

      <div className="trjg-history-box">
        <table>
          <thead>
            <tr>
              <th>Guía</th>
              <th>Corr.</th>
              <th>Salida</th>
              <th>Llegada</th>
              <th>Obs. cierre</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((row) => (
              <tr key={identity(row)}>
                <td>{row.guide_number}</td>
                <td>{row.lot_corr}</td>
                <td>{fmt(row.tmh_departure)}</td>
                <td>{fmt(row.tmh_arrival)}</td>
                <td>{row.balance_obs || "—"}</td>
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
  const [guideColumnFilters, setGuideColumnFilters] = useState<
    Partial<Record<GuideExcelFilterKey, ExcelColumnFilter>>
  >({});
  const [guideExcelSort, setGuideExcelSort] = useState<{
    key: GuideExcelFilterKey;
    direction: ExcelSortDirection;
  } | null>(null);
  const [newLot, setNewLot] = useState("");
  const [newDeparture, setNewDeparture] = useState("");
  const [newBagsTot, setNewBagsTot] = useState("");
  const [newBagsUsed, setNewBagsUsed] = useState("");
  const [closeLot, setCloseLot] = useState(false);
  const [balanceObs, setBalanceObs] = useState("");
  const [pendingCloseLot, setPendingCloseLot] = useState<string | null>(null);
  const [pendingCloseObs, setPendingCloseObs] = useState("");
  const [lotMenuOpen, setLotMenuOpen] = useState(false);

  const [editing, setEditing] = useState<{
    row: Lot;
    value: string;
  } | null>(null);

  const [candidates, setCandidates] = useState<
    Partial<Record<Role, Party[]>>
  >({});

  const [rucHistory, setRucHistory] = useState<
    Record<Role, RucHistory[]>
  >({
    transport: [],
    sender: [],
    recipient: [],
  });

  const [peruDepartments, setPeruDepartments] = useState<PeruDepartment[]>([]);
  const [peruProvinces, setPeruProvinces] = useState<PeruProvince[]>([]);
  const [peruDistricts, setPeruDistricts] = useState<PeruDistrict[]>([]);

  const [lookupBusy, setLookupBusy] = useState<Role | "driver" | null>(null);
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
      apiGet("/api/trjkar/ruc-history?role=transport"),
      apiGet("/api/trjkar/ruc-history?role=sender"),
      apiGet("/api/trjkar/ruc-history?role=recipient"),
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
    setRucHistory({
      transport: responses[3].rows as RucHistory[],
      sender: responses[4].rows as RucHistory[],
      recipient: responses[5].rows as RucHistory[],
    });

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

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      fetch(
        UBIGEO_PERU_URLS.departments,
        { cache: "force-cache" }
      ).then((response) => {
        if (!response.ok) {
          throw new Error("No se pudieron cargar los departamentos del Perú");
        }

        return response.json() as Promise<PeruDepartment[]>;
      }),
      fetch(
        UBIGEO_PERU_URLS.provinces,
        { cache: "force-cache" }
      ).then((response) => {
        if (!response.ok) {
          throw new Error("No se pudieron cargar las provincias del Perú");
        }

        return response.json() as Promise<PeruProvince[]>;
      }),
      fetch(
        UBIGEO_PERU_URLS.districts,
        { cache: "force-cache" }
      ).then((response) => {
        if (!response.ok) {
          throw new Error("No se pudieron cargar los distritos del Perú");
        }

        return response.json() as Promise<PeruDistrict[]>;
      }),
    ])
      .then(([
        departments,
        provinces,
        districts,
      ]) => {
        if (cancelled) return;

        setPeruDepartments(
          Array.isArray(departments)
            ? departments
            : []
        );

        setPeruProvinces(
          Array.isArray(provinces)
            ? provinces
            : []
        );

        setPeruDistricts(
          Array.isArray(districts)
            ? districts
            : []
        );
      })
      .catch((e) => {
        if (!cancelled) {
          console.error(
            "No se pudo cargar el catálogo UBIGEO Perú",
            e
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

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

  const closedLots = useMemo(
    () =>
      new Set(
        lots
          .filter(
            (row) =>
              row.lot_corr.trim().toUpperCase() === "PERD"
          )
          .map((row) => code(row.lot))
      ),
    [lots]
  );

  const perdByLot = useMemo(
    () =>
      new Map(
        lots
          .filter(
            (row) =>
              row.lot_corr.trim().toUpperCase() === "PERD"
          )
          .map((row) => [
            code(row.lot),
            row,
          ])
      ),
    [lots]
  );

  const rucHistoryByRuc = useMemo(
    () => ({
      transport: new Map(
        rucHistory.transport.map((row) => [row.ruc, row])
      ),
      sender: new Map(
        rucHistory.sender.map((row) => [row.ruc, row])
      ),
      recipient: new Map(
        rucHistory.recipient.map((row) => [row.ruc, row])
      ),
    }),
    [rucHistory]
  );

  const geoSuggestions = useMemo(() => {
    const normalizeGeo = (value: string) =>
      value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toUpperCase();

    const departmentById = new Map(
      peruDepartments.map((row) => [
        row.id,
        row.name.trim(),
      ])
    );

    const provinceById = new Map(
      peruProvinces.map((row) => [
        row.id,
        row,
      ])
    );

    const departmentMap =
      new Map<string, GeoSuggestion>();

    const provinceMap =
      new Map<string, GeoSuggestion>();

    const districtMap =
      new Map<string, GeoSuggestion>();

    const addDepartment = (
      department: string,
      source: GeoSuggestion["source"]
    ) => {
      const cleanDepartment =
        department.trim();

      if (!cleanDepartment) return;

      const key =
        normalizeGeo(cleanDepartment);

      if (!departmentMap.has(key)) {
        departmentMap.set(key, {
          department: cleanDepartment,
          source,
        });
      }
    };

    const addProvince = (
      department: string,
      province: string,
      source: GeoSuggestion["source"]
    ) => {
      const cleanDepartment =
        department.trim();

      const cleanProvince =
        province.trim();

      if (
        !cleanDepartment ||
        !cleanProvince
      ) {
        return;
      }

      const key = [
        normalizeGeo(cleanDepartment),
        normalizeGeo(cleanProvince),
      ].join("|");

      if (!provinceMap.has(key)) {
        provinceMap.set(key, {
          department: cleanDepartment,
          province: cleanProvince,
          source,
        });
      }
    };

    const addDistrict = (
      department: string,
      province: string,
      district: string,
      source: GeoSuggestion["source"]
    ) => {
      const cleanDepartment =
        department.trim();

      const cleanProvince =
        province.trim();

      const cleanDistrict =
        district.trim();

      if (
        !cleanDepartment ||
        !cleanProvince ||
        !cleanDistrict
      ) {
        return;
      }

      const key = [
        normalizeGeo(cleanDepartment),
        normalizeGeo(cleanProvince),
        normalizeGeo(cleanDistrict),
      ].join("|");

      if (!districtMap.has(key)) {
        districtMap.set(key, {
          department: cleanDepartment,
          province: cleanProvince,
          district: cleanDistrict,
          source,
        });
      }
    };

    for (const row of peruDepartments) {
      addDepartment(
        row.name,
        "PERU"
      );
    }

    for (const row of peruProvinces) {
      const department =
        departmentById.get(
          row.department_id
        );

      if (!department) continue;

      addProvince(
        department,
        row.name,
        "PERU"
      );
    }

    for (const row of peruDistricts) {
      const province =
        provinceById.get(
          row.province_id
        );

      const department =
        departmentById.get(
          row.department_id
        );

      if (
        !province ||
        !department
      ) {
        continue;
      }

      addDistrict(
        department,
        province.name,
        row.name,
        "PERU"
      );
    }

    for (const guide of guides) {
      const locations = [
        {
          department: text(
            guide.origin_department
          ),
          province: text(
            guide.origin_province
          ),
          district: text(
            guide.origin_district
          ),
        },
        {
          department: text(
            guide.destination_department
          ),
          province: text(
            guide.destination_province
          ),
          district: text(
            guide.destination_district
          ),
        },
      ];

      for (const location of locations) {
        addDepartment(
          location.department,
          "HIST"
        );

        addProvince(
          location.department,
          location.province,
          "HIST"
        );

        addDistrict(
          location.department,
          location.province,
          location.district,
          "HIST"
        );
      }
    }

    const departments =
      Array.from(
        departmentMap.values()
      ).sort((a, b) =>
        a.department.localeCompare(
          b.department,
          "es",
          {
            sensitivity: "base",
          }
        )
      );

    const provinces =
      Array.from(
        provinceMap.values()
      ).sort((a, b) =>
        (a.province || "").localeCompare(
          b.province || "",
          "es",
          {
            sensitivity: "base",
          }
        )
      );

    const districts =
      Array.from(
        districtMap.values()
      ).sort((a, b) =>
        (a.district || "").localeCompare(
          b.district || "",
          "es",
          {
            sensitivity: "base",
          }
        )
      );

    const filterProvinces = (
      department: string
    ) => {
      const selectedDepartment =
        normalizeGeo(department);

      if (!selectedDepartment) {
        return provinces;
      }

      return provinces.filter(
        (row) =>
          normalizeGeo(
            row.department
          ) === selectedDepartment
      );
    };

    const filterDistricts = (
      department: string,
      province: string
    ) => {
      const selectedDepartment =
        normalizeGeo(department);

      const selectedProvince =
        normalizeGeo(province);

      return districts.filter(
        (row) =>
          (
            !selectedDepartment ||
            normalizeGeo(
              row.department
            ) === selectedDepartment
          ) &&
          (
            !selectedProvince ||
            normalizeGeo(
              row.province || ""
            ) === selectedProvince
          )
      );
    };

    return {
      origin_department:
        departments,

      origin_province:
        filterProvinces(
          draft.origin_department
        ),

      origin_district:
        filterDistricts(
          draft.origin_department,
          draft.origin_province
        ),

      destination_department:
        departments,

      destination_province:
        filterProvinces(
          draft.destination_department
        ),

      destination_district:
        filterDistricts(
          draft.destination_department,
          draft.destination_province
        ),
    } satisfies Record<
      GeoAutocompleteField,
      GeoSuggestion[]
    >;
  }, [
    guides,
    peruDepartments,
    peruProvinces,
    peruDistricts,
    draft.origin_department,
    draft.origin_province,
    draft.destination_department,
    draft.destination_province,
  ]);

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
    !!newDeparture ||
    !!newBagsTot ||
    !!newBagsUsed ||
    closeLot ||
    !!balanceObs ||
    !!pendingCloseLot ||
    !!pendingCloseObs;

  const blockedLots =
    !active ||
    creating ||
    dirty ||
    loading ||
    saving ||
    !!pendingCloseLot;

  const pendingCloseBlocked =
    loading ||
    saving ||
    dirty ||
    !!editing ||
    !!newLot ||
    !!newDeparture ||
    !!newBagsTot ||
    !!newBagsUsed ||
    closeLot ||
    !!balanceObs;

  const selectedSgm = sgmByLot.get(code(newLot));

  const cleanupExists = guideLots.some(
    (row) => isCleanupLot(row.lot)
  );

  const nextCleanupCorr = useMemo(() => {
    const maxCorr = lots.reduce((max, row) => {
      if (
        !isCleanupLot(row.lot) ||
        !/^\d{4}$/.test(row.lot_corr)
      ) {
        return max;
      }

      return Math.max(
        max,
        Number(row.lot_corr)
      );
    }, 0);

    return maxCorr < 9999
      ? String(maxCorr + 1).padStart(4, "0")
      : null;
  }, [lots]);

  const availableLots = sgm.filter(
    (row) =>
      (units(row.tmh_balance) ?? BigInt(0)) > BigInt(0) &&
      lotMatchesInput(row.lot, newLot)
  );

  const usedPendingLots = sgm.filter(
    (row) =>
      (units(row.tmh_departure) ?? BigInt(0)) > BigInt(0) &&
      hasVisibleTmhBalance(row.tmh_balance) &&
      !closedLots.has(code(row.lot))
  );

  const maxDateTimePe = peruNowInputValue();
  const maxDateTimeKeyPe = dateKey(maxDateTimePe);
  const maxDatePe = peruTodayInputValue();

  const guideExcelValues = useMemo(
    () =>
      Object.fromEntries(
        GUIDE_EXCEL_COLUMNS.map((column) => [
          column.key,
          guides.map((guide) =>
            guideExcelValue(
              guide,
              column.key
            )
          ),
        ])
      ) as Record<
        GuideExcelFilterKey,
        string[]
      >,
    [guides]
  );

  const filtered = useMemo(() => {
    const needle = code(search);

    const searched = guides.filter(
      (guide) =>
        [
          guide.guide_number,
          guide.transport_name,
          guide.transport_ruc,
          guide.plate_1,
          guide.recipient_name,
        ].some((value) =>
          code(text(value)).includes(needle)
        )
    );

    const excelFiltered =
      searched.filter((guide) =>
        (
          Object.entries(
            guideColumnFilters
          ) as Array<
            [
              GuideExcelFilterKey,
              ExcelColumnFilter
            ]
          >
        ).every(([key, filter]) =>
          matchesExcelFilter(
            guideExcelValue(
              guide,
              key
            ),
            filter,
            guideExcelFilterKind(key)
          )
        )
      );

    if (!guideExcelSort) {
      return excelFiltered;
    }

    return [...excelFiltered].sort(
      (a, b) =>
        compareExcelValues(
          guideExcelValue(
            a,
            guideExcelSort.key
          ),
          guideExcelValue(
            b,
            guideExcelSort.key
          ),
          guideExcelFilterKind(
            guideExcelSort.key
          ),
          guideExcelSort.direction
        )
    );
  }, [
    guides,
    search,
    guideColumnFilters,
    guideExcelSort,
  ]);

  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const currentPage = Math.min(page, pages);

  const visible = filtered.slice(
    (currentPage - 1) * 20,
    currentPage * 20
  );

  let guideError = "";

  if (!guideStorageValue(draft.guide_number)) {
    guideError =
      "Número de guía remitente: usa XX##-##########";
  }

  if (
    creating &&
    guides.some(
      (guide) =>
        guideStorageValue(guide.guide_number) ===
        guideStorageValue(draft.guide_number)
    )
  ) {
    guideError = "La guía ya existe; ábrela desde el histórico";
  }

  const missingRequired = REQUIRED_GUIDE_FIELDS.find(
    ([key]) => !draft[key].trim()
  );

  if (!guideError && missingRequired) {
    guideError = `${missingRequired[1]} es obligatorio`;
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
      field.key === "transport_guide_number" &&
      value &&
      !guideStorageValue(value)
    ) {
      guideError = `${field.label}: usa XX##-##########`;
    }

    if (
      field.key === "drive_license" &&
      value &&
      !/^[A-Z]\d{8}$/.test(value)
    ) {
      guideError = `${field.label}: usa X-12345678`;
    }

    if (
      field.kind === "decimal" &&
      value &&
      !decimalValid(value, field.decimals ?? 3)
    ) {
      guideError =
        `${field.label}: número no negativo, hasta ${field.decimals ?? 3} decimales`;
    }

    if (field.kind === "datetime" && value) {
      const key = dateKey(value);

      if (!key) {
        guideError = `${field.label}: fecha u hora inválida`;
      } else if (key > maxDateTimeKeyPe) {
        guideError = `${field.label}: no puede ser futura (hora Perú)`;
      }
    }

    if (field.kind === "date" && value) {
      const key = dateOnlyKey(value);

      if (!key) {
        guideError = `${field.label}: fecha inválida`;
      } else if (key > maxDatePe) {
        guideError = `${field.label}: no puede ser futura (fecha Perú)`;
      }
    }
  }

  if (
    draft.load_ini &&
    draft.load_fin &&
    dateKey(draft.load_fin) < dateKey(draft.load_ini)
  ) {
    guideError = "Fin de carga no puede ser anterior al inicio";
  }

  if (
    draft.load_fin &&
    draft.departure_date &&
    dateKey(draft.departure_date) < dateKey(draft.load_fin)
  ) {
    guideError = "La salida no puede ser anterior al fin de carga";
  }

  function departureError(
    lot: string,
    value: string,
    old?: Lot
  ) {
    if (!lot) return "Selecciona un lote";

    if (!decimalValid(value)) {
      return "Ingresa TMH válidas, hasta 3 decimales";
    }

    const amount = units(value)!;

    if (!old && amount <= BigInt(0)) {
      return "La salida inicial debe ser mayor a cero";
    }

    if (isCleanupLot(lot)) {
      if (!old && cleanupExists) {
        return "Esta guía ya tiene LIMPIEZA";
      }

      if (!old && !draft.departure_date.trim()) {
        return "Registra primero la fecha de salida de la guía";
      }

      if (!old && !nextCleanupCorr) {
        return "Se agotaron los correlativos de LIMPIEZA";
      }

      return "";
    }

    if (!sgmByLot.has(code(lot))) {
      return "Selecciona un lote existente del histórico SGM";
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

    const editableBalance =
      balance +
      (units(old?.tmh_departure) ?? BigInt(0)) +
      (
        old
          ? (
              units(
                perdByLot.get(code(lot))
                  ?.tmh_departure
              ) ?? BigInt(0)
            )
          : BigInt(0)
      );

    return amount > editableBalance
      ? "Las TMH superan el saldo del lote"
      : "";
  }

  function bagsError(
    bagsTot: string,
    bagsUsed: string
  ) {
    if (
      bagsTot.trim() &&
      !decimalValid(bagsTot, 6)
    ) {
      return "Sacos Totales (Usados y rotos): número no negativo, hasta 6 decimales";
    }

    if (
      bagsUsed.trim() &&
      !decimalValid(bagsUsed, 6)
    ) {
      return "Sacos Enviados: número no negativo, hasta 6 decimales";
    }

    return "";
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
    setNewBagsTot("");
    setNewBagsUsed("");
    setCloseLot(false);
    setBalanceObs("");
    setPendingCloseLot(null);
    setPendingCloseObs("");
    setEditing(null);
    notify("");

    if (!guide) {
      void (async () => {
        await lookup("sender");
        await lookup("recipient");
      })();
    }
  }

  function applyGeoSuggestion(
    field: GeoAutocompleteField,
    suggestion: GeoSuggestion
  ) {
    const prefix =
      field.startsWith("origin_")
        ? "origin"
        : "destination";

    const next = {
      ...draftRef.current,
    };

    if (
      field.endsWith("_department")
    ) {
      const changed =
        next[
          `${prefix}_department`
        ] !== suggestion.department;

      next[
        `${prefix}_department`
      ] = suggestion.department;

      if (changed) {
        next[
          `${prefix}_province`
        ] = "";

        next[
          `${prefix}_district`
        ] = "";
      }
    }

    if (
      field.endsWith("_province") &&
      suggestion.province
    ) {
      next[
        `${prefix}_department`
      ] = suggestion.department;

      next[
        `${prefix}_province`
      ] = suggestion.province;

      next[
        `${prefix}_district`
      ] = "";
    }

    if (
      field.endsWith("_district") &&
      suggestion.province &&
      suggestion.district
    ) {
      next[
        `${prefix}_department`
      ] = suggestion.department;

      next[
        `${prefix}_province`
      ] = suggestion.province;

      next[
        `${prefix}_district`
      ] = suggestion.district;
    }

    writeDraft(next);
  }

  function resolveGeoField(
    field: GeoAutocompleteField
  ) {
    const currentValue =
      draftRef.current[field]
        .trim();

    if (!currentValue) return;

    const normalizeGeo = (
      value: string
    ) =>
      value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toUpperCase();

    const matches =
      geoSuggestions[field].filter(
        (suggestion) => {
          const target =
            field.endsWith(
              "_department"
            )
              ? suggestion.department
              : field.endsWith(
                    "_province"
                  )
                ? suggestion.province || ""
                : suggestion.district || "";

          return (
            normalizeGeo(target) ===
            normalizeGeo(
              currentValue
            )
          );
        }
      );

    if (matches.length === 1) {
      applyGeoSuggestion(
        field,
        matches[0]
      );
    }
  }

  function changeRuc(role: Role, value: string) {
    const selected = value.match(
      /^(\d{11})\s+-\s+.*$/
    );

    const ruc = selected
      ? selected[1]
      : value.replace(/\D/g, "").slice(0, 11);

    const fieldKey = `${role}_ruc`;

    const next = {
      ...draftRef.current,
      [fieldKey]: ruc,
    };

    if (ruc !== draftRef.current[fieldKey]) {
      Object.assign(next, partyValues(role));

      setCandidates((current) => ({
        ...current,
        [role]: [],
      }));
    }

    const historical =
      rucHistoryByRuc[role].get(ruc);

    if (historical?.name) {
      next[`${role}_name`] = historical.name;
    }

    writeDraft(next);

    if (ruc.length === 11) {
      void lookup(role);
    }
  }

  function change(field: Field, value: string) {
    const normalized =
      field.key === "transport_guide_number"
        ? guideDraftValue(value)
        : field.key === "drive_license"
          ? driveLicenseDraftValue(value)
          : field.key.startsWith("plate_")
            ? value.toUpperCase().slice(0, field.max)
            : value;

    const isGeoField =
      GEO_AUTOCOMPLETE_FIELDS.includes(
        field.key as GeoAutocompleteField
      );

    if (isGeoField) {
      const geoField =
        field.key as GeoAutocompleteField;

      const prefix =
        geoField.startsWith("origin_")
          ? "origin"
          : "destination";

      const parts = normalized
        .split(" — ")
        .map((part) => part.trim())
        .filter(Boolean);

      if (
        geoField.endsWith(
          "_province"
        ) &&
        parts.length >= 2
      ) {
        applyGeoSuggestion(
          geoField,
          {
            province: parts[0],
            department: parts[1],
            source: "PERU",
          }
        );

        return;
      }

      if (
        geoField.endsWith(
          "_district"
        ) &&
        parts.length >= 3
      ) {
        applyGeoSuggestion(
          geoField,
          {
            district: parts[0],
            province: parts[1],
            department: parts[2],
            source: "PERU",
          }
        );

        return;
      }

      const next = {
        ...draftRef.current,
        [geoField]: normalized,
      };

      if (
        geoField.endsWith(
          "_department"
        ) &&
        normalized !==
          draftRef.current[
            geoField
          ]
      ) {
        next[
          `${prefix}_province`
        ] = "";

        next[
          `${prefix}_district`
        ] = "";
      }

      if (
        geoField.endsWith(
          "_province"
        ) &&
        normalized !==
          draftRef.current[
            geoField
          ]
      ) {
        next[
          `${prefix}_district`
        ] = "";
      }

      writeDraft(next);

      return;
    }

    const next = {
      ...draftRef.current,
      [field.key]: normalized,
    };

    if (
      field.key === "drive_license" &&
      normalized !== draftRef.current[field.key]
    ) {
      next.driver_name = "";
    }

    if (
      field.role &&
      normalized !== draftRef.current[field.key]
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
      } else if (!rucHistoryByRuc[role].has(ruc)) {
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

  async function lookupDriver() {
    const driveLicense = draftRef.current.drive_license.trim();

    if (!/^[A-Z]\d{8}$/.test(driveLicense) || gate.current) return;

    const ticket = ++epoch.current;

    setLookupBusy("driver");

    try {
      const response = await apiGet(
        `/api/trjkar/driver-lookup?drive_license=${encodeURIComponent(driveLicense)}`
      );

      if (
        ticket !== epoch.current ||
        draftRef.current.drive_license.trim() !== driveLicense
      ) {
        return;
      }

      if (response?.ok === false) {
        throw new Error(response.error);
      }

      const driverName = text(response?.row?.driver_name).trim();

      if (driverName) {
        writeDraft({
          ...draftRef.current,
          driver_name: driverName,
        });
      } else {
        notify(
          "No hay un conductor histórico para esa licencia. Puedes ingresarlo manualmente"
        );
      }
    } catch (e) {
      if (ticket === epoch.current) {
        notify(
          e instanceof Error
            ? e.message
            : "No se pudo consultar la licencia",
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
        guide_number: guideStorageValue(draft.guide_number),
        create_only: creating,
      };

      for (
        const field of creating ? FIELDS : changedFields
      ) {
        const value = draft[field.key].trim();

        if (!creating || value) {
          body[field.key] =
            field.kind === "datetime" && value
              ? `${value.slice(0, 16)}:00.000`
              : field.kind === "decimal" && value
                ? decimalPayload(value)
                : field.key === "transport_guide_number" && value
                  ? guideStorageValue(value)
                  : field.key === "drive_license" && value
                    ? driveLicenseDraftValue(value)
                    : value || null;
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

    const error =
      departureError(lot, value, old) ||
      (
        old
          ? ""
          : bagsError(
              newBagsTot,
              newBagsUsed
            )
      ) ||
      (
        !old && closeLot && isCleanupLot(lot)
          ? "LIMPIEZA no puede usar Cerrar lote"
          : ""
      ) ||
      (
        !old && balanceObs.length > 255
          ? "El comentario de cierre admite máximo 255 caracteres"
          : ""
      );

    if (
      gate.current ||
      blockedLots ||
      error
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
          tmh_departure: decimalPayload(value),
          ...(
            !old && newBagsTot.trim()
              ? {
                  bags_tot:
                    decimalPayload(newBagsTot),
                }
              : {}
          ),
          ...(
            !old && newBagsUsed.trim()
              ? {
                  bags_used:
                    decimalPayload(newBagsUsed),
                }
              : {}
          ),
          ...(
            !old && closeLot
              ? {
                  close_lot: true,
                  ...(
                    balanceObs.trim()
                      ? {
                          balance_obs:
                            balanceObs.trim(),
                        }
                      : {}
                  ),
                }
              : {}
          ),
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
      setNewBagsTot("");
      setNewBagsUsed("");
      setCloseLot(false);
      setBalanceObs("");
      setEditing(null);

      const loss =
        response.saved?.[0]?.balance_loss;

      const perdDeleted =
        response.saved?.[0]?.perd_deleted === true ||
        response.saved?.[0]?.perd_deleted === 1;

      const perdAdjusted =
        response.saved?.[0]?.perd_adjusted === true ||
        response.saved?.[0]?.perd_adjusted === 1;

      notify(
        perdDeleted
          ? `Lote guardado · correlativo ${response.saved?.[0]?.lot_corr || ""} · PERD eliminado automáticamente`
          : perdAdjusted
            ? `Lote guardado · correlativo ${response.saved?.[0]?.lot_corr || ""} · PERD ajustado a ${fmt(loss)} TMH`
            : loss != null && Number(loss) > 0
              ? `Lote guardado · correlativo ${response.saved?.[0]?.lot_corr || ""} · PERD ${fmt(loss)} TMH`
              : `Lote guardado · correlativo ${response.saved?.[0]?.lot_corr || ""}`
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

  async function closePendingBalance(row: Sgm) {
    const lot = code(row.lot);
    const comment = pendingCloseObs.trim();
    const balance = units(row.tmh_balance);

    if (
      gate.current ||
      pendingCloseBlocked ||
      pendingCloseLot !== row.lot ||
      !lot ||
      !row.last_guide_number ||
      balance == null ||
      balance <= BigInt(0) ||
      !hasVisibleTmhBalance(row.tmh_balance) ||
      closedLots.has(lot) ||
      comment.length > 255
    ) {
      return;
    }

    if (
      !window.confirm(
        `¿Cerrar ${row.lot} con PERD ${fmt(row.tmh_balance)} TMH en la guía ${row.last_guide_number}?`
      )
    ) {
      return;
    }

    gate.current = true;
    setSaving(true);
    notify("");

    try {
      const response = await apiPost(
        "/api/trjkar/lots/close-balance",
        {
          lot,
          ...(comment
            ? { balance_obs: comment }
            : {}),
        }
      );

      if (!response?.ok) {
        throw new Error(
          response?.error || "No se pudo cerrar el lote"
        );
      }

      setPendingCloseLot(null);
      setPendingCloseObs("");

      try {
        await load();

        notify(
          `Lote ${response.lot} cerrado · PERD ${fmt(response.balance_loss)} TMH · guía ${response.guide_number}`
        );
      } catch {
        notify(
          `Lote ${response.lot} cerrado en la guía ${response.guide_number}. No se pudo refrescar la pantalla; actualiza para ver el saldo`,
          true
        );
      }
    } catch (e) {
      notify(
        e instanceof Error
          ? e.message
          : "No se pudo cerrar el lote",
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

  async function deletePerd(row: Lot) {
    if (
      gate.current ||
      blockedLots ||
      !!editing ||
      !!newLot
    ) {
      return;
    }

    const confirmation = window.prompt(
      `Para eliminar el PERD de ${row.lot}, escribe "eliminar"`
    );

    if (confirmation == null) {
      return;
    }

    if (
      confirmation.trim().toLowerCase() !== "eliminar"
    ) {
      notify(
        'Debes escribir "eliminar" para confirmar',
        true
      );
      return;
    }

    gate.current = true;
    setSaving(true);
    notify("");

    try {
      const response = await apiPost(
        "/api/trjkar/lots/delete-perd",
        {
          lot: row.lot,
          guide_number: row.guide_number,
          confirmation:
            confirmation.trim(),
        }
      );

      if (!response?.ok) {
        throw new Error(
          response?.error ||
            "No se pudo eliminar PERD"
        );
      }

      try {
        await load();

        notify(
          `PERD eliminado de ${response.lot} · saldo reabierto ${fmt(response.tmh_reopened)} TMH`
        );
      } catch {
        notify(
          `PERD eliminado de ${response.lot}. Actualiza para ver el nuevo saldo`,
          true
        );
      }
    } catch (e) {
      notify(
        e instanceof Error
          ? e.message
          : "No se pudo eliminar PERD",
        true
      );
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
      setNewBagsTot("");
      setNewBagsUsed("");
      setCloseLot(false);
      setBalanceObs("");
      setPendingCloseLot(null);
      setPendingCloseObs("");
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

  const newLotError =
    departureError(newLot, newDeparture) ||
    bagsError(
      newBagsTot,
      newBagsUsed
    ) ||
    (
      closeLot && isCleanupLot(newLot)
        ? "LIMPIEZA no puede usar Cerrar lote"
        : ""
    ) ||
    (
      balanceObs.length > 255
        ? "El comentario de cierre admite máximo 255 caracteres"
        : ""
    );

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
        .trjk-guides{height:100%;max-height:calc(100dvh - 68px);overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-gutter:stable;display:grid;align-content:start;gap:10px;min-width:0;min-height:0;padding:0 6px 56px 0}
        .trjk-guides *{box-sizing:border-box}
        .trjk-guides .trjg-page-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:2px 2px 0}
        .trjk-guides .trjg-title{margin:0;font-size:18px;line-height:1.15}
        .trjk-guides .trjg-subtitle{font-size:11px;opacity:.78;margin-top:3px}
        .trjk-guides .trjg-actions{display:flex;gap:7px;align-items:center;flex-wrap:wrap}
        .trjk-guides .trjg-card{min-width:0;border:1px solid rgba(147,211,230,.26);border-radius:10px;background:linear-gradient(180deg,rgba(7,71,101,.80),rgba(5,61,87,.72));box-shadow:0 6px 18px rgba(0,0,0,.08)}
        .trjk-guides .trjg-list-card{padding:10px 12px}
        .trjk-guides .trjg-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;min-width:0}
        .trjk-guides .trjg-search{width:min(420px,100%);height:32px;padding:5px 9px;font-size:12px}
        .trjk-guides .trjg-count{display:inline-flex;align-items:center;gap:6px;padding:4px 9px;border-radius:999px;background:rgba(147,211,230,.10);font-size:11px}
        .trjk-guides .trjg-table-scroll{overflow-x:auto;overflow-y:visible;max-width:100%;margin-top:8px;border-radius:6px;border:1px solid rgba(147,211,230,.13)}
        .trjk-guides table{border-collapse:collapse;width:max-content;min-width:100%;font-size:11px}
        .trjk-guides th{background:#143444;text-align:left;color:#fff;font-weight:600}
        .trjk-guides td,.trjk-guides th{padding:7px 9px;border-bottom:1px solid rgba(147,211,230,.13);white-space:nowrap;vertical-align:middle}
        .trjk-guides tbody tr:hover{background:rgba(147,211,230,.06)}
        .trjk-guides tr[data-active=true]{background:rgba(117,151,41,.24)}
        .trjk-guides .trjg-pagination{margin-top:8px;font-size:11px}
        .trjk-guides .trjg-editor{padding:11px 12px 14px;background:linear-gradient(180deg,rgba(5,56,82,.92),rgba(4,48,70,.82));border-color:rgba(151,205,58,.40)}
        .trjk-guides .trjg-editor-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:9px}
        .trjk-guides .trjg-editor-title{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
        .trjk-guides .trjg-editor-title h3{margin:0;font-size:14px}
        .trjk-guides .trjg-status{display:inline-flex;align-items:center;padding:3px 8px;border-radius:999px;font-size:10px;font-weight:600;background:rgba(151,205,58,.13);border:1px solid rgba(151,205,58,.32)}
        .trjk-guides .trjg-guide-row{display:grid;grid-template-columns:minmax(180px,280px) 1fr;gap:10px;align-items:end;margin-bottom:9px}
        .trjk-guides .trjg-group{min-width:0;margin-top:8px;padding:9px 10px 10px;border:1px solid rgba(147,211,230,.18);border-radius:6px;background:rgba(2,35,52,.18)}
        .trjk-guides .trjg-group[data-tone=document]{border-left:3px solid rgba(147,211,230,.70)}
        .trjk-guides .trjg-group[data-tone=transport]{border-left:3px solid rgba(151,205,58,.78);background:rgba(65,91,21,.10)}
        .trjk-guides .trjg-group[data-tone=origin]{border-left:3px solid rgba(240,178,72,.70);background:rgba(103,67,13,.08)}
        .trjk-guides .trjg-group[data-tone=destination]{border-left:3px solid rgba(77,177,205,.78);background:rgba(19,87,106,.10)}
        .trjk-guides .trjg-group[data-tone=movement]{border-left:3px solid rgba(191,145,217,.72);background:rgba(75,41,94,.08)}
        .trjk-guides .trjg-group-title{display:flex;align-items:center;gap:8px;margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.01em}
        .trjk-guides .trjg-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:8px 9px;min-width:0}
        .trjk-guides .trjg-field{display:grid;gap:4px;min-width:0;font-size:11px;font-weight:600}
        .trjk-guides .trjg-span-2{grid-column:span 2}
        .trjk-guides .trjg-span-3{grid-column:span 3}
        .trjk-guides .trjg-span-4{grid-column:span 4}
        .trjk-guides .input{width:100%;min-width:0;height:30px;padding:4px 8px;font-size:11px;line-height:1.2;border-radius:6px}
        .trjk-guides input[list],.trjk-guides select.input{background:#0d222e;color:#fff;border:1px solid rgba(147,211,230,.35)}
        .trjk-guides select.input{padding-right:24px}
        .trjk-guides select.input option{background:#0d222e;color:#fff}
        .trjk-guides input[readonly]{opacity:.82;background:rgba(255,255,255,.035)}
        .trjk-guides fieldset{border:0;padding:0;margin:0;min-width:0}
        .trjk-guides .trjg-input-action{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:5px;align-items:center}
        .trjk-guides .trjg-input-action button{height:30px;white-space:nowrap}
        .trjk-guides .trjg-history-select{margin-top:1px}
        .trjk-guides .trjg-kpis{display:flex;gap:7px;flex-wrap:wrap;margin:9px 0 0}
        .trjk-guides .trjg-kpi{display:flex;align-items:baseline;gap:5px;padding:5px 9px;border-radius:6px;background:rgba(147,211,230,.07);border:1px solid rgba(147,211,230,.15);font-size:10px}
        .trjk-guides .trjg-kpi strong{font-size:12px}
        .trjk-guides .trjg-message{padding:7px 9px;border:1px solid rgba(147,211,230,.35);border-radius:6px;background:rgba(11,77,107,.45);font-size:11px}
        .trjk-guides .trjg-error{color:#ebb086;border-color:#d85d27}
        .trjk-guides .trjg-lots-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(270px,320px);gap:10px;align-items:start;margin-top:10px}
        .trjk-guides .trjg-lots{min-width:0;padding:10px;border:1px solid rgba(151,205,58,.35);border-radius:6px;background:linear-gradient(180deg,rgba(62,84,24,.15),rgba(2,35,52,.20))}
        .trjk-guides .trjg-used-lots{min-width:0;padding:10px;border:1px solid rgba(147,211,230,.26);border-left:3px solid rgba(240,178,72,.70);border-radius:6px;background:rgba(103,67,13,.08)}
        .trjk-guides .trjg-used-list{display:grid;gap:6px;max-height:390px;overflow:auto}
        .trjk-guides .trjg-used-row{display:grid;grid-template-columns:1fr;gap:7px;padding:7px 8px;border:1px solid rgba(147,211,230,.13);border-radius:6px;background:rgba(2,35,52,.23)}
        .trjk-guides .trjg-used-main{display:grid;gap:3px;min-width:0}
        .trjk-guides .trjg-used-actions{display:flex;align-items:flex-start;justify-content:flex-start;gap:6px;flex-wrap:wrap}
        .trjk-guides .trjg-pending-close{display:grid;gap:6px;margin-top:2px;padding-top:7px;border-top:1px solid rgba(147,211,230,.13)}
        .trjk-guides .trjg-pending-close-actions{display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap}
        .trjk-guides .trjg-used-row strong{font-size:11px}
        .trjk-guides .trjg-used-row span{font-size:9px;opacity:.78}
        .trjk-guides .trjg-lot-picker{position:relative}
        .trjk-guides .trjg-lot-menu{position:absolute;left:0;right:0;top:100%;z-index:30;display:grid;max-height:280px;overflow:auto;margin-top:3px;padding:4px;border:1px solid rgba(147,211,230,.35);border-radius:6px;background:#0d222e;box-shadow:0 10px 24px rgba(0,0,0,.28)}
        .trjk-guides .trjg-lot-option{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;padding:7px 8px;border:0;border-radius:4px;background:transparent;color:#fff;text-align:left;font:inherit;cursor:pointer}
        .trjk-guides .trjg-lot-option:hover{background:rgba(147,211,230,.09)}
        .trjk-guides .trjg-lot-option strong{font-size:11px;font-weight:600}
        .trjk-guides .trjg-lot-option span{font-size:10px;opacity:.78}
        .trjk-guides .trjg-lot-empty{padding:8px;font-size:10px;opacity:.72}
        .trjk-guides .trjg-lots-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:8px}
        .trjk-guides .trjg-lots-title{margin:0;font-size:13px}
        .trjk-guides .trjg-lot-add{display:grid;grid-template-columns:1.7fr .75fr .95fr .75fr .65fr auto;gap:8px;align-items:end}
        .trjk-guides .trjg-lot-actions{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:8px}
        .trjk-guides .trjg-balance{display:inline-flex;align-items:center;padding:4px 8px;border-radius:999px;background:rgba(147,211,230,.08);font-size:10px}
        .trjk-guides .trjg-note{font-size:10px;opacity:.82}
        .trjk-guides .trjg-history summary{cursor:pointer;color:#a8c0cf;font-size:10px}
        .trjk-guides .trjg-history-box{overflow:auto;max-height:160px;margin-top:5px;border:1px solid rgba(147,211,230,.18);border-radius:6px;background:#0d222e}
        .trjk-guides .trjg-history-box table{font-size:10px}
        .trjk-guides .trjg-history-box td,.trjk-guides .trjg-history-box th{padding:5px 7px}
        .trjk-guides .trjg-perd-row td:not(:last-child){opacity:.52}
        .trjk-guides button:disabled{opacity:.45;cursor:not-allowed}
        @media (max-width:1280px){
          .trjk-guides .trjg-grid{grid-template-columns:repeat(6,minmax(0,1fr))}
          .trjk-guides .trjg-span-4,.trjk-guides .trjg-span-3{grid-column:span 3}
          .trjk-guides .trjg-span-2{grid-column:span 2}
          .trjk-guides .trjg-lot-add{grid-template-columns:repeat(5,minmax(0,1fr))}
          .trjk-guides .trjg-lot-add>div:last-child{grid-column:span 5;justify-self:end}
        }
        @media (max-width:1000px){
          .trjk-guides .trjg-lots-layout{grid-template-columns:1fr}
        }
        @media (max-width:760px){
          .trjk-guides{max-height:calc(100dvh - 56px);padding-right:3px}
          .trjk-guides .trjg-page-head{align-items:flex-start}
          .trjk-guides .trjg-actions{width:100%}
          .trjk-guides .trjg-actions button{flex:1}
          .trjk-guides .trjg-guide-row{grid-template-columns:1fr}
          .trjk-guides .trjg-grid{grid-template-columns:1fr}
          .trjk-guides .trjg-field,.trjk-guides .trjg-span-2,.trjk-guides .trjg-span-3,.trjk-guides .trjg-span-4{grid-column:1/-1}
          .trjk-guides .trjg-lot-add{grid-template-columns:1fr 1fr}
          .trjk-guides .trjg-lot-add>div:last-child{grid-column:1/-1;justify-self:stretch}
          .trjk-guides .trjg-lot-add>div:last-child button{width:100%}
        }
      `}</style>

      <div className="trjg-page-head">
        <div>
          <h2 className="trjg-title">Kardex de transporte · Guías</h2>
          <div className="trjg-subtitle">
            Registro de guías remitentes y salidas por lote
          </div>
        </div>

        <div className="trjg-actions">
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

      <section className="trjg-card trjg-list-card">
        <div className="trjg-bar">
          <input
            className="input trjg-search"
            aria-label="Buscar guías"
            placeholder="Buscar guía, transportista, RUC o placa"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />

          <span className="trjg-count">
            {filtered.length} guía(s)
          </span>
        </div>

        <div className="trjg-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Detalle</th>

                {GUIDE_EXCEL_COLUMNS.map(
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
                            guideExcelValues[
                              column.key
                            ] || []
                          }
                          filter={
                            guideColumnFilters[
                              column.key
                            ]
                          }
                          sortDirection={
                            guideExcelSort?.key ===
                            column.key
                              ? guideExcelSort.direction
                              : undefined
                          }
                          onApply={(filter) => {
                            setGuideColumnFilters(
                              (current) => ({
                                ...current,
                                [column.key]:
                                  filter,
                              })
                            );
                            setPage(1);
                          }}
                          onSort={(direction) => {
                            setGuideExcelSort({
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

        <div className="trjg-bar trjg-pagination">
          <span>
            Página {currentPage} de {pages}
          </span>

          <div className="trjg-actions">
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
        <section className="trjg-card trjg-editor">
          <div className="trjg-editor-head">
            <div className="trjg-editor-title">
              <h3>
                {creating ? "Nueva guía remitente" : `Guía ${active}`}
              </h3>
              <span className="trjg-status">
                {creating ? "NUEVA" : "REGISTRADA"}
              </span>
            </div>

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
            <div className="trjg-guide-row">
              <label className="trjg-field">
                Número de guía remitente
                <input
                  className="input"
                  value={guideDisplayValue(draft.guide_number)}
                  maxLength={16}
                  readOnly={!creating}
                  onChange={(e) =>
                    writeDraft({
                      ...draftRef.current,
                      guide_number: guideEditValue(
                        e.target.value,
                        draftRef.current.guide_number
                      ),
                    })
                  }
                />
              </label>

              <div className="trjg-kpis">
                <span className="trjg-kpi">
                  TMH salida <strong>{fmt(activeGuide?.tmh_departure)}</strong>
                </span>
                <span className="trjg-kpi">
                  TMH llegada <strong>{fmt(activeGuide?.tmh_arrival)}</strong>
                </span>
                <span className="trjg-kpi">
                  Lotes <strong>{guideLots.length}</strong>
                </span>
              </div>
            </div>

            {GROUPS.map((group) => (
              <div
                className="trjg-group"
                data-tone={group.tone}
                key={group.title}
              >
                <div className="trjg-group-title">
                  {group.title}
                </div>

                <div className="trjg-grid">
                  {group.fields.map((field) => (
                    <label className={fieldClass(field)} key={field.key}>
                      {field.label}

                      {field.role ? (
                        <>
                          <div className="trjg-input-action">
                            <input
                              className="input"
                              inputMode="numeric"
                              list={`trjkar-${field.role}-ruc-options`}
                              autoComplete="off"
                              maxLength={280}
                              value={draft[field.key]}
                              onChange={(e) =>
                                changeRuc(
                                  field.role!,
                                  e.target.value
                                )
                              }
                              onBlur={() => void lookup(field.role!)}
                            />

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
                                : "Buscar"}
                            </Button>
                          </div>

                          {!!candidates[field.role]?.length && (
                            <select
                              className="input trjg-history-select"
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
                                Aplicar referencia histórica
                              </option>

                              {candidates[field.role]!.map(
                                (party, index) => (
                                  <option
                                    value={index}
                                    key={index}
                                  >
                                    {party.name} · {party.address || party.source}
                                    {party.guide_number
                                      ? ` · ${party.guide_number}`
                                      : ""}
                                  </option>
                                )
                              )}
                            </select>
                          )}
                        </>
                      ) : field.key === "drive_license" ? (
                        <div className="trjg-input-action">
                          <input
                            className="input"
                            type="text"
                            maxLength={10}
                            value={driveLicenseDisplay(draft[field.key])}
                            onChange={(e) => change(field, e.target.value)}
                            onBlur={() => void lookupDriver()}
                          />

                          <Button
                            size="sm"
                            onClick={() => void lookupDriver()}
                            disabled={
                              !!lookupBusy ||
                              !/^[A-Z]\d{8}$/.test(
                                draft.drive_license.trim()
                              )
                            }
                          >
                            {lookupBusy === "driver"
                              ? "Buscando..."
                              : "Buscar"}
                          </Button>
                        </div>
                      ) : (
                        <input
                          className="input"
                          type={
                            field.kind === "datetime"
                              ? "datetime-local"
                              : field.kind === "date"
                                ? "date"
                                : "text"
                          }
                          step={
                            field.kind === "datetime"
                              ? "60"
                              : undefined
                          }
                          min={
                            field.key === "load_fin" && draft.load_ini
                              ? draft.load_ini
                              : field.key === "departure_date" && draft.load_fin
                                ? draft.load_fin
                                : undefined
                          }
                          max={
                            field.kind === "datetime"
                              ? maxDateTimePe
                              : field.kind === "date"
                                ? maxDatePe
                                : undefined
                          }
                          inputMode={
                            field.kind === "decimal"
                              ? "decimal"
                              : "text"
                          }
                          list={
                            GEO_AUTOCOMPLETE_FIELDS.includes(
                              field.key as GeoAutocompleteField
                            )
                              ? `trjkar-${field.key}-options`
                              : undefined
                          }
                          maxLength={
                            field.key === "transport_guide_number"
                              ? 16
                              : field.max
                          }
                          value={
                            field.key === "transport_guide_number"
                              ? guideDisplayValue(draft[field.key])
                              : draft[field.key]
                          }
                          onChange={(e) =>
                            field.key === "transport_guide_number"
                              ? change(
                                  field,
                                  guideEditValue(
                                    e.target.value,
                                    draftRef.current[field.key]
                                  )
                                )
                              : change(field, e.target.value)
                          }
                          onBlur={
                            GEO_AUTOCOMPLETE_FIELDS.includes(
                              field.key as GeoAutocompleteField
                            )
                              ? () =>
                                  resolveGeoField(
                                    field.key as GeoAutocompleteField
                                  )
                              : undefined
                          }
                        />
                      )}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </fieldset>

          {GEO_AUTOCOMPLETE_FIELDS.map((field) => (
            <datalist
              key={field}
              id={`trjkar-${field}-options`}
            >
              {geoSuggestions[field].map((suggestion) => {
                const value =
                  field.endsWith("_department")
                    ? suggestion.department
                    : field.endsWith("_province")
                      ? `${suggestion.province} — ${suggestion.department}`
                      : `${suggestion.district} — ${suggestion.province} — ${suggestion.department}`;

                const key = [
                  field,
                  suggestion.department,
                  suggestion.province || "",
                  suggestion.district || "",
                ].join("|");

                return (
                  <option
                    key={key}
                    value={value}
                  />
                );
              })}
            </datalist>
          ))}

          {(["transport", "sender", "recipient"] as Role[]).map(
            (role) => (
              <datalist
                key={role}
                id={`trjkar-${role}-ruc-options`}
              >
                {rucHistory[role].map((row) => (
                  <option
                    key={row.ruc}
                    value={`${row.ruc} - ${row.name || ""}`}
                  />
                ))}
              </datalist>
            )
          )}

          {guideError && (
            <div className="trjg-message trjg-error" style={{ marginTop: 9 }}>
              {guideError}
            </div>
          )}

          <div className="trjg-lots-layout">
            <div className="trjg-lots">
              <div className="trjg-lots-head">
              <div>
                <h3 className="trjg-lots-title">Lotes de la guía</h3>
                <div className="trjg-note">
                  El correlativo se asigna automáticamente al guardar.
                </div>
              </div>

              {!creating && (
                <span className="trjg-count">
                  {guideLots.length} lote(s)
                </span>
              )}
            </div>

            {creating ? (
              <div className="trjg-message">
                Primero crea la guía. Apenas se guarde se habilitará aquí el registro de lotes.
              </div>
            ) : (
              <>
                {dirty && (
                  <div className="trjg-message" style={{ marginBottom: 8 }}>
                    Guarda los cambios de la guía antes de modificar sus lotes.
                  </div>
                )}

                <fieldset disabled={blockedLots || !!editing}>
                  <div className="trjg-lot-add">
                    <label className="trjg-field trjg-lot-picker">
                      Lote SGM
                      <input
                        className="input"
                        value={
                          selectedSgm && !lotMenuOpen
                            ? lotDisplayValue(selectedSgm)
                            : newLot
                        }
                        placeholder="Seleccionar lote"
                        autoComplete="off"
                        onFocus={(e) => {
                          setLotMenuOpen(true);
                          e.currentTarget.select();
                        }}
                        onClick={(e) => {
                          setLotMenuOpen(true);
                          e.currentTarget.select();
                        }}
                        onChange={(e) => {
                          setLotMenuOpen(true);
                          setNewLot(lotInputValue(e.target.value));
                          setNewDeparture("");
                          setNewBagsTot("");
                          setNewBagsUsed("");
                          setCloseLot(false);
                          setBalanceObs("");
                        }}
                        onBlur={() => {
                          setLotMenuOpen(false);

                          const lot = code(newLot);

                          if (
                            !isCleanupLot(lot) &&
                            lot &&
                            !sgmByLot.has(lot)
                          ) {
                            setNewLot("");
                            setCloseLot(false);
                            setBalanceObs("");
                          }
                        }}
                      />

                      {lotMenuOpen && !isCleanupLot(newLot) && (
                        <div className="trjg-lot-menu">
                          {availableLots.slice(0, 100).map((row) => (
                            <button
                              key={row.lot}
                              type="button"
                              className="trjg-lot-option"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setNewLot(row.lot);
                                setNewDeparture("");
                                setNewBagsTot("");
                                setNewBagsUsed("");
                                setCloseLot(false);
                                setBalanceObs("");
                                setLotMenuOpen(false);
                              }}
                            >
                              <strong>{row.lot}</strong>
                              <span>
                                Saldo {fmt(row.tmh_balance)} TMH
                              </span>
                            </button>
                          ))}

                          {!availableLots.length && (
                            <div className="trjg-lot-empty">
                              No hay lotes con saldo para esta búsqueda.
                            </div>
                          )}
                        </div>
                      )}
                    </label>

                    <label className="trjg-field">
                      TMH salida
                      <input
                        className="input"
                        inputMode="decimal"
                        maxLength={16}
                        value={newDeparture}
                        onChange={(e) => {
                          const value = e.target.value;

                          if (
                            /^(?:\d{0,12}(?:\.\d{0,3})?|\.\d{0,3})$/.test(
                              value
                            )
                          ) {
                            setNewDeparture(value);
                          }
                        }}
                      />
                    </label>

                    <label className="trjg-field">
                      Sacos Totales (Usados y rotos)
                      <input
                        className="input"
                        inputMode="decimal"
                        maxLength={19}
                        value={newBagsTot}
                        onChange={(e) => {
                          const value = e.target.value;

                          if (
                            /^(?:\d{0,12}(?:\.\d{0,6})?|\.\d{0,6})$/.test(
                              value
                            )
                          ) {
                            setNewBagsTot(value);
                          }
                        }}
                      />
                    </label>

                    <label className="trjg-field">
                      Sacos Enviados
                      <input
                        className="input"
                        inputMode="decimal"
                        maxLength={19}
                        value={newBagsUsed}
                        onChange={(e) => {
                          const value = e.target.value;

                          if (
                            /^(?:\d{0,12}(?:\.\d{0,6})?|\.\d{0,6})$/.test(
                              value
                            )
                          ) {
                            setNewBagsUsed(value);
                          }
                        }}
                      />
                    </label>

                    <label className="trjg-field">
                      Corr.
                      <input
                        className="input"
                        readOnly
                        value={
                          isCleanupLot(newLot)
                            ? nextCleanupCorr || "—"
                            : selectedSgm?.next_corr || "—"
                        }
                      />
                    </label>

                    <div>
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
                  </div>

                  <div className="trjg-lot-actions">
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
                        setNewBagsTot("");
                        setNewBagsUsed("");
                        setCloseLot(false);
                        setBalanceObs("");
                      }}
                    >
                      Agregar LIMPIEZA
                    </Button>

                    <Button
                      size="sm"
                      disabled={
                        blockedLots ||
                        !!editing ||
                        !newLot ||
                        !selectedSgm ||
                        isCleanupLot(newLot)
                      }
                      onClick={() => {
                        setCloseLot((current) => {
                          const next = !current;

                          if (!next) {
                            setBalanceObs("");
                          }

                          return next;
                        });
                      }}
                    >
                      {closeLot
                        ? "Cerrar lote ✓"
                        : "Cerrar lote"}
                    </Button>

                    {closeLot && !isCleanupLot(newLot) && (
                      <label
                        className="trjg-field"
                        style={{ minWidth: 280 }}
                      >
                        Comentario cierre (opcional)
                        <input
                          className="input"
                          maxLength={255}
                          value={balanceObs}
                          onChange={(e) =>
                            setBalanceObs(e.target.value)
                          }
                        />
                      </label>
                    )}

                    <span className="trjg-balance">
                      {isCleanupLot(newLot)
                        ? "LIMPIEZA no usa saldo SGM · correlativo único · máximo una por guía"
                        : `Saldo disponible: ${fmt(selectedSgm?.tmh_balance)} TMH`}
                    </span>

                    {(newDeparture ||
                      newBagsTot ||
                      newBagsUsed ||
                      closeLot ||
                      balanceObs) &&
                      newLotError && (
                        <span className="trjg-error">
                          {newLotError}
                        </span>
                      )}
                  </div>
                </fieldset>

                {newLot && !isCleanupLot(newLot) && (
                  <div style={{ marginTop: 7 }}>
                    <LotHistory lot={newLot} rows={lots} />
                  </div>
                )}

                <div className="trjg-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Lote</th>
                        <th>Corr.</th>
                        <th>TMH salida</th>
                        <th>Sacos Totales (Usados y rotos)</th>
                        <th>Sacos Enviados</th>
                        <th>TMH llegada</th>
                        <th>Saldo total lote</th>
                        <th>Obs. cierre</th>
                        <th>Otras guías</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>

                    <tbody>
                      {guideLots.map((row) => {
                        const isEditing =
                          editing &&
                          identity(editing.row) === identity(row);

                        const lotClosed =
                          closedLots.has(code(row.lot));

                        return (
                          <tr
                            key={identity(row)}
                            className={
                              row.lot_corr
                                .trim()
                                .toUpperCase() === "PERD"
                                ? "trjg-perd-row"
                                : undefined
                            }
                          >
                            <td>
                              <strong>{row.lot}</strong>
                            </td>

                            <td>{row.lot_corr}</td>

                            <td>
                              {isEditing ? (
                                <input
                                  aria-label={`Salida ${row.lot} ${row.lot_corr}`}
                                  className="input"
                                  style={{ width: 118 }}
                                  inputMode="decimal"
                                  maxLength={16}
                                  value={editing.value}
                                  disabled={saving}
                                  onChange={(e) => {
                                    const value = e.target.value;

                                    if (
                                      /^(?:\d{0,12}(?:\.\d{0,3})?|\.\d{0,3})$/.test(
                                        value
                                      )
                                    ) {
                                      setEditing({
                                        row,
                                        value,
                                      });
                                    }
                                  }}
                                />
                              ) : (
                                fmt(row.tmh_departure)
                              )}
                            </td>

                            <td>{fmtBags(row.bags_tot)}</td>

                            <td>{fmtBags(row.bags_used)}</td>

                            <td>{fmt(row.tmh_arrival)}</td>

                            <td>
                              {isCleanupLot(row.lot)
                                ? "No aplica"
                                : fmt(
                                    sgmByLot.get(code(row.lot))
                                      ?.tmh_balance ??
                                    row.tmh_balance
                                  )}
                            </td>

                            <td>
                              {row.balance_obs || "—"}
                            </td>

                            <td>
                              {!isCleanupLot(row.lot) && (
                                <LotHistory
                                  lot={row.lot}
                                  rows={lots}
                                />
                              )}
                            </td>

                            <td>
                              {row.lot_corr
                                .trim()
                                .toUpperCase() === "PERD" ? (
                                <Button
                                  size="sm"
                                  disabled={
                                    blockedLots ||
                                    !!editing ||
                                    !!newLot
                                  }
                                  onClick={() =>
                                    void deletePerd(row)
                                  }
                                >
                                  Eliminar PERD
                                </Button>
                              ) : isEditing ? (
                                <div className="trjg-actions">
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
                                <div className="trjg-actions">
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
                                        value: tmhInputValue(
                                          row.tmh_departure
                                        ),
                                      })
                                    }
                                  >
                                    Editar salida
                                  </Button>

                                  {lotClosed && (
                                    <span className="trjg-note">
                                      PERD se ajustará automáticamente
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}

                      {!guideLots.length && (
                        <tr>
                          <td colSpan={10}>
                            Esta guía todavía no tiene lotes.
                          </td>
                        </tr>
                      )}
                    </tbody>

                    <tfoot>
                      <tr>
                        <th colSpan={2}>Total guía</th>
                        <td>{fmt(activeGuide?.tmh_departure)}</td>
                        <td colSpan={2} />
                        <td>{fmt(activeGuide?.tmh_arrival)}</td>
                        <td colSpan={4} />
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {editing && editError && (
                  <div
                    className="trjg-message trjg-error"
                    style={{ marginTop: 7 }}
                  >
                    {editError}
                  </div>
                )}
              </>
            )}
            </div>

            <aside className="trjg-used-lots">
              <div className="trjg-lots-head">
                <div>
                  <h3 className="trjg-lots-title">
                    Lotes usados con saldo
                  </h3>
                  <div className="trjg-note">
                    Usados anteriormente y todavía pendientes.
                  </div>
                </div>

                <span className="trjg-count">
                  {usedPendingLots.length}
                </span>
              </div>

              <div className="trjg-used-list">
                {usedPendingLots.map((row) => {
                  const selected =
                    pendingCloseLot === row.lot;

                  return (
                    <div
                      className="trjg-used-row"
                      key={row.lot}
                    >
                      <div className="trjg-used-main">
                        <strong>{row.lot}</strong>
                        <span>
                          Usado {fmt(row.tmh_departure)} · Saldo{" "}
                          {fmt(row.tmh_balance)} TMH
                        </span>
                        <span>
                          Última guía: {row.last_guide_number || "—"}
                        </span>
                      </div>

                      <div className="trjg-used-actions">
                        <LotHistory
                          lot={row.lot}
                          rows={lots}
                        />

                        <Button
                          size="sm"
                          disabled={
                            pendingCloseBlocked ||
                            !row.last_guide_number ||
                            !hasVisibleTmhBalance(row.tmh_balance) ||
                            closedLots.has(code(row.lot))
                          }
                          onClick={() => {
                            if (selected) {
                              setPendingCloseLot(null);
                              setPendingCloseObs("");
                              return;
                            }

                            setPendingCloseLot(row.lot);
                            setPendingCloseObs("");
                          }}
                        >
                          {selected
                            ? "Cancelar cierre"
                            : "Cerrar saldo"}
                        </Button>
                      </div>

                      {selected && (
                        <div className="trjg-pending-close">
                          <label className="trjg-field">
                            Comentario cierre (opcional)
                            <input
                              className="input"
                              maxLength={255}
                              value={pendingCloseObs}
                              onChange={(e) =>
                                setPendingCloseObs(
                                  e.target.value
                                )
                              }
                            />
                          </label>

                          <div className="trjg-note">
                            Se registrará {fmt(row.tmh_balance)} TMH como PERD en la guía {row.last_guide_number}.
                          </div>

                          <div className="trjg-pending-close-actions">
                            <Button
                              size="sm"
                              disabled={
                                saving ||
                                pendingCloseObs.length > 255 ||
                                !hasVisibleTmhBalance(row.tmh_balance) ||
                                closedLots.has(code(row.lot))
                              }
                              onClick={() =>
                                void closePendingBalance(row)
                              }
                            >
                              Confirmar cierre
                            </Button>

                            <Button
                              size="sm"
                              disabled={saving}
                              onClick={() => {
                                setPendingCloseLot(null);
                                setPendingCloseObs("");
                              }}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {!usedPendingLots.length && (
                  <div className="trjg-note">
                    No hay lotes usados con saldo pendiente.
                  </div>
                )}
              </div>
            </aside>
          </div>
        </section>
      )}
    </div>
  );
}