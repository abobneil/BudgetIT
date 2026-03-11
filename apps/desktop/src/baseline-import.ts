import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { BudgetCrudRepository, toCurrencyMinorUnits } from "@budgetit/db";
import type Database from "better-sqlite3-multiple-ciphers";
import * as XLSX from "xlsx";

export type BaselineImportField =
  | "scenarioId"
  | "vendorName"
  | "vendorWebsite"
  | "vendorNotes"
  | "vendorOwner"
  | "vendorAnnualSpend"
  | "vendorStatus"
  | "vendorRisk"
  | "serviceName"
  | "serviceOwner"
  | "serviceAnnualSpend"
  | "serviceStatus"
  | "serviceRisk"
  | "serviceReplacementStatus"
  | "contractNumber"
  | "contractStartDate"
  | "contractEndDate"
  | "contractRenewalType"
  | "contractRenewalDate"
  | "contractNoticePeriodDays"
  | "contractOwner"
  | "contractLifecycleStatus"
  | "contractRenewalAction"
  | "expenseName"
  | "expenseType"
  | "expenseStatus"
  | "expenseAmount"
  | "expenseCurrency"
  | "expenseStartDate"
  | "expenseEndDate"
  | "expenseFrequency"
  | "expenseInterval"
  | "expenseDayOfMonth"
  | "expenseMonthOfYear"
  | "expenseAnchorDate"
  | "expenseCapexOpex"
  | "expenseGlAccountCode"
  | "expenseCostCenterCode"
  | "expenseFundingSource";

export type BaselineImportColumnMapping = Partial<Record<BaselineImportField, string>>;

export type BaselineImportRowError = {
  rowNumber: number;
  code: "validation" | "duplicate";
  field: BaselineImportField | "row";
  message: string;
};

export type BaselineImportRowSummary = {
  rowNumber: number;
  scenarioId: string;
  vendorName: string;
  serviceName: string;
  contractNumber: string | null;
  expenseName: string | null;
  actions: {
    vendor: "create" | "update" | "noop";
    service: "create" | "update" | "noop";
    contract: "create" | "update" | "noop" | "n/a";
    expense: "create" | "update" | "noop" | "n/a";
  };
};

export type BaselineEntityCounts = {
  vendors: { created: number; updated: number; unchanged: number };
  services: { created: number; updated: number; unchanged: number };
  contracts: { created: number; updated: number; unchanged: number };
  expenses: { created: number; updated: number; unchanged: number };
};

export type BaselineImportPreviewInput = {
  filePath: string;
  mapping?: BaselineImportColumnMapping;
};

export type BaselineImportPreviewResult = {
  totalRows: number;
  acceptedCount: number;
  rejectedCount: number;
  duplicateCount: number;
  templateApplied: null;
  templateSaved: null;
  errors: BaselineImportRowError[];
  rowSummaries: BaselineImportRowSummary[];
  entityCounts: BaselineEntityCounts;
};

export type BaselineImportCommitResult = BaselineImportPreviewResult & {
  insertedCount: number;
  skippedDuplicateCount: number;
};

type VendorStatus = "active" | "watch" | "archived";
type RiskLevel = "low" | "medium" | "high";
type ServiceStatus = "active" | "trial" | "deprecated" | "retiring" | "retired";
type ReplacementStatus = "not-started" | "candidate-review" | "approved";
type RenewalType = "auto" | "manual" | "none";
type ContractLifecycleStatus = "active" | "renewal-window" | "notice-window" | "expired";
type RenewalAction = "auto-renew" | "manual-review" | "cancel-window";
type ExpenseType = "recurring" | "one_time";
type ExpenseStatus = "planned" | "approved" | "committed" | "actual" | "cancelled";
type RecurrenceFrequency = "monthly" | "quarterly" | "yearly";
type CapexOpex = "capex" | "opex";

type BaselineImportRow = {
  rowNumber: number;
  fingerprint: string;
  scenarioId: string;
  vendor: {
    name: string;
    website?: string;
    notes?: string;
    owner?: string;
    annualSpendMinor?: number;
    status?: VendorStatus;
    risk?: RiskLevel;
  };
  service: {
    name: string;
    owner?: string;
    annualSpendMinor?: number;
    status?: ServiceStatus;
    risk?: RiskLevel;
    replacementStatus?: ReplacementStatus;
  };
  contract?: {
    contractNumber: string;
    startDate?: string;
    endDate?: string;
    renewalType?: RenewalType;
    renewalDate?: string;
    noticePeriodDays?: number;
    owner?: string;
    lifecycleStatus?: ContractLifecycleStatus;
    renewalAction?: RenewalAction;
  };
  expense?: {
    name: string;
    expenseType: ExpenseType;
    status: ExpenseStatus;
    amountMinor: number;
    currency: string;
    startDate?: string;
    endDate?: string;
    recurrence?: {
      frequency: RecurrenceFrequency;
      interval: number;
      dayOfMonth: number;
      monthOfYear?: number;
      anchorDate?: string;
    };
    capexOpex?: CapexOpex;
    glAccountCode?: string;
    costCenterCode?: string;
    fundingSource?: string;
  };
};

type VendorState = {
  id: string;
  name: string;
  website: string | null;
  notes: string | null;
  owner: string | null;
  annualSpendMinor: number;
  status: VendorStatus;
  risk: RiskLevel;
};

type ServiceState = {
  id: string;
  vendorId: string;
  name: string;
  ownerTeam: string | null;
  annualSpendMinor: number;
  status: ServiceStatus;
  risk: RiskLevel;
  replacementStatus: ReplacementStatus;
};

type ContractState = {
  id: string;
  serviceId: string;
  contractNumber: string;
  startDate: string | null;
  endDate: string | null;
  renewalType: RenewalType | null;
  renewalDate: string | null;
  noticePeriodDays: number | null;
  owner: string | null;
  lifecycleStatus: ContractLifecycleStatus;
  renewalAction: RenewalAction;
};

type ExpenseState = {
  id: string;
  scenarioId: string;
  serviceId: string;
  contractId: string | null;
  name: string;
  expenseType: ExpenseType;
  status: ExpenseStatus;
  amountMinor: number;
  currency: string;
  startDate: string | null;
  endDate: string | null;
  capexOpex: CapexOpex | null;
  glAccountCode: string | null;
  costCenterCode: string | null;
  fundingSource: string | null;
  recurrence: {
    id?: string;
    frequency: RecurrenceFrequency;
    interval: number;
    dayOfMonth: number;
    monthOfYear: number | null;
    anchorDate: string | null;
  } | null;
};

type ImportState = {
  vendorByKey: Map<string, VendorState>;
  serviceByKey: Map<string, ServiceState>;
  contractByKey: Map<string, ContractState>;
  expenseByKey: Map<string, ExpenseState>;
};

const BASELINE_IMPORT_FIELDS = new Set<BaselineImportField>([
  "scenarioId",
  "vendorName",
  "vendorWebsite",
  "vendorNotes",
  "vendorOwner",
  "vendorAnnualSpend",
  "vendorStatus",
  "vendorRisk",
  "serviceName",
  "serviceOwner",
  "serviceAnnualSpend",
  "serviceStatus",
  "serviceRisk",
  "serviceReplacementStatus",
  "contractNumber",
  "contractStartDate",
  "contractEndDate",
  "contractRenewalType",
  "contractRenewalDate",
  "contractNoticePeriodDays",
  "contractOwner",
  "contractLifecycleStatus",
  "contractRenewalAction",
  "expenseName",
  "expenseType",
  "expenseStatus",
  "expenseAmount",
  "expenseCurrency",
  "expenseStartDate",
  "expenseEndDate",
  "expenseFrequency",
  "expenseInterval",
  "expenseDayOfMonth",
  "expenseMonthOfYear",
  "expenseAnchorDate",
  "expenseCapexOpex",
  "expenseGlAccountCode",
  "expenseCostCenterCode",
  "expenseFundingSource"
]);

