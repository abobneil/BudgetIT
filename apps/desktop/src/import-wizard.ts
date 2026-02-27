import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { BudgetCrudRepository, toUsdMinorUnits } from "@budgetit/db";
import type Database from "better-sqlite3-multiple-ciphers";
import * as XLSX from "xlsx";

export type ImportField =
  | "scenarioId"
  | "serviceId"
  | "contractId"
  | "name"
  | "expenseType"
  | "status"
  | "amount"
  | "currency"
  | "startDate"
  | "endDate"
  | "frequency"
  | "interval"
  | "dayOfMonth"
  | "monthOfYear"
  | "anchorDate";

export type ImportColumnMapping = Partial<Record<ImportField, string>>;

type ExpenseType = "recurring" | "one_time";
type ExpenseStatus = "planned" | "approved" | "committed" | "actual" | "cancelled";
type Frequency = "monthly" | "quarterly" | "yearly";

type RecurrenceInput = {
  frequency: Frequency;
  interval: number;
  dayOfMonth: number;
  monthOfYear?: number;
  anchorDate?: string;
};

export type NormalizedImportRow = {
  rowNumber: number;
  scenarioId: string;
  serviceId: string;
  contractId?: string;
  name: string;
  expenseType: ExpenseType;
  status: ExpenseStatus;
  amountMinor: number;
  currency: "USD";
  startDate?: string;
  endDate?: string;
  recurrence?: RecurrenceInput;
  fingerprint: string;
};

export type ImportRowError = {
  rowNumber: number;
  code: "validation" | "duplicate";
  field: ImportField | "row";
  message: string;
};

export type ImportPreviewInput = {
  filePath: string;
  mapping?: ImportColumnMapping;
  templateName?: string;
  useSavedTemplate?: boolean;
  saveTemplate?: boolean;
  templateStorePath: string;
};

export type ImportPreviewResult = {
  totalRows: number;
  acceptedCount: number;
  rejectedCount: number;
  duplicateCount: number;
  mapping: ImportColumnMapping;
  templateApplied: string | null;
  templateSaved: string | null;
  errors: ImportRowError[];
  acceptedRows: NormalizedImportRow[];
};

export type ImportCommitResult = {
  totalRows: number;
  acceptedCount: number;
  rejectedCount: number;
  duplicateCount: number;
  insertedCount: number;
  skippedDuplicateCount: number;
  errors: ImportRowError[];
};

type TemplateStore = {
  templates: Array<{
    name: string;
    headerSignature: string;
    mapping: ImportColumnMapping;
    updatedAt: string;
  }>;
};

const REQUIRED_FIELDS: ImportField[] = [
  "scenarioId",
  "serviceId",
  "name",
  "expenseType",
  "status",
  "amount"
];

const FIELD_ALIASES: Record<ImportField, string[]> = {
  scenarioId: ["scenario_id", "scenario", "scenarioid"],
  serviceId: ["service_id", "service", "serviceid"],
  contractId: ["contract_id", "contract", "contractid"],
  name: ["name", "expense", "expense_name", "line_item"],
  expenseType: ["expense_type", "type"],
  status: ["status"],
  amount: ["amount", "amount_usd", "usd", "cost", "price"],
  currency: ["currency", "curr"],
  startDate: ["start_date", "start"],
  endDate: ["end_date", "end"],
  frequency: ["frequency", "recurrence"],
  interval: ["interval", "every"],
  dayOfMonth: ["day_of_month", "day", "dom"],
  monthOfYear: ["month_of_year", "month", "moy"],
  anchorDate: ["anchor_date", "anchor"]
};

function normalizeHeaderName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime());
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function parseIntStrict(value: string): number | null {
  if (!/^-?\d+$/.test(value.trim())) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "\"") {
      if (insideQuotes && line[index + 1] === "\"") {
        current += "\"";
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === "," && !insideQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map((entry) => entry.trim());
}

function readCsvRows(filePath: string): { headers: string[]; rows: Record<string, string>[] } {
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const record: Record<string, string> = {};
    for (let index = 0; index < headers.length; index += 1) {
      record[headers[index]] = cells[index] ?? "";
    }
    return record;
  });

  return { headers, rows };
}

