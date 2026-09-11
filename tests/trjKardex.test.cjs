const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const domainModule = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(
    fs.readFileSync(path.join(__dirname, "../src/lib/trjKardex.ts"), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    },
  ).outputText,
  { module: domainModule, exports: domainModule.exports },
);
const domain = domainModule.exports;

test("facturas: series alfanuméricas, ceros y rechazo de truncamiento", () => {
  for (const [input, expected] of [
    ["E001-123", "E001-0000000123"],
    ["FPP1-0007123", "FPP1-0000007123"],
    [" ff01-8 ", "FF01-0000000008"],
    ["E001123", "E001-0000000123"],
  ]) {
    assert.equal(domain.normalizeInvoiceNumber(input), expected);
  }
  for (const bad of [
    "E001-12345678901",
    "E001-",
    "E001-ABC",
    "AB-12",
    "E001-1-2",
  ])
    assert.equal(domain.normalizeInvoiceNumber(bad), "");
});

test("estadísticas: no duplicar factura por guías/lotes, ni PERD como envío", () => {
  const guide = {
    guide_number: "GR01-0000000001",
    transport_ruc: "20123456789",
    transport_name: "Transporte",
    departure_date: "2026-09-06",
    tmh_departure: "10",
    document_number: "E001-0000000001",
    status_name: "ABIERTO",
  };
  const second = {
    ...guide,
    guide_number: "GR01-0000000002",
    tmh_departure: "5",
    status_name: "CERRADO",
  };
  const lots = [
    { ...guide, lot: "TRJ-26-00001", lot_corr: "0001", tmh_departure: "6" },
    { ...guide, lot: "TRJ-26-00002", lot_corr: "0001", tmh_departure: "4" },
    { ...second, lot: "TRJ-26-00002", lot_corr: "0002", tmh_departure: "5" },
    { ...second, lot: "TRJ-26-00002", lot_corr: "PERD", tmh_departure: "100" },
  ];
  const invoice = {
    ruc: guide.transport_ruc,
    document_number: guide.document_number,
    document_date: "2026-09-07",
    amount_usd: "150",
    amount_usd_con: "140",
    subledger_num: "820",
  };
  const stats = domain.kardexStatistics(
    [...lots, lots[0]],
    [guide, second, guide],
    [invoice, invoice],
    "week",
  );
  assert.equal(stats.guideCount, 2);
  assert.equal(stats.lotCount, 2);
  assert.equal(stats.lotsPerGuide, 1.5);
  assert.equal(stats.tmh, 15);
  assert.equal(stats.entered, 150000000n);
  assert.equal(stats.concar, 140000000n);
  assert.equal(stats.closed, 1);
  assert.equal(stats.series[0].label, "2026-08-31");
  assert.equal(stats.series[1].label, "2026-09-07");
});

test("facturas de distinto RUC y sin guías se cuentan independientemente", () => {
  const invoices = [
    {
      ruc: "20123456789",
      document_number: "E001-0000000001",
      document_date: "2026-09-01",
      amount_usd: "100.10",
      amount_usd_con: null,
    },
    {
      ruc: "20987654321",
      document_number: "E001-0000000001",
      document_date: "2026-09-01",
      amount_usd: "20.20",
      amount_usd_con: "-2.5",
      subledger_num: "820",
    },
  ];
  const stats = domain.kardexStatistics([], [], invoices, "month");
  assert.equal(stats.entered, 120300000n);
  assert.equal(stats.concar, -2500000n);
  assert.equal(stats.unmatched, 1);
  assert.equal(stats.guideCount, 0);
});

test("conciliación exacta y semana en cambio de año", () => {
  assert.equal(
    domain.kardexUnits("0.1") + domain.kardexUnits("0.2"),
    domain.kardexUnits("0.3"),
  );
  assert.equal(domain.kardexCents(domain.kardexUnits("0.005")), 1n);
  assert.equal(domain.kardexCents(domain.kardexUnits("-0.005")), -1n);
  assert.equal(domain.kardexDecimal(-120300000n), "-120.300000");
  assert.equal(domain.kardexPeriodKey("2027-01-01", "week"), "2026-12-28");
});