const FIELD_ALIASES: Record<BaselineImportField, string[]> = {
  scenarioId: ["scenario_id", "scenario", "scenarioid"],
  vendorName: ["vendor", "vendor_name", "provider", "provider_name"],
  vendorWebsite: ["vendor_website", "website", "provider_website"],
  vendorNotes: ["vendor_notes", "notes", "provider_notes"],
  vendorOwner: ["vendor_owner", "owner", "vendor_team"],
  vendorAnnualSpend: ["vendor_annual_spend", "vendor_spend", "provider_spend"],
  vendorStatus: ["vendor_status", "provider_status"],
  vendorRisk: ["vendor_risk", "provider_risk"],
  serviceName: ["service", "service_name", "product", "product_name"],
  serviceOwner: ["service_owner", "service_team", "owner_team"],
  serviceAnnualSpend: ["service_annual_spend", "service_spend", "annual_spend"],
  serviceStatus: ["service_status", "product_status"],
  serviceRisk: ["service_risk", "product_risk"],
  serviceReplacementStatus: ["service_replacement_status", "replacement_status"],
  contractNumber: ["contract_number", "contract", "agreement_number"],
  contractStartDate: ["contract_start_date", "start_date", "contract_start"],
  contractEndDate: ["contract_end_date", "end_date", "contract_end"],
  contractRenewalType: ["contract_renewal_type", "renewal_type"],
  contractRenewalDate: ["contract_renewal_date", "renewal_date"],
  contractNoticePeriodDays: ["contract_notice_period_days", "notice_period_days", "notice_days"],
  contractOwner: ["contract_owner", "agreement_owner"],
  contractLifecycleStatus: ["contract_lifecycle_status", "lifecycle_status"],
  contractRenewalAction: ["contract_renewal_action", "renewal_action"],
  expenseName: ["expense_name", "expense", "line_item_name"],
  expenseType: ["expense_type", "line_item_type"],
  expenseStatus: ["expense_status", "line_item_status"],
  expenseAmount: ["expense_amount", "amount", "cost", "price"],
  expenseCurrency: ["expense_currency", "currency"],
  expenseStartDate: ["expense_start_date", "expense_start"],
  expenseEndDate: ["expense_end_date", "expense_end"],
  expenseFrequency: ["expense_frequency", "frequency", "recurrence"],
  expenseInterval: ["expense_interval", "interval", "every"],
  expenseDayOfMonth: ["expense_day_of_month", "day_of_month", "dom"],
  expenseMonthOfYear: ["expense_month_of_year", "month_of_year", "moy"],
  expenseAnchorDate: ["expense_anchor_date", "anchor_date"],
  expenseCapexOpex: ["expense_capex_opex", "capex_opex", "capexopex"],
  expenseGlAccountCode: ["expense_gl_account_code", "gl_account_code", "gl_account"],
  expenseCostCenterCode: ["expense_cost_center_code", "cost_center_code", "cost_center"],
  expenseFundingSource: ["expense_funding_source", "funding_source"]
};

function createEmptyEntityCounts(): BaselineEntityCounts {
  return {
    vendors: { created: 0, updated: 0, unchanged: 0 },
    services: { created: 0, updated: 0, unchanged: 0 },
    contracts: { created: 0, updated: 0, unchanged: 0 },
    expenses: { created: 0, updated: 0, unchanged: 0 }
  };
}

function normalizeHeaderName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function normalizeLookupToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeCurrencyCode(value: string): string {
  return value.trim().toUpperCase();
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime());
}

function parseIntStrict(value: string): number | null {
  if (!/^-?\d+$/.test(value.trim())) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
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
  if (extension === ".xlsx" || extension === ".xls") {
    return readXlsxRows(filePath);
  }
  throw new Error("Unsupported baseline import file type. Use .csv, .xls, or .xlsx.");
}

function buildAutoMapping(headers: string[], requested?: BaselineImportColumnMapping): BaselineImportColumnMapping {
  const byNormalizedName = new Map<string, string>();
  for (const header of headers) {
    byNormalizedName.set(normalizeHeaderName(header), header);
  }
  const mapping: BaselineImportColumnMapping = {};
  if (requested) {
    for (const [field, column] of Object.entries(requested) as Array<[BaselineImportField, string]>) {
      if (BASELINE_IMPORT_FIELDS.has(field) && headers.includes(column)) {
        mapping[field] = column;
      }
    }
  }
  for (const [field, aliases] of Object.entries(FIELD_ALIASES) as Array<[BaselineImportField, string[]]>) {
    if (mapping[field]) {
      continue;
    }
    for (const alias of aliases) {
      const matched = byNormalizedName.get(alias);
      if (matched) {
        mapping[field] = matched;
        break;
      }
    }
  }
  return mapping;
}

function rowValue(
  row: Record<string, string>,
  mapping: BaselineImportColumnMapping,
  field: BaselineImportField
): string {
  const column = mapping[field];
  return column ? (row[column] ?? "").trim() : "";
}

function buildRowFingerprint(input: {
  scenarioId: string;
  vendorName: string;
  serviceName: string;
  contractNumber?: string;
  expenseName?: string;
  expenseType?: string;
  expenseStatus?: string;
  expenseAmount?: string;
  startDate?: string;
  endDate?: string;
}): string {
  return sha256(
    [
      input.scenarioId,
      normalizeLookupToken(input.vendorName),
      normalizeLookupToken(input.serviceName),
      normalizeLookupToken(input.contractNumber ?? ""),
      normalizeLookupToken(input.expenseName ?? ""),
      input.expenseType ?? "",
      input.expenseStatus ?? "",
      input.expenseAmount ?? "",
      input.startDate ?? "",
      input.endDate ?? ""
    ].join("|")
  );
}