function readXlsxRows(filePath: string): { headers: string[]; rows: Record<string, string>[] } {
  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return { headers: [], rows: [] };
  }

  const sheet = workbook.Sheets[firstSheetName];
  const matrix = XLSX.utils.sheet_to_json<Array<string | number | boolean | null>>(sheet, {
    header: 1,
    defval: ""
  });
  if (matrix.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = matrix[0].map((value) => String(value ?? "").trim());
  const rows = matrix.slice(1).map((line) => {
    const record: Record<string, string> = {};
    for (let index = 0; index < headers.length; index += 1) {
      record[headers[index]] = String(line[index] ?? "").trim();
    }
    return record;
  });

  return { headers, rows };
}

function readImportRows(filePath: string): { headers: string[]; rows: Record<string, string>[] } {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".csv") {
    return readCsvRows(filePath);
  }
  if (extension === ".xlsx") {
    return readXlsxRows(filePath);
  }
  throw new Error("Unsupported import file type. Use .csv or .xlsx.");
}

function loadTemplateStore(filePath: string): TemplateStore {
  if (!fs.existsSync(filePath)) {
    return { templates: [] };
  }
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Partial<TemplateStore>;
  if (!Array.isArray(parsed.templates)) {
    return { templates: [] };
  }
  return {
    templates: parsed.templates.filter((entry): entry is TemplateStore["templates"][number] => {
      return (
        typeof entry?.name === "string" &&
        typeof entry?.headerSignature === "string" &&
        typeof entry?.mapping === "object" &&
        entry.mapping !== null &&
        typeof entry?.updatedAt === "string"
      );
    })
  };
}

function saveTemplateStore(filePath: string, store: TemplateStore): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function headerSignature(headers: string[]): string {
  return headers.map(normalizeHeaderName).join("|");
}

function buildAutoMapping(headers: string[]): ImportColumnMapping {
  const byNormalizedName = new Map<string, string>();
  for (const header of headers) {
    byNormalizedName.set(normalizeHeaderName(header), header);
  }

  const mapping: ImportColumnMapping = {};
  const fields = Object.keys(FIELD_ALIASES) as ImportField[];
  for (const field of fields) {
    for (const alias of FIELD_ALIASES[field]) {
      const candidate = byNormalizedName.get(alias);
      if (candidate) {
        mapping[field] = candidate;
        break;
      }
    }
  }
  return mapping;
}

function normalizeMapping(headers: string[], mapping: ImportColumnMapping): ImportColumnMapping {
  const headerSet = new Set(headers);
  const normalized: ImportColumnMapping = {};
  const fields = Object.keys(mapping) as ImportField[];
  for (const field of fields) {
    const column = mapping[field];
    if (!column || !headerSet.has(column)) {
      continue;
    }
    normalized[field] = column;
  }
  return normalized;
}

function resolveMapping(
  headers: string[],
  input: ImportPreviewInput
): { mapping: ImportColumnMapping; templateApplied: string | null; templateSaved: string | null } {
  const signature = headerSignature(headers);
  const requested = input.mapping ? normalizeMapping(headers, input.mapping) : {};
  const store = loadTemplateStore(input.templateStorePath);
  let mapping: ImportColumnMapping = { ...requested };
  let templateApplied: string | null = null;

  const hasRequestedMapping = Object.keys(requested).length > 0;
  const shouldUseTemplate = input.useSavedTemplate !== false && !hasRequestedMapping;
  if (shouldUseTemplate) {
    const template = store.templates.find((entry) => {
      if (input.templateName) {
        return entry.name === input.templateName;
      }
      return entry.headerSignature === signature;
    });
    if (template) {
      mapping = normalizeMapping(headers, template.mapping);
      templateApplied = template.name;
    }
  }

  if (Object.keys(mapping).length === 0) {
    mapping = buildAutoMapping(headers);
  }

  let templateSaved: string | null = null;
  if (input.saveTemplate) {
    const name = input.templateName?.trim() || `template:${signature}`;
    const updatedAt = new Date().toISOString();
    const nextStore: TemplateStore = {
      templates: store.templates.filter((entry) => entry.name !== name).concat({
        name,
        headerSignature: signature,
        mapping,
        updatedAt
      })
    };
    saveTemplateStore(input.templateStorePath, nextStore);
    templateSaved = name;
  }

  return { mapping, templateApplied, templateSaved };
}

