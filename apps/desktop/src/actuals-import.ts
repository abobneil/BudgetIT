import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  ingestActualTransactions,
  listUnmatchedActualTransactions,
  toUsdMinorUnits,
  type ActualTransactionInput
} from "@budgetit/db";
import type Database from "better-sqlite3-multiple-ciphers";
import * as XLSX from "xlsx";

export type ActualImportField =
  | "scenarioId"
  | "serviceId"
  | "contractId"
  | "transactionDate"
  | "amount"
  | "currency"
  | "description";

export type ActualImportMapping = Partial<Record<ActualImportField, string>>;

export type ActualImportError = {
  rowNumber: number;
  code: "validation" | "duplicate";
  field: ActualImportField | "row";
  message: string;
};

export type ActualImportPreviewInput = {
  filePath: string;
  mapping?: ActualImportMapping;
};

export type ActualImportPreviewResult = {
  totalRows: number;
  acceptedCount: number;
  rejectedCount: number;
  duplicateCount: number;
  mapping: ActualImportMapping;
  errors: ActualImportError[];
  acceptedRows: ActualTransactionInput[];
};

export type ActualImportCommitResult = {
  totalRows: number;
  acceptedCount: number;
  rejectedCount: number;
  duplicateCount: number;
  insertedCount: number;
  matchedCount: number;
  unmatchedCount: number;
  matchRate: number;
  errors: ActualImportError[];
  unmatchedForReview: Array<{
    id: string;
    transactionDate: string;
    amountMinor: number;
    description: string | null;
  }>;
};

const REQUIRED_FIELDS: ActualImportField[] = [
  "scenarioId",
  "serviceId",
  "transactionDate",
  "amount"
];

const FIELD_ALIASES: Record<ActualImportField, string[]> = {
  scenarioId: ["scenario_id", "scenario", "scenarioid"],
  serviceId: ["service_id", "service", "serviceid"],
  contractId: ["contract_id", "contract", "contractid"],
  transactionDate: ["transaction_date", "date", "posted_date"],
  amount: ["amount", "amount_usd", "usd", "cost"],
  currency: ["currency", "curr"],
  description: ["description", "memo", "notes"]
};

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
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
  const lines = fs
    .readFileSync(filePath, "utf8")
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
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { headers: [], rows: [] };
  }

  const sheet = workbook.Sheets[sheetName];
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

function readRows(filePath: string): { headers: string[]; rows: Record<string, string>[] } {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".csv") {
    return readCsvRows(filePath);
  }
  if (extension === ".xlsx") {
    return readXlsxRows(filePath);
  }
  throw new Error("Unsupported import file type. Use .csv or .xlsx.");
}

function autoMapping(headers: string[]): ActualImportMapping {
  const byNormalized = new Map<string, string>();
  for (const header of headers) {
    byNormalized.set(normalizeHeader(header), header);
  }

  const mapping: ActualImportMapping = {};
  const fields = Object.keys(FIELD_ALIASES) as ActualImportField[];
  for (const field of fields) {
    for (const alias of FIELD_ALIASES[field]) {
      const header = byNormalized.get(alias);
      if (header) {
        mapping[field] = header;
        break;
      }
    }
  }
  return mapping;
}

function normalizeMapping(headers: string[], mapping: ActualImportMapping | undefined): ActualImportMapping {
  if (!mapping) {
    return autoMapping(headers);
  }

  const availableHeaders = new Set(headers);
  const normalized: ActualImportMapping = {};
  const fields = Object.keys(mapping) as ActualImportField[];
  for (const field of fields) {
    const header = mapping[field];
    if (header && availableHeaders.has(header)) {
      normalized[field] = header;
    }
  }
  return normalized;
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  return !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime());
}

function valueAt(row: Record<string, string>, mapping: ActualImportMapping, field: ActualImportField): string {
  const column = mapping[field];
  if (!column) {
    return "";
  }
  return (row[column] ?? "").trim();
}

function fingerprint(row: ActualTransactionInput): string {
  return crypto
    .createHash("sha256")
    .update(
      [
        row.scenarioId,
        row.serviceId,
        row.contractId ?? "",
        row.transactionDate,
        row.amountMinor,
        row.currency,
        row.description ?? ""
      ].join("|")
    )
    .digest("hex");
}