function normalizeRow(
  row: Record<string, string>,
  rowNumber: number,
  mapping: BaselineImportColumnMapping
): { value?: BaselineImportRow; errors: BaselineImportRowError[] } {
  const errors: BaselineImportRowError[] = [];
  const scenarioId = rowValue(row, mapping, "scenarioId") || "baseline";
  const vendorName = rowValue(row, mapping, "vendorName");
  const serviceName = rowValue(row, mapping, "serviceName");
  const contractNumber = rowValue(row, mapping, "contractNumber");
  const expenseName = rowValue(row, mapping, "expenseName");
  const expenseTypeRaw = rowValue(row, mapping, "expenseType").toLowerCase();
  const expenseStatusRaw = rowValue(row, mapping, "expenseStatus").toLowerCase();
  const expenseAmountRaw = rowValue(row, mapping, "expenseAmount");
  const expenseCurrency = normalizeCurrencyCode(rowValue(row, mapping, "expenseCurrency") || "USD");

  if (!vendorName) {
    errors.push({ rowNumber, code: "validation", field: "vendorName", message: "vendorName is required." });
  }
  if (!serviceName) {
    errors.push({ rowNumber, code: "validation", field: "serviceName", message: "serviceName is required." });
  }

  const vendorAnnualSpendRaw = rowValue(row, mapping, "vendorAnnualSpend");
  let vendorAnnualSpendMinor: number | undefined;
  if (vendorAnnualSpendRaw) {
    try {
      vendorAnnualSpendMinor = toCurrencyMinorUnits(vendorAnnualSpendRaw);
    } catch {
      errors.push({
        rowNumber,
        code: "validation",
        field: "vendorAnnualSpend",
        message: "vendorAnnualSpend must be a valid amount."
      });
    }
  }

  const serviceAnnualSpendRaw = rowValue(row, mapping, "serviceAnnualSpend");
  let serviceAnnualSpendMinor: number | undefined;
  if (serviceAnnualSpendRaw) {
    try {
      serviceAnnualSpendMinor = toCurrencyMinorUnits(serviceAnnualSpendRaw);
    } catch {
      errors.push({
        rowNumber,
        code: "validation",
        field: "serviceAnnualSpend",
        message: "serviceAnnualSpend must be a valid amount."
      });
    }
  }

  const vendorStatusRaw = rowValue(row, mapping, "vendorStatus").toLowerCase();
  const vendorRiskRaw = rowValue(row, mapping, "vendorRisk").toLowerCase();
  const serviceStatusRaw = rowValue(row, mapping, "serviceStatus").toLowerCase();
  const serviceRiskRaw = rowValue(row, mapping, "serviceRisk").toLowerCase();
  const serviceReplacementStatusRaw = rowValue(row, mapping, "serviceReplacementStatus").toLowerCase();
  const contractRenewalTypeRaw = rowValue(row, mapping, "contractRenewalType").toLowerCase();
  const contractLifecycleStatusRaw = rowValue(row, mapping, "contractLifecycleStatus").toLowerCase();
  const contractRenewalActionRaw = rowValue(row, mapping, "contractRenewalAction").toLowerCase();
  const expenseCapexOpexRaw = rowValue(row, mapping, "expenseCapexOpex").toLowerCase();

  const vendorStatus =
    vendorStatusRaw === "active" || vendorStatusRaw === "watch" || vendorStatusRaw === "archived"
      ? vendorStatusRaw
      : undefined;
  if (vendorStatusRaw && !vendorStatus) {
    errors.push({ rowNumber, code: "validation", field: "vendorStatus", message: "vendorStatus must be active, watch, or archived." });
  }

  const vendorRisk =
    vendorRiskRaw === "low" || vendorRiskRaw === "medium" || vendorRiskRaw === "high"
      ? vendorRiskRaw
      : undefined;
  if (vendorRiskRaw && !vendorRisk) {
    errors.push({ rowNumber, code: "validation", field: "vendorRisk", message: "vendorRisk must be low, medium, or high." });
  }

  const serviceStatus =
    serviceStatusRaw === "active" ||
    serviceStatusRaw === "trial" ||
    serviceStatusRaw === "deprecated" ||
    serviceStatusRaw === "retiring" ||
    serviceStatusRaw === "retired"
      ? serviceStatusRaw
      : undefined;
  if (serviceStatusRaw && !serviceStatus) {
    errors.push({ rowNumber, code: "validation", field: "serviceStatus", message: "serviceStatus is invalid." });
  }

  const serviceRisk =
    serviceRiskRaw === "low" || serviceRiskRaw === "medium" || serviceRiskRaw === "high"
      ? serviceRiskRaw
      : undefined;
  if (serviceRiskRaw && !serviceRisk) {
    errors.push({ rowNumber, code: "validation", field: "serviceRisk", message: "serviceRisk must be low, medium, or high." });
  }

  const serviceReplacementStatus =
    serviceReplacementStatusRaw === "not-started" ||
    serviceReplacementStatusRaw === "candidate-review" ||
    serviceReplacementStatusRaw === "approved"
      ? serviceReplacementStatusRaw
      : undefined;
  if (serviceReplacementStatusRaw && !serviceReplacementStatus) {
    errors.push({
      rowNumber,
      code: "validation",
      field: "serviceReplacementStatus",
      message: "serviceReplacementStatus is invalid."
    });
  }

  const contractPresent = [
    contractNumber,
    rowValue(row, mapping, "contractStartDate"),
    rowValue(row, mapping, "contractEndDate"),
    rowValue(row, mapping, "contractRenewalType"),
    rowValue(row, mapping, "contractRenewalDate"),
    rowValue(row, mapping, "contractNoticePeriodDays"),
    rowValue(row, mapping, "contractOwner"),
    rowValue(row, mapping, "contractLifecycleStatus"),
    rowValue(row, mapping, "contractRenewalAction")
  ].some((value) => value.length > 0);

  if (contractPresent && !contractNumber) {
    errors.push({
      rowNumber,
      code: "validation",
      field: "contractNumber",
      message: "contractNumber is required when contract data is present."
    });
  }

  const contractStartDate = rowValue(row, mapping, "contractStartDate");
  const contractEndDate = rowValue(row, mapping, "contractEndDate");
  const contractRenewalDate = rowValue(row, mapping, "contractRenewalDate");
  if (contractStartDate && !isIsoDate(contractStartDate)) {
    errors.push({ rowNumber, code: "validation", field: "contractStartDate", message: "contractStartDate must use YYYY-MM-DD format." });
  }
  if (contractEndDate && !isIsoDate(contractEndDate)) {
    errors.push({ rowNumber, code: "validation", field: "contractEndDate", message: "contractEndDate must use YYYY-MM-DD format." });
  }
  if (contractRenewalDate && !isIsoDate(contractRenewalDate)) {
    errors.push({ rowNumber, code: "validation", field: "contractRenewalDate", message: "contractRenewalDate must use YYYY-MM-DD format." });
  }

  const contractRenewalType =
    contractRenewalTypeRaw === "auto" ||
    contractRenewalTypeRaw === "manual" ||
    contractRenewalTypeRaw === "none"
      ? contractRenewalTypeRaw
      : undefined;
  if (contractRenewalTypeRaw && !contractRenewalType) {
    errors.push({ rowNumber, code: "validation", field: "contractRenewalType", message: "contractRenewalType must be auto, manual, or none." });
  }

  const contractLifecycleStatus =
    contractLifecycleStatusRaw === "active" ||
    contractLifecycleStatusRaw === "renewal-window" ||
    contractLifecycleStatusRaw === "notice-window" ||
    contractLifecycleStatusRaw === "expired"
      ? contractLifecycleStatusRaw
      : undefined;
  if (contractLifecycleStatusRaw && !contractLifecycleStatus) {
    errors.push({ rowNumber, code: "validation", field: "contractLifecycleStatus", message: "contractLifecycleStatus is invalid." });
  }

  const contractRenewalAction =
    contractRenewalActionRaw === "auto-renew" ||
    contractRenewalActionRaw === "manual-review" ||
    contractRenewalActionRaw === "cancel-window"
      ? contractRenewalActionRaw
      : undefined;
  if (contractRenewalActionRaw && !contractRenewalAction) {
    errors.push({ rowNumber, code: "validation", field: "contractRenewalAction", message: "contractRenewalAction is invalid." });
  }

  const contractNoticePeriodDaysRaw = rowValue(row, mapping, "contractNoticePeriodDays");
  const contractNoticePeriodDays = contractNoticePeriodDaysRaw ? parseIntStrict(contractNoticePeriodDaysRaw) : null;
  if (contractNoticePeriodDaysRaw && (contractNoticePeriodDays === null || contractNoticePeriodDays < 0)) {
    errors.push({
      rowNumber,
      code: "validation",
      field: "contractNoticePeriodDays",
      message: "contractNoticePeriodDays must be a non-negative integer."
    });
  }

  const expensePresent = [
    expenseName,
    expenseTypeRaw,
    expenseStatusRaw,
    expenseAmountRaw,
    rowValue(row, mapping, "expenseStartDate"),
    rowValue(row, mapping, "expenseEndDate"),
    rowValue(row, mapping, "expenseFrequency"),
    rowValue(row, mapping, "expenseCapexOpex")
  ].some((value) => value.length > 0);

  let expenseType: ExpenseType | undefined;
  let expenseStatus: ExpenseStatus | undefined;
  let expenseAmountMinor: number | undefined;
  if (expensePresent) {
    if (!expenseName) {
      errors.push({ rowNumber, code: "validation", field: "expenseName", message: "expenseName is required when expense data is present." });
    }
    expenseType = expenseTypeRaw === "recurring" || expenseTypeRaw === "one_time" ? expenseTypeRaw : undefined;
    if (!expenseType) {
      errors.push({ rowNumber, code: "validation", field: "expenseType", message: "expenseType must be recurring or one_time." });
    }
    expenseStatus =
      expenseStatusRaw === "planned" ||
      expenseStatusRaw === "approved" ||
      expenseStatusRaw === "committed" ||
      expenseStatusRaw === "actual" ||
      expenseStatusRaw === "cancelled"
        ? expenseStatusRaw
        : undefined;
    if (!expenseStatus) {
      errors.push({ rowNumber, code: "validation", field: "expenseStatus", message: "expenseStatus is invalid." });
    }
    try {
      expenseAmountMinor = toCurrencyMinorUnits(expenseAmountRaw);
    } catch {
      errors.push({ rowNumber, code: "validation", field: "expenseAmount", message: "expenseAmount must be a valid amount." });
    }
    if (!/^[A-Z]{3}$/.test(expenseCurrency)) {
      errors.push({ rowNumber, code: "validation", field: "expenseCurrency", message: "expenseCurrency must be a valid ISO 4217 code." });
    }
  }

  const expenseStartDate = rowValue(row, mapping, "expenseStartDate");
  const expenseEndDate = rowValue(row, mapping, "expenseEndDate");
  if (expenseStartDate && !isIsoDate(expenseStartDate)) {
    errors.push({ rowNumber, code: "validation", field: "expenseStartDate", message: "expenseStartDate must use YYYY-MM-DD format." });
  }
  if (expenseEndDate && !isIsoDate(expenseEndDate)) {
    errors.push({ rowNumber, code: "validation", field: "expenseEndDate", message: "expenseEndDate must use YYYY-MM-DD format." });
  }

  const expenseCapexOpex =
    expenseCapexOpexRaw === "capex" || expenseCapexOpexRaw === "opex" ? expenseCapexOpexRaw : undefined;
  if (expenseCapexOpexRaw && !expenseCapexOpex) {
    errors.push({ rowNumber, code: "validation", field: "expenseCapexOpex", message: "expenseCapexOpex must be capex or opex." });
  }

  const expenseFrequencyRaw = rowValue(row, mapping, "expenseFrequency").toLowerCase();
  const expenseIntervalRaw = rowValue(row, mapping, "expenseInterval");
  const expenseDayOfMonthRaw = rowValue(row, mapping, "expenseDayOfMonth");
  const expenseMonthOfYearRaw = rowValue(row, mapping, "expenseMonthOfYear");
  const expenseAnchorDate = rowValue(row, mapping, "expenseAnchorDate");
  let recurrence:
    | {
        frequency: RecurrenceFrequency;
        interval: number;
        dayOfMonth: number;
        monthOfYear?: number;
        anchorDate?: string;
      }
    | undefined;
  if (expenseType === "recurring") {
    const frequency =
      expenseFrequencyRaw === "monthly" ||
      expenseFrequencyRaw === "quarterly" ||
      expenseFrequencyRaw === "yearly"
        ? expenseFrequencyRaw
        : undefined;
    if (!frequency) {
      errors.push({ rowNumber, code: "validation", field: "expenseFrequency", message: "expenseFrequency is required for recurring expenses." });
    }
    const interval = expenseIntervalRaw ? parseIntStrict(expenseIntervalRaw) : 1;
    if (interval === null || interval <= 0) {
      errors.push({ rowNumber, code: "validation", field: "expenseInterval", message: "expenseInterval must be a positive integer." });
    }
    const dayOfMonth = parseIntStrict(expenseDayOfMonthRaw);
    if (dayOfMonth === null || dayOfMonth < 1 || dayOfMonth > 31) {
      errors.push({ rowNumber, code: "validation", field: "expenseDayOfMonth", message: "expenseDayOfMonth must be between 1 and 31." });
    }
    const monthOfYear = expenseMonthOfYearRaw ? parseIntStrict(expenseMonthOfYearRaw) : null;
    if (frequency === "yearly" && (monthOfYear === null || monthOfYear < 1 || monthOfYear > 12)) {
      errors.push({ rowNumber, code: "validation", field: "expenseMonthOfYear", message: "expenseMonthOfYear is required for yearly recurrence." });
    }
    if (monthOfYear !== null && (monthOfYear < 1 || monthOfYear > 12)) {
      errors.push({ rowNumber, code: "validation", field: "expenseMonthOfYear", message: "expenseMonthOfYear must be between 1 and 12." });
    }
    if (expenseAnchorDate && !isIsoDate(expenseAnchorDate)) {
      errors.push({ rowNumber, code: "validation", field: "expenseAnchorDate", message: "expenseAnchorDate must use YYYY-MM-DD format." });
    }
    if (frequency && interval !== null && dayOfMonth !== null) {
      recurrence = {
        frequency,
        interval,
        dayOfMonth,
        monthOfYear: monthOfYear ?? undefined,
        anchorDate: expenseAnchorDate || undefined
      };
    }
  }

  if (errors.length > 0) {
    return { errors };
  }

  return {
    value: {
      rowNumber,
      fingerprint: buildRowFingerprint({
        scenarioId,
        vendorName,
        serviceName,
        contractNumber: contractNumber || undefined,
        expenseName: expenseName || undefined,
        expenseType,
        expenseStatus,
        expenseAmount: expenseAmountRaw || undefined,
        startDate: expenseStartDate || contractStartDate || undefined,
        endDate: expenseEndDate || contractEndDate || undefined
      }),
      scenarioId,
      vendor: {
        name: vendorName,
        website: rowValue(row, mapping, "vendorWebsite") || undefined,
        notes: rowValue(row, mapping, "vendorNotes") || undefined,
        owner: rowValue(row, mapping, "vendorOwner") || undefined,
        annualSpendMinor: vendorAnnualSpendMinor,
        status: vendorStatus,
        risk: vendorRisk
      },
      service: {
        name: serviceName,
        owner: rowValue(row, mapping, "serviceOwner") || undefined,
        annualSpendMinor: serviceAnnualSpendMinor,
        status: serviceStatus,
        risk: serviceRisk,
        replacementStatus: serviceReplacementStatus
      },
      contract: contractPresent
        ? {
            contractNumber,
            startDate: contractStartDate || undefined,
            endDate: contractEndDate || undefined,
            renewalType: contractRenewalType,
            renewalDate: contractRenewalDate || undefined,
            noticePeriodDays: contractNoticePeriodDays ?? undefined,
            owner: rowValue(row, mapping, "contractOwner") || undefined,
            lifecycleStatus: contractLifecycleStatus,
            renewalAction: contractRenewalAction
          }
        : undefined,
      expense:
        expensePresent && expenseType && expenseStatus && expenseAmountMinor !== undefined
          ? {
              name: expenseName,
              expenseType,
              status: expenseStatus,
              amountMinor: expenseAmountMinor,
              currency: expenseCurrency,
              startDate: expenseStartDate || undefined,
              endDate: expenseEndDate || undefined,
              recurrence,
              capexOpex: expenseCapexOpex,
              glAccountCode: rowValue(row, mapping, "expenseGlAccountCode") || undefined,
              costCenterCode: rowValue(row, mapping, "expenseCostCenterCode") || undefined,
              fundingSource: rowValue(row, mapping, "expenseFundingSource") || undefined
            }
          : undefined
    },
    errors: []
  };
}