function buildFingerprint(row: Omit<NormalizedImportRow, "fingerprint" | "rowNumber">): string {
  const recurrenceToken = row.recurrence
    ? `${row.recurrence.frequency}|${row.recurrence.interval}|${row.recurrence.dayOfMonth}|${row.recurrence.monthOfYear ?? ""}|${row.recurrence.anchorDate ?? ""}`
    : "";
  const token = [
    row.scenarioId,
    row.serviceId,
    row.contractId ?? "",
    row.name.toLowerCase(),
    row.expenseType,
    row.status,
    String(row.amountMinor),
    row.currency,
    row.startDate ?? "",
    row.endDate ?? "",
    recurrenceToken
  ].join("|");
  return sha256(token);
}

function rowValue(row: Record<string, string>, mapping: ImportColumnMapping, field: ImportField): string {
  const column = mapping[field];
  if (!column) {
    return "";
  }
  return (row[column] ?? "").trim();
}

function normalizeRow(
  row: Record<string, string>,
  rowNumber: number,
  mapping: ImportColumnMapping
): { value?: NormalizedImportRow; errors: ImportRowError[] } {
  const errors: ImportRowError[] = [];
  const scenarioId = rowValue(row, mapping, "scenarioId");
  const serviceId = rowValue(row, mapping, "serviceId");
  const contractId = rowValue(row, mapping, "contractId");
  const name = rowValue(row, mapping, "name");
  const expenseTypeRaw = rowValue(row, mapping, "expenseType").toLowerCase();
  const statusRaw = rowValue(row, mapping, "status").toLowerCase();
  const amountRaw = rowValue(row, mapping, "amount");
  const currencyRaw = rowValue(row, mapping, "currency").toUpperCase() || "USD";
  const startDate = rowValue(row, mapping, "startDate");
  const endDate = rowValue(row, mapping, "endDate");
  const frequencyRaw = rowValue(row, mapping, "frequency").toLowerCase();
  const intervalRaw = rowValue(row, mapping, "interval");
  const dayOfMonthRaw = rowValue(row, mapping, "dayOfMonth");
  const monthOfYearRaw = rowValue(row, mapping, "monthOfYear");
  const anchorDate = rowValue(row, mapping, "anchorDate");

  for (const field of REQUIRED_FIELDS) {
    if (!mapping[field]) {
      errors.push({
        rowNumber,
        code: "validation",
        field,
        message: `Missing mapping for required field: ${field}`
      });
    }
  }

  if (!scenarioId) {
    errors.push({
      rowNumber,
      code: "validation",
      field: "scenarioId",
      message: "scenarioId is required."
    });
  }
  if (!serviceId) {
    errors.push({
      rowNumber,
      code: "validation",
      field: "serviceId",
      message: "serviceId is required."
    });
  }
  if (!name) {
    errors.push({
      rowNumber,
      code: "validation",
      field: "name",
      message: "name is required."
    });
  }

  let expenseType: ExpenseType | null = null;
  if (expenseTypeRaw === "recurring" || expenseTypeRaw === "one_time") {
    expenseType = expenseTypeRaw;
  } else {
    errors.push({
      rowNumber,
      code: "validation",
      field: "expenseType",
      message: "expenseType must be recurring or one_time."
    });
  }

  let status: ExpenseStatus | null = null;
  if (
    statusRaw === "planned" ||
    statusRaw === "approved" ||
    statusRaw === "committed" ||
    statusRaw === "actual" ||
    statusRaw === "cancelled"
  ) {
    status = statusRaw;
  } else {
    errors.push({
      rowNumber,
      code: "validation",
      field: "status",
      message: "status is invalid."
    });
  }

  let amountMinor = 0;
  try {
    amountMinor = toUsdMinorUnits(amountRaw);
    if (amountMinor < 0) {
      errors.push({
        rowNumber,
        code: "validation",
        field: "amount",
        message: "amount must be non-negative."
      });
    }
  } catch {
    errors.push({
      rowNumber,
      code: "validation",
      field: "amount",
      message: "amount is invalid."
    });
  }

  if (currencyRaw !== "USD") {
    errors.push({
      rowNumber,
      code: "validation",
      field: "currency",
      message: "currency must be USD."
    });
  }

  if (startDate && !isIsoDate(startDate)) {
    errors.push({
      rowNumber,
      code: "validation",
      field: "startDate",
      message: "startDate must use YYYY-MM-DD format."
    });
  }
  if (endDate && !isIsoDate(endDate)) {
    errors.push({
      rowNumber,
      code: "validation",
      field: "endDate",
      message: "endDate must use YYYY-MM-DD format."
    });
  }

  let recurrence: RecurrenceInput | undefined;
  if (expenseType === "recurring") {
    if (
      frequencyRaw !== "monthly" &&
      frequencyRaw !== "quarterly" &&
      frequencyRaw !== "yearly"
    ) {
      errors.push({
        rowNumber,
        code: "validation",
        field: "frequency",
        message: "frequency is required for recurring expenses."
      });
    }

    const interval = intervalRaw.length > 0 ? parseIntStrict(intervalRaw) : 1;
    if (interval === null || interval <= 0) {
      errors.push({
        rowNumber,
        code: "validation",
        field: "interval",
        message: "interval must be a positive integer."
      });
    }

    const dayOfMonth = parseIntStrict(dayOfMonthRaw);
    if (dayOfMonth === null || dayOfMonth < 1 || dayOfMonth > 31) {
      errors.push({
        rowNumber,
        code: "validation",
        field: "dayOfMonth",
        message: "dayOfMonth must be an integer between 1 and 31."
      });
    }

    const monthOfYear = monthOfYearRaw.length > 0 ? parseIntStrict(monthOfYearRaw) : null;
    if (frequencyRaw === "yearly") {
      if (monthOfYear === null || monthOfYear < 1 || monthOfYear > 12) {
        errors.push({
          rowNumber,
          code: "validation",
          field: "monthOfYear",
          message: "monthOfYear is required for yearly recurrence."
        });
      }
    } else if (monthOfYear !== null && (monthOfYear < 1 || monthOfYear > 12)) {
      errors.push({
        rowNumber,
        code: "validation",
        field: "monthOfYear",
        message: "monthOfYear must be between 1 and 12."
      });
    }

    if (anchorDate && !isIsoDate(anchorDate)) {
      errors.push({
        rowNumber,
        code: "validation",
        field: "anchorDate",
        message: "anchorDate must use YYYY-MM-DD format."
      });
    }

    if (
      errors.length === 0 &&
      interval !== null &&
      dayOfMonth !== null &&
      (frequencyRaw === "monthly" || frequencyRaw === "quarterly" || frequencyRaw === "yearly")
    ) {
      recurrence = {
        frequency: frequencyRaw,
        interval,
        dayOfMonth,
        monthOfYear: monthOfYear ?? undefined,
        anchorDate: anchorDate || undefined
      };
    }
  }

  if (errors.length > 0 || !expenseType || !status) {
    return { errors };
  }

  const baseRow: Omit<NormalizedImportRow, "fingerprint" | "rowNumber"> = {
    scenarioId,
    serviceId,
    contractId: contractId || undefined,
    name,
    expenseType,
    status,
    amountMinor,
    currency: "USD",
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    recurrence
  };

  return {
    value: {
      rowNumber,
      ...baseRow,
      fingerprint: buildFingerprint(baseRow)
    },
    errors: []
  };
}