const serverFile = process.env.TRJKAR_SERVER_FILE;
function backend({
  invoice = null,
  invoiceGuides = [],
  guideRows = {},
  failWrite = false,
} = {}) {
  const source = fs.readFileSync(serverFile, "utf8");
  const helpers = source.slice(
    source.indexOf("// server.js (DESDE ACA FINANZAS KARDEX TRJ - HELPERS)"),
    source.indexOf("// server.js (DESDE ACA FINANZAS KARDEX TRJ - ENDPOINTS)"),
  );
  const log = [];
  class Transaction {
    async begin() {
      log.push({ operation: "begin" });
    }
    async commit() {
      log.push({ operation: "commit" });
    }
    async rollback() {
      log.push({ operation: "rollback" });
    }
  }
  class Request {
    constructor() {
      this.params = {};
    }
    input(key, _type, value) {
      this.params[key] = value;
      return this;
    }
    async query(query) {
      log.push({ query, params: this.params });
      if (query.includes("sp_getapplock"))
        return { recordset: [{ result: 0 }] };
      if (query.includes("WITH normalized AS"))
        return {
          recordset: guideRows[this.params.guide]
            ? [{ guide_number: this.params.guide }]
            : [],
        };
      if (query.includes("SELECT document_date, amount_usd FROM"))
        return { recordsets: [invoice ? [invoice] : [], invoiceGuides] };
      if (
        query.includes(
          "SELECT guide_number, transport_ruc, document_number, status_name",
        )
      )
        return {
          recordset: guideRows[this.params.guide]
            ? [guideRows[this.params.guide]]
            : [],
        };
      if (failWrite && /^\s*(UPDATE|INSERT|DELETE)/.test(query))
        throw new Error("simulated write failure");
      return { recordset: [] };
    }
  }
  const context = vm.createContext({
    console,
    sql: {
      Transaction,
      Request,
      VarChar: (n) => n,
      NVarChar: (n) => n,
      Bit: 1,
    },
    getPool: async () => ({}),
    SQL_NOW_PE: "DATEADD(HOUR, -5, SYSUTCDATETIME())",
  });
  vm.runInContext(helpers, context);
  return { context, log };
}
const identity = { ruc: "20123456789", document_number: "E001-123" };
const guide = {
  guide_number: "GR01-0000000001",
  transport_ruc: identity.ruc,
  document_number: null,
  status_name: "ABIERTO",
};