function cloneState(state: ImportState): ImportState {
  return {
    vendorByKey: new Map(state.vendorByKey),
    serviceByKey: new Map(state.serviceByKey),
    contractByKey: new Map(state.contractByKey),
    expenseByKey: new Map(state.expenseByKey)
  };
}

function vendorKey(name: string): string {
  return normalizeLookupToken(name);
}

function serviceKey(vendorId: string, serviceName: string): string {
  return `${vendorId}|${normalizeLookupToken(serviceName)}`;
}

function contractKey(serviceId: string, contractNumber: string): string {
  return `${serviceId}|${normalizeLookupToken(contractNumber)}`;
}

function expenseKey(input: {
  scenarioId: string;
  serviceId: string;
  contractId: string | null;
  name: string;
  expenseType: ExpenseType;
  startDate?: string;
  endDate?: string;
}): string {
  return [
    input.scenarioId,
    input.serviceId,
    input.contractId ?? "",
    normalizeLookupToken(input.name),
    input.expenseType,
    input.startDate ?? "",
    input.endDate ?? ""
  ].join("|");
}

function loadImportState(db: Database.Database): ImportState {
  const vendorByKey = new Map<string, VendorState>();
  const vendorRows = db
    .prepare(
      `
        SELECT
          id,
          name,
          website,
          notes,
          owner,
          annual_spend_minor AS annualSpendMinor,
          status,
          risk
        FROM vendor
        WHERE deleted_at IS NULL
      `
    )
    .all() as VendorState[];
  for (const row of vendorRows) {
    vendorByKey.set(vendorKey(row.name), row);
  }

  const serviceByKey = new Map<string, ServiceState>();
  const serviceRows = db
    .prepare(
      `
        SELECT
          id,
          vendor_id AS vendorId,
          name,
          owner_team AS ownerTeam,
          annual_spend_minor AS annualSpendMinor,
          status,
          risk,
          replacement_status AS replacementStatus
        FROM service
        WHERE deleted_at IS NULL
      `
    )
    .all() as ServiceState[];
  for (const row of serviceRows) {
    serviceByKey.set(serviceKey(row.vendorId, row.name), row);
  }

  const contractByKey = new Map<string, ContractState>();
  const contractRows = db
    .prepare(
      `
        SELECT
          id,
          service_id AS serviceId,
          contract_number AS contractNumber,
          start_date AS startDate,
          end_date AS endDate,
          renewal_type AS renewalType,
          renewal_date AS renewalDate,
          notice_period_days AS noticePeriodDays,
          owner,
          lifecycle_status AS lifecycleStatus,
          renewal_action AS renewalAction
        FROM contract
        WHERE deleted_at IS NULL
          AND contract_number IS NOT NULL
      `
    )
    .all() as ContractState[];
  for (const row of contractRows) {
    contractByKey.set(contractKey(row.serviceId, row.contractNumber), row);
  }

  const expenseByKey = new Map<string, ExpenseState>();
  const expenseRows = db
    .prepare(
      `
        SELECT
          e.id,
          e.scenario_id AS scenarioId,
          e.service_id AS serviceId,
          e.contract_id AS contractId,
          e.name,
          e.expense_type AS expenseType,
          e.status,
          e.amount_minor AS amountMinor,
          e.currency,
          e.start_date AS startDate,
          e.end_date AS endDate,
          e.capex_opex AS capexOpex,
          e.gl_account_code AS glAccountCode,
          e.cost_center_code AS costCenterCode,
          e.funding_source AS fundingSource,
          r.id AS recurrenceId,
          r.frequency,
          r.interval,
          r.day_of_month AS dayOfMonth,
          r.month_of_year AS monthOfYear,
          r.anchor_date AS anchorDate
        FROM expense_line e
        LEFT JOIN recurrence_rule r ON r.expense_line_id = e.id
        WHERE e.deleted_at IS NULL
      `
    )
    .all() as Array<
    Omit<ExpenseState, "recurrence"> & {
      recurrenceId: string | null;
      frequency: RecurrenceFrequency | null;
      interval: number | null;
      dayOfMonth: number | null;
      monthOfYear: number | null;
      anchorDate: string | null;
    }
  >;
  for (const row of expenseRows) {
    const recurrence =
      row.frequency && row.interval && row.dayOfMonth
        ? {
            id: row.recurrenceId ?? undefined,
            frequency: row.frequency,
            interval: row.interval,
            dayOfMonth: row.dayOfMonth,
            monthOfYear: row.monthOfYear,
            anchorDate: row.anchorDate
          }
        : null;
    expenseByKey.set(
      expenseKey({
        scenarioId: row.scenarioId,
        serviceId: row.serviceId,
        contractId: row.contractId,
        name: row.name,
        expenseType: row.expenseType,
        startDate: row.startDate ?? undefined,
        endDate: row.endDate ?? undefined
      }),
      {
        id: row.id,
        scenarioId: row.scenarioId,
        serviceId: row.serviceId,
        contractId: row.contractId,
        name: row.name,
        expenseType: row.expenseType,
        status: row.status,
        amountMinor: row.amountMinor,
        currency: row.currency,
        startDate: row.startDate,
        endDate: row.endDate,
        capexOpex: row.capexOpex,
        glAccountCode: row.glAccountCode,
        costCenterCode: row.costCenterCode,
        fundingSource: row.fundingSource,
        recurrence
      }
    );
  }

  return { vendorByKey, serviceByKey, contractByKey, expenseByKey };
}