function loadExistingFingerprints(db: Database.Database): Set<string> {
  const rows = db
    .prepare(
      `
        SELECT
          e.scenario_id,
          e.service_id,
          e.contract_id,
          e.name,
          e.expense_type,
          e.status,
          e.amount_minor,
          e.currency,
          e.start_date,
          e.end_date,
          r.frequency,
          r.interval,
          r.day_of_month,
          r.month_of_year,
          r.anchor_date
        FROM expense_line e
        LEFT JOIN recurrence_rule r ON r.expense_line_id = e.id
        WHERE e.deleted_at IS NULL
      `
    )
    .all() as Array<{
    scenario_id: string;
    service_id: string;
    contract_id: string | null;
    name: string;
    expense_type: ExpenseType;
    status: ExpenseStatus;
    amount_minor: number;
    currency: string;
    start_date: string | null;
    end_date: string | null;
    frequency: Frequency | null;
    interval: number | null;
    day_of_month: number | null;
    month_of_year: number | null;
    anchor_date: string | null;
  }>;

  const fingerprints = new Set<string>();
  for (const row of rows) {
    const recurrence: RecurrenceInput | undefined =
      row.expense_type === "recurring" && row.frequency && row.interval && row.day_of_month
        ? {
            frequency: row.frequency,
            interval: row.interval,
            dayOfMonth: row.day_of_month,
            monthOfYear: row.month_of_year ?? undefined,
            anchorDate: row.anchor_date ?? undefined
          }
        : undefined;

    fingerprints.add(
      buildFingerprint({
        scenarioId: row.scenario_id,
        serviceId: row.service_id,
        contractId: row.contract_id ?? undefined,
        name: row.name,
        expenseType: row.expense_type,
        status: row.status,
        amountMinor: row.amount_minor,
        currency: "USD",
        startDate: row.start_date ?? undefined,
        endDate: row.end_date ?? undefined,
        recurrence
      })
    );
  }

  return fingerprints;
}