test(
  "backend: normaliza las mismas facturas que el frontend",
  { skip: !serverFile },
  () => {
    const { context } = backend();
    for (const value of ["E001-123", "FPP1-0007123", "ff01-8"])
      assert.equal(
        context.trjkarInvoiceNumber(value),
        domain.normalizeInvoiceNumber(value),
      );
  },
);
test(
  "backend: guía CERRADA rechaza edición y eliminación, revierte transacción",
  { skip: !serverFile },
  async () => {
    for (const operation of ["delete", "guides", "lots"]) {
      const { context, log } = backend({
        guideRows: {
          [guide.guide_number]: { ...guide, status_name: "CERRADO" },
        },
      });
      await assert.rejects(
        operation === "delete"
          ? context.trjkarDeleteGuide({
              guide_number: guide.guide_number,
              confirmation: "eliminar",
            })
          : context.trjkarSave(
              operation === "guides"
                ? { guide_number: guide.guide_number, driver_name: "TEST" }
                : {
                    guide_number: guide.guide_number,
                    rows: [
                      {
                        lot: "TRJ-26-00001",
                        lot_corr: "0001",
                        tmh_arrival: "1",
                      },
                    ],
                  },
              operation,
            ),
        /CERRADA/,
      );
      assert.ok(log.some((r) => r.operation === "rollback"));
      assert.ok(!log.some((r) => r.operation === "commit"));
      assert.ok(
        !log.some((r) => r.query && /^\s*(UPDATE|INSERT|DELETE)/.test(r.query)),
      );
    }
  },
);
test(
  "backend: factura cerrada rechaza cambios, desvínculo y borrado",
  { skip: !serverFile },
  async () => {
    for (const action of ["insert", "update", "unlink", "delete", "close"]) {
      const { context } = backend({
        invoice: {},
        invoiceGuides: [{ ...guide, status_name: "CERRADO" }],
      });
      const body = { ...identity };
      if (["insert", "update"].includes(action))
        Object.assign(body, { document_date: "2026-01-01", amount_usd: "100" });
      if (action === "insert") body.guide_numbers = [guide.guide_number];
      if (action === "unlink") body.guide_number = guide.guide_number;
      if (["delete", "close"].includes(action))
        body.confirmation = action === "delete" ? "eliminar" : "cerrar";
      await assert.rejects(
        context.trjkarInvoiceMutation(body, action),
        /CERRADAS/,
      );
    }
  },
);
test(
  "backend: validar todas las guías antes de crear/vincular y no permitir otro RUC",
  { skip: !serverFile },
  async () => {
    const second = {
      ...guide,
      guide_number: "GR01-0000000002",
      transport_ruc: "20987654321",
    };
    const { context, log } = backend({
      guideRows: { [guide.guide_number]: guide, [second.guide_number]: second },
    });
    await assert.rejects(
      context.trjkarInvoiceMutation(
        {
          ...identity,
          amount_usd: "100",
          document_date: "2026-01-01",
          guide_numbers: [guide.guide_number, second.guide_number],
        },
        "insert",
      ),
      /otro transportista/,
    );
    assert.ok(
      !log.some((r) => r.query && /^\s*(UPDATE|INSERT|DELETE)/.test(r.query)),
    );
  },
);
test(
  "backend: borrar factura conserva guías/lotes; borrar guía elimina sus lotes primero",
  { skip: !serverFile },
  async () => {
    const invoiceBackend = backend({ invoice: {}, invoiceGuides: [guide] });
    await invoiceBackend.context.trjkarInvoiceMutation(
      { ...identity, confirmation: "eliminar" },
      "delete",
    );
    const invoiceWrite = invoiceBackend.log.find((r) =>
      r.query?.includes("DELETE FROM stg.finance_trjkar_invo_web"),
    );
    assert.match(invoiceWrite.query, /SET document_number = NULL/);
    assert.doesNotMatch(
      invoiceWrite.query,
      /DELETE FROM stg.finance_trjkar_(lots|guides)_web/,
    );
    const guideBackend = backend({
      guideRows: { [guide.guide_number]: guide },
    });
    await guideBackend.context.trjkarDeleteGuide({
      guide_number: guide.guide_number,
      confirmation: "eliminar",
    });
    const query = guideBackend.log.find((r) =>
      r.query?.includes("DELETE FROM stg.finance_trjkar_lots_web"),
    ).query;
    assert.ok(
      query.indexOf("DELETE FROM stg.finance_trjkar_lots_web") <
        query.indexOf("DELETE FROM stg.finance_trjkar_guides_web"),
    );
    assert.ok(guideBackend.log.some((r) => r.operation === "commit"));
  },
);
test(
  "backend: confirmación escrita y rollback ante fallo de escritura",
  { skip: !serverFile },
  async () => {
    const { context, log } = backend({
      guideRows: { [guide.guide_number]: guide },
      failWrite: true,
    });
    await assert.rejects(
      context.trjkarDeleteGuide({
        guide_number: guide.guide_number,
        confirmation: "si",
      }),
      /eliminar/,
    );
    assert.equal(log.length, 0);
    await assert.rejects(
      context.trjkarDeleteGuide({
        guide_number: guide.guide_number,
        confirmation: "eliminar",
      }),
      /simulated/,
    );
    assert.ok(log.some((r) => r.operation === "rollback"));
    assert.ok(!log.some((r) => r.operation === "commit"));
  },
);