function vendorEquals(left: VendorState, right: VendorState): boolean {
  return (
    left.name === right.name &&
    left.website === right.website &&
    left.notes === right.notes &&
    left.owner === right.owner &&
    left.annualSpendMinor === right.annualSpendMinor &&
    left.status === right.status &&
    left.risk === right.risk
  );
}

function serviceEquals(left: ServiceState, right: ServiceState): boolean {
  return (
    left.vendorId === right.vendorId &&
    left.name === right.name &&
    left.ownerTeam === right.ownerTeam &&
    left.annualSpendMinor === right.annualSpendMinor &&
    left.status === right.status &&
    left.risk === right.risk &&
    left.replacementStatus === right.replacementStatus
  );
}

function contractEquals(left: ContractState, right: ContractState): boolean {
  return (
    left.serviceId === right.serviceId &&
    left.contractNumber === right.contractNumber &&
    left.startDate === right.startDate &&
    left.endDate === right.endDate &&
    left.renewalType === right.renewalType &&
    left.renewalDate === right.renewalDate &&
    left.noticePeriodDays === right.noticePeriodDays &&
    left.owner === right.owner &&
    left.lifecycleStatus === right.lifecycleStatus &&
    left.renewalAction === right.renewalAction
  );
}

function recurrenceEquals(left: ExpenseState["recurrence"], right: ExpenseState["recurrence"]): boolean {
  if (left === null || right === null) {
    return left === right;
  }
  return (
    left.frequency === right.frequency &&
    left.interval === right.interval &&
    left.dayOfMonth === right.dayOfMonth &&
    left.monthOfYear === right.monthOfYear &&
    left.anchorDate === right.anchorDate
  );
}