function validateRows(
  rows: Record<string, string>[],
  mapping: ImportColumnMapping,
  existingFingerprints: Set<string>
): { acceptedRows: NormalizedImportRow[]; errors: ImportRowError[]; duplicateCount: number } {
  const acceptedRows: NormalizedImportRow[] = [];
  const errors: ImportRowError[] = [];
  const seenFingerprints = new Set<string>();
  let duplicateCount = 0;

  for (let index = 0; index < rows.length; index += 1) {
    const rowNumber = index + 2;
    const normalized = normalizeRow(rows[index], rowNumber, mapping);
    if (!normalized.value) {
      errors.push(...normalized.errors);
      continue;
    }

    if (existingFingerprints.has(normalized.value.fingerprint) || seenFingerprints.has(normalized.value.fingerprint)) {
      duplicateCount += 1;
      errors.push({
        rowNumber,
        code: "duplicate",
        field: "row",
        message: "Duplicate row skipped by deterministic fingerprint."
      });
      continue;
    }

    seenFingerprints.add(normalized.value.fingerprint);
    acceptedRows.push(normalized.value);
  }

  return { acceptedRows, errors, duplicateCount };
}

export function previewExpenseImport(
  db: Database.Database,
  input: ImportPreviewInput
): ImportPreviewResult {
  const { headers, rows } = readImportRows(input.filePath);
  const { mapping, templateApplied, templateSaved } = resolveMapping(headers, input);
  const existingFingerprints = loadExistingFingerprints(db);
  const { acceptedRows, errors, duplicateCount } = validateRows(rows, mapping, existingFingerprints);

  return {
    totalRows: rows.length,
    acceptedCount: acceptedRows.length,
    rejectedCount: errors.length,
    duplicateCount,
    mapping,
    templateApplied,
    templateSaved,
    errors,
    acceptedRows
  };
}

export function commitExpenseImport(
  db: Database.Database,
  input: ImportPreviewInput
): ImportCommitResult {
  const preview = previewExpenseImport(db, input);
  if (preview.acceptedRows.length === 0) {
    return {
      totalRows: preview.totalRows,
      acceptedCount: preview.acceptedCount,
      rejectedCount: preview.rejectedCount,
      duplicateCount: preview.duplicateCount,
      insertedCount: 0,
      skippedDuplicateCount: preview.duplicateCount,
      errors: preview.errors
    };
  }

  const repo = new BudgetCrudRepository(db);
  const write = db.transaction(() => {
    for (const row of preview.acceptedRows) {
      repo.createExpenseLineWithOptionalRecurrence(
        {
          scenarioId: row.scenarioId,
          serviceId: row.serviceId,
          contractId: row.contractId ?? null,
          name: row.name,
          expenseType: row.expenseType,
          status: row.status,
          amountMinor: row.amountMinor,
          currency: "USD",
          startDate: row.startDate,
          endDate: row.endDate
        },
        row.recurrence
          ? {
              expenseLineId: "import-placeholder",
              frequency: row.recurrence.frequency,
              interval: row.recurrence.interval,
              dayOfMonth: row.recurrence.dayOfMonth,
              monthOfYear: row.recurrence.monthOfYear,
              anchorDate: row.recurrence.anchorDate
            }
          : undefined
      );
    }
  });
  write();

  return {
    totalRows: preview.totalRows,
    acceptedCount: preview.acceptedCount,
    rejectedCount: preview.rejectedCount,
    duplicateCount: preview.duplicateCount,
    insertedCount: preview.acceptedRows.length,
    skippedDuplicateCount: preview.duplicateCount,
    errors: preview.errors
  };
}