function loadExistingFingerprints(db: Database.Database): Set<string> {
  const rows = db
    .prepare(
      `
        SELECT
          scenario_id,
          service_id,
          contract_id,
          transaction_date,
          amount_minor,
          currency,
          description
        FROM spend_transaction
      `
    )
    .all() as Array<{
    scenario_id: string;
    service_id: string;
    contract_id: string | null;
    transaction_date: string;
    amount_minor: number;
    currency: string;
    description: string | null;
  }>;

  const result = new Set<string>();
  for (const row of rows) {
    result.add(
      fingerprint({
        scenarioId: row.scenario_id,
        serviceId: row.service_id,
        contractId: row.contract_id,
        transactionDate: row.transaction_date,
        amountMinor: row.amount_minor,
        currency: "USD",
        description: row.description ?? undefined
      })
    );
  }
  return result;
}

function validateRows(
  rows: Record<string, string>[],
  mapping: ActualImportMapping,
  existingFingerprints: Set<string>
): { acceptedRows: ActualTransactionInput[]; errors: ActualImportError[]; duplicateCount: number } {
  const errors: ActualImportError[] = [];
  const acceptedRows: ActualTransactionInput[] = [];
  const seenFingerprints = new Set<string>();
  let duplicateCount = 0;

  for (let index = 0; index < rows.length; index += 1) {
    const rowNumber = index + 2;

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

    const scenarioId = valueAt(rows[index], mapping, "scenarioId");
    const serviceId = valueAt(rows[index], mapping, "serviceId");
    const contractId = valueAt(rows[index], mapping, "contractId");
    const transactionDate = valueAt(rows[index], mapping, "transactionDate");
    const amountRaw = valueAt(rows[index], mapping, "amount");
    const currency = valueAt(rows[index], mapping, "currency").toUpperCase() || "USD";
    const description = valueAt(rows[index], mapping, "description");

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
    if (!isIsoDate(transactionDate)) {
      errors.push({
        rowNumber,
        code: "validation",
        field: "transactionDate",
        message: "transactionDate must use YYYY-MM-DD format."
      });
    }
    if (currency !== "USD") {
      errors.push({
        rowNumber,
        code: "validation",
        field: "currency",
        message: "currency must be USD."
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

    const latestErrorIndex = errors.findIndex((entry) => entry.rowNumber === rowNumber);
    if (latestErrorIndex >= 0) {
      continue;
    }

    const normalized: ActualTransactionInput = {
      scenarioId,
      serviceId,
      contractId: contractId || undefined,
      transactionDate,
      amountMinor,
      currency: "USD",
      description: description || undefined
    };

    const rowFingerprint = fingerprint(normalized);
    if (seenFingerprints.has(rowFingerprint) || existingFingerprints.has(rowFingerprint)) {
      duplicateCount += 1;
      errors.push({
        rowNumber,
        code: "duplicate",
        field: "row",
        message: "Duplicate actual transaction row skipped."
      });
      continue;
    }

    seenFingerprints.add(rowFingerprint);
    acceptedRows.push(normalized);
  }

  return { acceptedRows, errors, duplicateCount };
}

export function previewActualsImport(
  db: Database.Database,
  input: ActualImportPreviewInput
): ActualImportPreviewResult {
  const { headers, rows } = readRows(input.filePath);
  const mapping = normalizeMapping(headers, input.mapping);
  const existingFingerprints = loadExistingFingerprints(db);
  const { acceptedRows, errors, duplicateCount } = validateRows(rows, mapping, existingFingerprints);

  return {
    totalRows: rows.length,
    acceptedCount: acceptedRows.length,
    rejectedCount: errors.length,
    duplicateCount,
    mapping,
    errors,
    acceptedRows
  };
}

export function commitActualsImport(
  db: Database.Database,
  input: ActualImportPreviewInput
): ActualImportCommitResult {
  const preview = previewActualsImport(db, input);
  const ingestResult = ingestActualTransactions(db, preview.acceptedRows);
  const scenarioId = preview.acceptedRows[0]?.scenarioId;
  const unmatchedForReview = scenarioId
    ? listUnmatchedActualTransactions(db, scenarioId).slice(0, 20).map((entry) => ({
        id: entry.id,
        transactionDate: entry.transactionDate,
        amountMinor: entry.amountMinor,
        description: entry.description
      }))
    : [];

  return {
    totalRows: preview.totalRows,
    acceptedCount: preview.acceptedCount,
    rejectedCount: preview.rejectedCount,
    duplicateCount: preview.duplicateCount,
    insertedCount: ingestResult.inserted,
    matchedCount: ingestResult.matched,
    unmatchedCount: ingestResult.unmatched,
    matchRate: ingestResult.matchRate,
    errors: preview.errors,
    unmatchedForReview
  };
}