function expenseEquals(left: ExpenseState, right: ExpenseState): boolean {
  return (
    left.scenarioId === right.scenarioId &&
    left.serviceId === right.serviceId &&
    left.contractId === right.contractId &&
    left.name === right.name &&
    left.expenseType === right.expenseType &&
    left.status === right.status &&
    left.amountMinor === right.amountMinor &&
    left.currency === right.currency &&
    left.startDate === right.startDate &&
    left.endDate === right.endDate &&
    left.capexOpex === right.capexOpex &&
    left.glAccountCode === right.glAccountCode &&
    left.costCenterCode === right.costCenterCode &&
    left.fundingSource === right.fundingSource &&
    recurrenceEquals(left.recurrence, right.recurrence)
  );
}

function incrementEntityCount(
  counts: BaselineEntityCounts,
  entity: keyof BaselineEntityCounts,
  action: "create" | "update" | "noop" | "n/a"
): void {
  if (action === "n/a") {
    return;
  }
  if (action === "create") {
    counts[entity].created += 1;
  } else if (action === "update") {
    counts[entity].updated += 1;
  } else {
    counts[entity].unchanged += 1;
  }
}

function stageVendor(
  state: ImportState,
  row: BaselineImportRow
): { entity: VendorState; action: "create" | "update" | "noop" } {
  const key = vendorKey(row.vendor.name);
  const existing = state.vendorByKey.get(key);
  const desired: VendorState = {
    id: existing?.id ?? `pending-vendor-${key}`,
    name: row.vendor.name,
    website: row.vendor.website ?? existing?.website ?? null,
    notes: row.vendor.notes ?? existing?.notes ?? null,
    owner: row.vendor.owner ?? existing?.owner ?? null,
    annualSpendMinor: row.vendor.annualSpendMinor ?? existing?.annualSpendMinor ?? 0,
    status: row.vendor.status ?? existing?.status ?? "active",
    risk: row.vendor.risk ?? existing?.risk ?? "low"
  };
  const action = existing ? (vendorEquals(existing, desired) ? "noop" : "update") : "create";
  state.vendorByKey.set(key, desired);
  return { entity: desired, action };
}

function stageService(
  state: ImportState,
  row: BaselineImportRow,
  vendorId: string
): { entity: ServiceState; action: "create" | "update" | "noop" } {
  const key = serviceKey(vendorId, row.service.name);
  const existing = state.serviceByKey.get(key);
  const desired: ServiceState = {
    id: existing?.id ?? `pending-service-${key}`,
    vendorId,
    name: row.service.name,
    ownerTeam: row.service.owner ?? existing?.ownerTeam ?? null,
    annualSpendMinor: row.service.annualSpendMinor ?? existing?.annualSpendMinor ?? 0,
    status: row.service.status ?? existing?.status ?? "active",
    risk: row.service.risk ?? existing?.risk ?? "low",
    replacementStatus: row.service.replacementStatus ?? existing?.replacementStatus ?? "not-started"
  };
  const action = existing ? (serviceEquals(existing, desired) ? "noop" : "update") : "create";
  state.serviceByKey.set(key, desired);
  return { entity: desired, action };
}

function stageContract(
  state: ImportState,
  row: BaselineImportRow,
  serviceId: string
): { entity?: ContractState; action: "create" | "update" | "noop" | "n/a" } {
  if (!row.contract) {
    return { action: "n/a" };
  }
  const key = contractKey(serviceId, row.contract.contractNumber);
  const existing = state.contractByKey.get(key);
  const desired: ContractState = {
    id: existing?.id ?? `pending-contract-${key}`,
    serviceId,
    contractNumber: row.contract.contractNumber,
    startDate: row.contract.startDate ?? existing?.startDate ?? null,
    endDate: row.contract.endDate ?? existing?.endDate ?? null,
    renewalType: row.contract.renewalType ?? existing?.renewalType ?? null,
    renewalDate: row.contract.renewalDate ?? existing?.renewalDate ?? null,
    noticePeriodDays: row.contract.noticePeriodDays ?? existing?.noticePeriodDays ?? null,
    owner: row.contract.owner ?? existing?.owner ?? null,
    lifecycleStatus: row.contract.lifecycleStatus ?? existing?.lifecycleStatus ?? "active",
    renewalAction: row.contract.renewalAction ?? existing?.renewalAction ?? "manual-review"
  };
  const action = existing ? (contractEquals(existing, desired) ? "noop" : "update") : "create";
  state.contractByKey.set(key, desired);
  return { entity: desired, action };
}

function stageExpense(
  state: ImportState,
  row: BaselineImportRow,
  serviceId: string,
  contractId: string | null
): { entity?: ExpenseState; action: "create" | "update" | "noop" | "n/a" } {
  if (!row.expense) {
    return { action: "n/a" };
  }
  const key = expenseKey({
    scenarioId: row.scenarioId,
    serviceId,
    contractId,
    name: row.expense.name,
    expenseType: row.expense.expenseType,
    startDate: row.expense.startDate,
    endDate: row.expense.endDate
  });
  const existing = state.expenseByKey.get(key);
  const desired: ExpenseState = {
    id: existing?.id ?? `pending-expense-${key}`,
    scenarioId: row.scenarioId,
    serviceId,
    contractId,
    name: row.expense.name,
    expenseType: row.expense.expenseType,
    status: row.expense.status,
    amountMinor: row.expense.amountMinor,
    currency: row.expense.currency,
    startDate: row.expense.startDate ?? existing?.startDate ?? null,
    endDate: row.expense.endDate ?? existing?.endDate ?? null,
    capexOpex: row.expense.capexOpex ?? existing?.capexOpex ?? null,
    glAccountCode: row.expense.glAccountCode ?? existing?.glAccountCode ?? null,
    costCenterCode: row.expense.costCenterCode ?? existing?.costCenterCode ?? null,
    fundingSource: row.expense.fundingSource ?? existing?.fundingSource ?? null,
    recurrence: row.expense.recurrence
      ? {
          frequency: row.expense.recurrence.frequency,
          interval: row.expense.recurrence.interval,
          dayOfMonth: row.expense.recurrence.dayOfMonth,
          monthOfYear: row.expense.recurrence.monthOfYear ?? null,
          anchorDate: row.expense.recurrence.anchorDate ?? null
        }
      : existing?.recurrence ?? null
  };
  const action = existing ? (expenseEquals(existing, desired) ? "noop" : "update") : "create";
  state.expenseByKey.set(key, desired);
  return { entity: desired, action };
}

function validateRows(
  rows: Record<string, string>[],
  mapping: BaselineImportColumnMapping,
  baseState: ImportState
): {
  acceptedRows: BaselineImportRow[];
  rowSummaries: BaselineImportRowSummary[];
  errors: BaselineImportRowError[];
  duplicateCount: number;
  entityCounts: BaselineEntityCounts;
} {
  const acceptedRows: BaselineImportRow[] = [];
  const rowSummaries: BaselineImportRowSummary[] = [];
  const errors: BaselineImportRowError[] = [];
  const seenFingerprints = new Set<string>();
  const counts = createEmptyEntityCounts();
  const state = cloneState(baseState);
  let duplicateCount = 0;

  for (let index = 0; index < rows.length; index += 1) {
    const rowNumber = index + 2;
    const normalized = normalizeRow(rows[index], rowNumber, mapping);
    if (!normalized.value) {
      errors.push(...normalized.errors);
      continue;
    }
    if (seenFingerprints.has(normalized.value.fingerprint)) {
      duplicateCount += 1;
      errors.push({
        rowNumber,
        code: "duplicate",
        field: "row",
        message: "Duplicate baseline row skipped by deterministic fingerprint."
      });
      continue;
    }
    seenFingerprints.add(normalized.value.fingerprint);

    const vendorStage = stageVendor(state, normalized.value);
    const serviceStage = stageService(state, normalized.value, vendorStage.entity.id);
    const contractStage = stageContract(state, normalized.value, serviceStage.entity.id);
    const expenseStage = stageExpense(
      state,
      normalized.value,
      serviceStage.entity.id,
      contractStage.entity?.id ?? null
    );

    incrementEntityCount(counts, "vendors", vendorStage.action);
    incrementEntityCount(counts, "services", serviceStage.action);
    incrementEntityCount(counts, "contracts", contractStage.action);
    incrementEntityCount(counts, "expenses", expenseStage.action);

    acceptedRows.push(normalized.value);
    rowSummaries.push({
      rowNumber,
      scenarioId: normalized.value.scenarioId,
      vendorName: normalized.value.vendor.name,
      serviceName: normalized.value.service.name,
      contractNumber: normalized.value.contract?.contractNumber ?? null,
      expenseName: normalized.value.expense?.name ?? null,
      actions: {
        vendor: vendorStage.action,
        service: serviceStage.action,
        contract: contractStage.action,
        expense: expenseStage.action
      }
    });
  }

  return {
    acceptedRows,
    rowSummaries,
    errors,
    duplicateCount,
    entityCounts: counts
  };
}

function upsertVendor(
  repo: BudgetCrudRepository,
  currentState: ImportState,
  row: BaselineImportRow
): { entity: VendorState; action: "create" | "update" | "noop" } {
  const key = vendorKey(row.vendor.name);
  const existing = currentState.vendorByKey.get(key);
  const desired: VendorState = {
    id: existing?.id ?? "",
    name: row.vendor.name,
    website: row.vendor.website ?? existing?.website ?? null,
    notes: row.vendor.notes ?? existing?.notes ?? null,
    owner: row.vendor.owner ?? existing?.owner ?? null,
    annualSpendMinor: row.vendor.annualSpendMinor ?? existing?.annualSpendMinor ?? 0,
    status: row.vendor.status ?? existing?.status ?? "active",
    risk: row.vendor.risk ?? existing?.risk ?? "low"
  };
  if (!existing) {
    const id = repo.createVendor({
      name: desired.name,
      website: desired.website ?? undefined,
      notes: desired.notes ?? undefined,
      owner: desired.owner ?? undefined,
      annualSpendMinor: desired.annualSpendMinor,
      status: desired.status,
      risk: desired.risk
    });
    return { entity: { ...desired, id }, action: "create" };
  }
  desired.id = existing.id;
  if (vendorEquals(existing, desired)) {
    return { entity: desired, action: "noop" };
  }
  repo.updateVendor(existing.id, {
    name: desired.name,
    website: desired.website ?? undefined,
    notes: desired.notes ?? undefined,
    owner: desired.owner ?? undefined,
    annualSpendMinor: desired.annualSpendMinor,
    status: desired.status,
    risk: desired.risk
  });
  return { entity: desired, action: "update" };
}

function upsertService(
  repo: BudgetCrudRepository,
  currentState: ImportState,
  row: BaselineImportRow,
  vendorId: string
): { entity: ServiceState; action: "create" | "update" | "noop" } {
  const key = serviceKey(vendorId, row.service.name);
  const existing = currentState.serviceByKey.get(key);
  const desired: ServiceState = {
    id: existing?.id ?? "",
    vendorId,
    name: row.service.name,
    ownerTeam: row.service.owner ?? existing?.ownerTeam ?? null,
    annualSpendMinor: row.service.annualSpendMinor ?? existing?.annualSpendMinor ?? 0,
    status: row.service.status ?? existing?.status ?? "active",
    risk: row.service.risk ?? existing?.risk ?? "low",
    replacementStatus: row.service.replacementStatus ?? existing?.replacementStatus ?? "not-started"
  };
  if (!existing) {
    const id = repo.createService({
      vendorId,
      name: desired.name,
      ownerTeam: desired.ownerTeam ?? undefined,
      annualSpendMinor: desired.annualSpendMinor,
      status: desired.status,
      risk: desired.risk,
      replacementStatus: desired.replacementStatus
    });
    return { entity: { ...desired, id }, action: "create" };
  }
  desired.id = existing.id;
  if (serviceEquals(existing, desired)) {
    return { entity: desired, action: "noop" };
  }
  repo.updateService(existing.id, {
    vendorId,
    name: desired.name,
    ownerTeam: desired.ownerTeam ?? undefined,
    annualSpendMinor: desired.annualSpendMinor,
    status: desired.status,
    risk: desired.risk,
    replacementStatus: desired.replacementStatus
  });
  return { entity: desired, action: "update" };
}

function upsertContract(
  repo: BudgetCrudRepository,
  currentState: ImportState,
  row: BaselineImportRow,
  serviceId: string
): { entity?: ContractState; action: "create" | "update" | "noop" | "n/a" } {
  if (!row.contract) {
    return { action: "n/a" };
  }
  const key = contractKey(serviceId, row.contract.contractNumber);
  const existing = currentState.contractByKey.get(key);
  const desired: ContractState = {
    id: existing?.id ?? "",
    serviceId,
    contractNumber: row.contract.contractNumber,
    startDate: row.contract.startDate ?? existing?.startDate ?? null,
    endDate: row.contract.endDate ?? existing?.endDate ?? null,
    renewalType: row.contract.renewalType ?? existing?.renewalType ?? null,
    renewalDate: row.contract.renewalDate ?? existing?.renewalDate ?? null,
    noticePeriodDays: row.contract.noticePeriodDays ?? existing?.noticePeriodDays ?? null,
    owner: row.contract.owner ?? existing?.owner ?? null,
    lifecycleStatus: row.contract.lifecycleStatus ?? existing?.lifecycleStatus ?? "active",
    renewalAction: row.contract.renewalAction ?? existing?.renewalAction ?? "manual-review"
  };
  if (!existing) {
    const id = repo.createContract({
      serviceId,
      contractNumber: desired.contractNumber,
      startDate: desired.startDate ?? undefined,
      endDate: desired.endDate ?? undefined,
      renewalType: desired.renewalType ?? undefined,
      renewalDate: desired.renewalDate ?? undefined,
      noticePeriodDays: desired.noticePeriodDays ?? undefined,
      owner: desired.owner ?? undefined,
      lifecycleStatus: desired.lifecycleStatus,
      renewalAction: desired.renewalAction
    });
    return { entity: { ...desired, id }, action: "create" };
  }
  desired.id = existing.id;
  if (contractEquals(existing, desired)) {
    return { entity: desired, action: "noop" };
  }
  repo.updateContract(existing.id, {
    serviceId,
    contractNumber: desired.contractNumber,
    startDate: desired.startDate ?? undefined,
    endDate: desired.endDate ?? undefined,
    renewalType: desired.renewalType ?? undefined,
    renewalDate: desired.renewalDate ?? undefined,
    noticePeriodDays: desired.noticePeriodDays ?? undefined,
    owner: desired.owner ?? undefined,
    lifecycleStatus: desired.lifecycleStatus,
    renewalAction: desired.renewalAction
  });
  return { entity: desired, action: "update" };
}

function upsertExpense(
  repo: BudgetCrudRepository,
  currentState: ImportState,
  row: BaselineImportRow,
  serviceId: string,
  contractId: string | null
): { entity?: ExpenseState; action: "create" | "update" | "noop" | "n/a" } {
  if (!row.expense) {
    return { action: "n/a" };
  }
  const key = expenseKey({
    scenarioId: row.scenarioId,
    serviceId,
    contractId,
    name: row.expense.name,
    expenseType: row.expense.expenseType,
    startDate: row.expense.startDate,
    endDate: row.expense.endDate
  });
  const existing = currentState.expenseByKey.get(key);
  const desired: ExpenseState = {
    id: existing?.id ?? "",
    scenarioId: row.scenarioId,
    serviceId,
    contractId,
    name: row.expense.name,
    expenseType: row.expense.expenseType,
    status: row.expense.status,
    amountMinor: row.expense.amountMinor,
    currency: row.expense.currency,
    startDate: row.expense.startDate ?? existing?.startDate ?? null,
    endDate: row.expense.endDate ?? existing?.endDate ?? null,
    capexOpex: row.expense.capexOpex ?? existing?.capexOpex ?? null,
    glAccountCode: row.expense.glAccountCode ?? existing?.glAccountCode ?? null,
    costCenterCode: row.expense.costCenterCode ?? existing?.costCenterCode ?? null,
    fundingSource: row.expense.fundingSource ?? existing?.fundingSource ?? null,
    recurrence: row.expense.recurrence
      ? {
          frequency: row.expense.recurrence.frequency,
          interval: row.expense.recurrence.interval,
          dayOfMonth: row.expense.recurrence.dayOfMonth,
          monthOfYear: row.expense.recurrence.monthOfYear ?? null,
          anchorDate: row.expense.recurrence.anchorDate ?? null
        }
      : existing?.recurrence ?? null
  };
  if (!existing) {
    const id = repo.createExpenseLineWithOptionalRecurrence(
      {
        scenarioId: desired.scenarioId,
        serviceId,
        contractId,
        name: desired.name,
        expenseType: desired.expenseType,
        status: desired.status,
        amountMinor: desired.amountMinor,
        currency: desired.currency,
        capexOpex: desired.capexOpex,
        glAccountCode: desired.glAccountCode,
        costCenterCode: desired.costCenterCode,
        fundingSource: desired.fundingSource,
        startDate: desired.startDate ?? undefined,
        endDate: desired.endDate
      },
      desired.recurrence
        ? {
            expenseLineId: "baseline-import",
            frequency: desired.recurrence.frequency,
            interval: desired.recurrence.interval,
            dayOfMonth: desired.recurrence.dayOfMonth,
            monthOfYear: desired.recurrence.monthOfYear ?? undefined,
            anchorDate: desired.recurrence.anchorDate ?? undefined
          }
        : undefined
    );
    repo.assertRequiredDimensionsSatisfied("expense_line", id);
    return { entity: { ...desired, id }, action: "create" };
  }
  desired.id = existing.id;
  if (expenseEquals(existing, desired)) {
    return { entity: desired, action: "noop" };
  }
  repo.updateExpenseLine(existing.id, {
    scenarioId: desired.scenarioId,
    serviceId,
    contractId,
    name: desired.name,
    expenseType: desired.expenseType,
    status: desired.status,
    amountMinor: desired.amountMinor,
    currency: desired.currency,
    capexOpex: desired.capexOpex,
    glAccountCode: desired.glAccountCode,
    costCenterCode: desired.costCenterCode,
    fundingSource: desired.fundingSource,
    startDate: desired.startDate ?? undefined,
    endDate: desired.endDate
  });
  if (existing.recurrence?.id && !desired.recurrence) {
    repo.deleteRecurrenceRule(existing.recurrence.id);
  } else if (!existing.recurrence && desired.recurrence) {
    repo.createRecurrenceRule({
      expenseLineId: existing.id,
      frequency: desired.recurrence.frequency,
      interval: desired.recurrence.interval,
      dayOfMonth: desired.recurrence.dayOfMonth,
      monthOfYear: desired.recurrence.monthOfYear ?? undefined,
      anchorDate: desired.recurrence.anchorDate ?? undefined
    });
  } else if (existing.recurrence?.id && desired.recurrence) {
    repo.updateRecurrenceRule(existing.recurrence.id, {
      expenseLineId: existing.id,
      frequency: desired.recurrence.frequency,
      interval: desired.recurrence.interval,
      dayOfMonth: desired.recurrence.dayOfMonth,
      monthOfYear: desired.recurrence.monthOfYear ?? undefined,
      anchorDate: desired.recurrence.anchorDate ?? undefined
    });
  }
  repo.assertRequiredDimensionsSatisfied("expense_line", existing.id);
  return { entity: desired, action: "update" };
}

export function getBaselineImportFields(): readonly BaselineImportField[] {
  return Array.from(BASELINE_IMPORT_FIELDS);
}

export function previewBaselineImport(
  db: Database.Database,
  input: BaselineImportPreviewInput
): BaselineImportPreviewResult {
  const { headers, rows } = readImportRows(input.filePath);
  const mapping = buildAutoMapping(headers, input.mapping);
  const state = loadImportState(db);
  const validated = validateRows(rows, mapping, state);
  return {
    totalRows: rows.length,
    acceptedCount: validated.acceptedRows.length,
    rejectedCount: validated.errors.length,
    duplicateCount: validated.duplicateCount,
    templateApplied: null,
    templateSaved: null,
    errors: validated.errors,
    rowSummaries: validated.rowSummaries,
    entityCounts: validated.entityCounts
  };
}

export function commitBaselineImport(
  db: Database.Database,
  input: BaselineImportPreviewInput
): BaselineImportCommitResult {
  const { headers, rows } = readImportRows(input.filePath);
  const mapping = buildAutoMapping(headers, input.mapping);
  const validated = validateRows(rows, mapping, loadImportState(db));
  const repo = new BudgetCrudRepository(db);
  const errors = [...validated.errors];
  const entityCounts = createEmptyEntityCounts();
  let insertedCount = 0;

  for (const row of validated.acceptedRows) {
    try {
      db.transaction(() => {
        const state = loadImportState(db);
        const vendorResult = upsertVendor(repo, state, row);
        const serviceState = loadImportState(db);
        const serviceResult = upsertService(repo, serviceState, row, vendorResult.entity.id);
        const contractState = loadImportState(db);
        const contractResult = upsertContract(repo, contractState, row, serviceResult.entity.id);
        const expenseState = loadImportState(db);
        const expenseResult = upsertExpense(
          repo,
          expenseState,
          row,
          serviceResult.entity.id,
          contractResult.entity?.id ?? null
        );
        incrementEntityCount(entityCounts, "vendors", vendorResult.action);
        incrementEntityCount(entityCounts, "services", serviceResult.action);
        incrementEntityCount(entityCounts, "contracts", contractResult.action);
        incrementEntityCount(entityCounts, "expenses", expenseResult.action);
      })();
      insertedCount += 1;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      errors.push({
        rowNumber: row.rowNumber,
        code: "validation",
        field: "row",
        message: detail
      });
    }
  }

  return {
    totalRows: rows.length,
    acceptedCount: insertedCount,
    rejectedCount: errors.length,
    duplicateCount: validated.duplicateCount,
    templateApplied: null,
    templateSaved: null,
    errors,
    rowSummaries: validated.rowSummaries,
    entityCounts,
    insertedCount,
    skippedDuplicateCount: validated.duplicateCount
  };
}
