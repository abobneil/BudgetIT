import type { RestoreSummary } from "../restore-banner";

export type RuntimeSettings = {
  startWithWindows: boolean;
  minimizeToTray: boolean;
  teamsEnabled: boolean;
  teamsWebhookUrl: string;
};

export type RuntimeSettingsResponse = RuntimeSettings & {
  lastRestoreSummary?: RestoreSummary | null;
};

export type BackupCreateResult = {
  backupPath: string;
  manifestPath: string;
  manifest: {
    createdAt: string;
    sourceLastMutationAt: string;
    schemaVersion: number;
    checksumSha256: string;
    destinationKind: "local_or_external" | "network";
  };
};

export type BackupVerifyResult = {
  ok: boolean;
  error?: string;
  lastVerifiedAt: string | null;
};

export type DatabaseSecurityStatus = {
  databasePath: string;
  keyPresent: boolean;
  safeStorageAvailable: boolean;
};

export type DbRekeyResult = {
  ok: boolean;
  rotatedAt: string;
};

export type MaintenanceMaterializeResult = {
  ok: boolean;
  generatedCount: number;
  horizonMonths: number;
  scenarioId: string;
  generatedAt: string;
};

export type MaintenanceDiagnosticsResult = {
  scenarioId: string;
  generatedAt: string;
  database: {
    path: string;
    schemaVersion: number;
    forecastStale: boolean;
    forecastGeneratedAt: string | null;
    lastMutationAt: string | null;
    integrity: string;
  };
  backup: {
    lastBackupAt: string | null;
    lastVerifiedAt: string | null;
  };
  counts: Record<string, number>;
};

export type ReportPresetQuery =
  | "dashboard.summary"
  | "renewals.timeline"
  | "spend.byTag"
  | "spend.byVendor"
  | "replacement.pipeline"
  | "tagging.completeness"
  | "nlq.saved";

export type ReportsQueryValue =
  | ReportPresetQuery
  | "variance.monthly"
  | "replacement.detail"
  | "scenario.comparison"
  | "actuals.unmatched.summary"
  | "showback.summary"
  | "dataQuality.summary"
  | "maintenance.materialize"
  | "maintenance.diagnostics";

export type ReportFilters = {
  dateFrom?: string;
  dateTo?: string;
  tag?: string;
};

export type QueryReportPayload = {
  query: ReportsQueryValue;
  scenarioId?: string;
  servicePlanId?: string;
  horizonMonths?: number;
  comparisonScenarioId?: string;
  baselineScenarioId?: string;
  filters?: ReportFilters;
};

export type ExportReportType = ReportPresetQuery | "nlq.results";

export type PreviewReportPayload = {
  scenarioId?: string;
  reportType: ReportPresetQuery;
  filters?: ReportFilters;
};

export type PreviewReportResult = {
  html: string;
  scenarioId: string;
  reportType: ReportPresetQuery;
};

export type ExportReportPayload = {
  scenarioId?: string;
  reportType: ExportReportType;
  outputDir?: string;
  // Backward compatibility for one release window.
  destinationPath?: string;
  baseFileName?: string;
  formats?: Array<"html" | "pdf" | "excel" | "csv" | "png">;
  filters?: ReportFilters;
  filterSpec?: Record<string, unknown>;
};

export type AlertRecord = {
  id: string;
  entityType: string;
  entityId: string;
  fireAt: string;
  status: "pending" | "snoozed" | "acked";
  snoozedUntil: string | null;
  message: string;
};

export type AlertNavigatePayload = {
  alertEventId: string;
  entityType: string;
  entityId: string;
};

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
  | "anchorDate"
  | "capexOpex"
  | "glAccountCode"
  | "costCenterCode"
  | "fundingSource";

export type ImportRowError = {
  rowNumber: number;
  code: "validation" | "duplicate";
  field: ImportField | "row";
  message: string;
};

export type ImportPreviewResult = {
  totalRows: number;
  acceptedCount: number;
  rejectedCount: number;
  duplicateCount: number;
  templateApplied: string | null;
  templateSaved: string | null;
  errors: ImportRowError[];
};

export type ImportCommitResult = {
  totalRows: number;
  acceptedCount: number;
  rejectedCount: number;
  duplicateCount: number;
  insertedCount: number;
  skippedDuplicateCount: number;
  matchedCount?: number;
  unmatchedCount?: number;
  matchRate?: number;
  unmatchedForReview?: Array<{
    id: string;
    transactionDate: string;
    amountMinor: number;
    description: string | null;
  }>;
  errors: ImportRowError[];
};

export type ImportTemplateSummary = {
  name: string;
  headerSignature: string;
  templateVersion: number;
  updatedAt: string;
  mapping: Partial<Record<ImportField, string>>;
};

export type NotificationEndpointRecord = {
  id: string;
  endpointType: string;
  endpointUrl: string;
  enabled: boolean;
  lastTestResult: string | null;
  lastTestAt: string | null;
  lastFailureReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReplacementDetail = {
  servicePlan: {
    id: string;
    decisionStatus: string;
    reasonCode: string | null;
  };
  aggregation: {
    candidateCount: number;
    averageWeightedScore: number;
    bestCandidateId: string | null;
    bestWeightedScore: number | null;
  };
};

export type NlqParseResult = {
  filterSpec: Record<string, unknown>;
  explanation: string;
  rows: Array<{
    id: string;
    name: string;
    amount_minor: number;
  }>;
};

export type VendorStatus = "active" | "watch" | "archived";
export type RiskLevel = "low" | "medium" | "high";
export type ServiceStatus = "active" | "trial" | "deprecated" | "retiring" | "retired";
export type ReplacementStatus = "not-started" | "candidate-review" | "approved";
export type ContractRenewalType = "auto" | "manual" | "none";
export type ContractLifecycleStatus = "active" | "renewal-window" | "notice-window" | "expired";
export type ContractRenewalAction = "auto-renew" | "manual-review" | "cancel-window";
export type ExpenseType = "recurring" | "one_time";
export type ExpenseStatus = "planned" | "approved" | "committed" | "actual" | "cancelled";
export type ScenarioApprovalStatus = "draft" | "reviewed" | "approved";
export type RecurrenceFrequency = "monthly" | "quarterly" | "yearly";
export type DimensionMode = "single_select" | "multi_select";
export type CapexOpex = "capex" | "opex";

export type VendorRecord = {
  id: string;
  name: string;
  website: string | null;
  notes: string | null;
  owner: string | null;
  annualSpendMinor: number;
  status: VendorStatus;
  risk: RiskLevel;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type ServiceRecord = {
  id: string;
  vendorId: string;
  name: string;
  status: ServiceStatus;
  ownerTeam: string | null;
  annualSpendMinor: number;
  risk: RiskLevel;
  replacementStatus: ReplacementStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type ContractRecord = {
  id: string;
  serviceId: string;
  contractNumber: string | null;
  startDate: string | null;
  endDate: string | null;
  renewalType: ContractRenewalType | null;
  renewalDate: string | null;
  noticePeriodDays: number | null;
  owner: string | null;
  lifecycleStatus: ContractLifecycleStatus;
  renewalAction: ContractRenewalAction;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type ExpenseLineRecord = {
  id: string;
  scenarioId: string;
  serviceId: string;
  contractId: string | null;
  name: string;
  expenseType: ExpenseType;
  status: ExpenseStatus;
  amountMinor: number;
  currency: string;
  capexOpex: CapexOpex | null;
  glAccountCode: string | null;
  costCenterCode: string | null;
  fundingSource: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type RecurrenceRuleRecord = {
  id: string;
  expenseLineId: string;
  frequency: RecurrenceFrequency;
  interval: number;
  dayOfMonth: number;
  monthOfYear: number | null;
  anchorDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DimensionRecord = {
  id: string;
  name: string;
  mode: DimensionMode;
  required: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TagRecord = {
  id: string;
  dimensionId: string;
  name: string;
  parentTagId: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type TagAssignmentRecord = {
  id: string;
  entityType: string;
  entityId: string;
  dimensionId: string;
  tagId: string;
  createdAt: string;
};

export type ScenarioRecord = {
  id: string;
  name: string;
  parentScenarioId: string | null;
  approvalStatus: ScenarioApprovalStatus;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ScenarioSettingsRecord = {
  scenarioId: string;
  fiscalYearStartMonth: number;
  horizonMonths: number;
  defaultCurrency: string;
  createdAt: string;
  updatedAt: string;
};

export type CostCenterRecord = {
  code: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type GlAccountRecord = {
  code: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UnmatchedActualReviewDisposition =
  | "matched"
  | "rejected"
  | "ignored"
  | "create_expense";

export type UnmatchedActualItem = {
  id: string;
  scenarioId: string;
  serviceId: string;
  contractId: string | null;
  transactionDate: string;
  amountMinor: number;
  currency: string;
  description: string | null;
  suggestions: Array<{
    occurrenceId: string;
    occurrenceDate: string;
    amountMinor: number;
    currency: string;
  }>;
  review: null | {
    id: string;
    disposition: string;
    driverTag: string | null;
    matchedOccurrenceId: string | null;
    createdExpenseLineId: string | null;
    reviewer: string;
    comment: string | null;
    reviewedAt: string;
  };
};

export type UnmatchedActualListResult = {
  scenarioId: string;
  total: number;
  items: UnmatchedActualItem[];
};

export type ShowbackStatement = {
  id: string;
  scenarioId: string;
  periodStart: string;
  periodEnd: string;
  groupBy: string;
  generatedAt: string;
  generatedBy: string;
  totalMinor: number;
  currency: string;
  createdAt?: string;
  updatedAt?: string;
  lineCount?: number;
  lines?: Array<{
    id: string;
    statementId: string;
    costCenterCode: string | null;
    ownerTeam: string | null;
    serviceId: string | null;
    expenseLineId: string | null;
    amountMinor: number;
    currency: string;
    detailsJson?: string | null;
    createdAt?: string;
  }>;
};

export type ApprovalRecord = {
  id: string;
  scenarioId: string | null;
  servicePlanId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  actor: string;
  comment: string | null;
  createdAt: string;
};

export type AuditRecord = {
  id: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeJson: string | null;
  afterJson: string | null;
  createdAt: string;
};

export type HelpOpenPayload = {
  topic?: string;
  anchor?: string;
};

export type HelpDocumentResult = {
  markdown: string;
  sourcePath: string | null;
};

export const defaultSettings: RuntimeSettings = {
  startWithWindows: true,
  minimizeToTray: true,
  teamsEnabled: false,
  teamsWebhookUrl: ""
};

function getBridge() {
  return window.budgetit;
}

export function isIpcAvailable(): boolean {
  return Boolean(getBridge());
}

function requireBridge() {
  const bridge = getBridge();
  if (!bridge) {
    throw new Error("IPC bridge is unavailable.");
  }
  return bridge;
}

async function invokeIpc<T>(channel: string, payload?: unknown): Promise<T> {
  return (await requireBridge().invoke(channel, payload)) as T;
}

export async function getSettings(): Promise<RuntimeSettingsResponse> {
  const bridge = getBridge();
  if (!bridge) {
    return defaultSettings;
  }
  return (await bridge.invoke("settings.get")) as RuntimeSettingsResponse;
}

export async function saveSettings(settings: RuntimeSettings): Promise<RuntimeSettings> {
  const bridge = getBridge();
  if (!bridge) {
    return settings;
  }
  return (await bridge.invoke("settings.update", settings)) as RuntimeSettings;
}

export async function openHelpWindow(
  payload: HelpOpenPayload = {}
): Promise<{ ok: true }> {
  const bridge = getBridge();
  if (!bridge) {
    const params = new URLSearchParams();
    if (payload.topic) {
      params.set("topic", payload.topic);
    }
    if (payload.anchor) {
      params.set("anchor", payload.anchor);
    }
    const query = params.toString();
    window.open(
      `#/help${query ? `?${query}` : ""}`,
      "_blank",
      "noopener,noreferrer"
    );
    return { ok: true };
  }
  return (await bridge.invoke("help.open", payload)) as { ok: true };
}

export async function getHelpDocument(): Promise<HelpDocumentResult> {
  const bridge = getBridge();
  if (!bridge) {
    return {
      markdown: "Help content is unavailable because desktop IPC is not active.",
      sourcePath: null
    };
  }
  return (await bridge.invoke("help.document.get")) as HelpDocumentResult;
}

export async function listAlerts(): Promise<AlertRecord[]> {
  const bridge = getBridge();
  if (!bridge) {
    return [];
  }
  return (await bridge.invoke("alerts.list")) as AlertRecord[];
}

export async function acknowledgeAlert(alertEventId: string): Promise<AlertRecord> {
  return invokeIpc<AlertRecord>("alerts.ack", { alertEventId });
}

export async function snoozeAlert(alertEventId: string, snoozedUntil: string): Promise<AlertRecord> {
  return invokeIpc<AlertRecord>("alerts.snooze", {
    alertEventId,
    snoozedUntil
  });
}

export async function unsnoozeAlert(alertEventId: string): Promise<AlertRecord> {
  return invokeIpc<AlertRecord>("alerts.snooze", {
    alertEventId,
    snoozedUntil: null
  });
}

export async function sendTeamsTestAlert(): Promise<{
  ok: boolean;
  attempts: number;
  statusCode: number | null;
  health: { status: string };
}> {
  return invokeIpc<{
    ok: boolean;
    attempts: number;
    statusCode: number | null;
    health: { status: string };
  }>("alerts.sendTest");
}

export async function listNotificationEndpoints(payload?: {
  endpointType?: string;
  limit?: number;
}): Promise<NotificationEndpointRecord[]> {
  return invokeIpc<NotificationEndpointRecord[]>("notifications.endpoints.list", payload);
}

export async function restoreBackup(
  backupPath: string,
  manifestPath: string
): Promise<RestoreSummary> {
  return invokeIpc<RestoreSummary>("backup.restore", {
    backupPath,
    manifestPath
  });
}

export async function createBackup(payload?: {
  destinationDir?: string;
}): Promise<BackupCreateResult> {
  return invokeIpc<BackupCreateResult>("backup.create", payload);
}

export async function verifyBackup(payload?: {
  backupPath?: string;
  manifestPath?: string;
}): Promise<BackupVerifyResult> {
  return invokeIpc<BackupVerifyResult>("backup.verify", payload);
}

export async function getDatabaseSecurityStatus(): Promise<DatabaseSecurityStatus> {
  return invokeIpc<DatabaseSecurityStatus>("db.open");
}

export async function rekeyDatabase(payload?: {
  newKeyHex?: string;
}): Promise<DbRekeyResult> {
  return invokeIpc<DbRekeyResult>("db.rekey", payload);
}

export async function previewImport(input: {
  mode: "expenses" | "actuals";
  filePath: string;
  templateName?: string;
  templatePack?: "aws-cur" | "azure-cost" | "gcp-billing";
  useSavedTemplate?: boolean;
  saveTemplate?: boolean;
  requireFinanceMetadata?: boolean;
}): Promise<ImportPreviewResult> {
  return invokeIpc<ImportPreviewResult>("import.preview", input);
}

export async function commitImport(input: {
  mode: "expenses" | "actuals";
  filePath: string;
  templateName?: string;
  templatePack?: "aws-cur" | "azure-cost" | "gcp-billing";
  useSavedTemplate?: boolean;
  saveTemplate?: boolean;
  requireFinanceMetadata?: boolean;
}): Promise<ImportCommitResult> {
  return invokeIpc<ImportCommitResult>("import.commit", input);
}

export async function listImportTemplates(): Promise<{
  version: number;
  templates: ImportTemplateSummary[];
}> {
  return invokeIpc<{
    version: number;
    templates: ImportTemplateSummary[];
  }>("import.templates.list");
}

export async function deleteImportTemplate(name: string): Promise<{
  ok: boolean;
  deleted: boolean;
  remaining: number;
}> {
  return invokeIpc<{
    ok: boolean;
    deleted: boolean;
    remaining: number;
  }>("import.templates.delete", { name });
}

export async function queryReport(payload: QueryReportPayload): Promise<unknown> {
  return invokeIpc<unknown>("reports.query", payload);
}

export async function previewReport(payload: PreviewReportPayload): Promise<PreviewReportResult> {
  return invokeIpc<PreviewReportResult>("report.preview", payload);
}

export async function materializeForecast(payload: {
  scenarioId: string;
  horizonMonths?: number;
}): Promise<MaintenanceMaterializeResult> {
  return invokeIpc<MaintenanceMaterializeResult>("reports.query", {
    query: "maintenance.materialize",
    scenarioId: payload.scenarioId,
    horizonMonths: payload.horizonMonths
  });
}

export async function runDiagnostics(payload: {
  scenarioId: string;
}): Promise<MaintenanceDiagnosticsResult> {
  return invokeIpc<MaintenanceDiagnosticsResult>("reports.query", {
    query: "maintenance.diagnostics",
    scenarioId: payload.scenarioId
  });
}

export async function exportReport(payload: ExportReportPayload): Promise<{
  files: Partial<Record<"html" | "pdf" | "excel" | "csv" | "png", string>>;
}> {
  return invokeIpc<{
    files: Partial<Record<"html" | "pdf" | "excel" | "csv" | "png", string>>;
  }>("export.report", payload);
}

export async function parseNlq(payload: {
  query: string;
  referenceDate?: string;
}): Promise<NlqParseResult> {
  return invokeIpc<NlqParseResult>("nlq.parse", payload);
}

export async function listVendors(payload?: {
  includeDeleted?: boolean;
}): Promise<VendorRecord[]> {
  return invokeIpc<VendorRecord[]>("vendors.list", payload);
}

export async function createVendor(payload: {
  name: string;
  website?: string;
  notes?: string;
  owner?: string;
  annualSpendMinor?: number;
  status?: VendorStatus;
  risk?: RiskLevel;
}): Promise<VendorRecord | null> {
  return invokeIpc<VendorRecord | null>("vendors.create", payload);
}

export async function updateVendor(payload: {
  id: string;
  name: string;
  website?: string;
  notes?: string;
  owner?: string;
  annualSpendMinor?: number;
  status?: VendorStatus;
  risk?: RiskLevel;
}): Promise<VendorRecord | null> {
  return invokeIpc<VendorRecord | null>("vendors.update", payload);
}

export async function deleteVendor(id: string): Promise<{ ok: boolean; id: string }> {
  return invokeIpc<{ ok: boolean; id: string }>("vendors.delete", { id });
}

export async function listServices(payload?: {
  includeDeleted?: boolean;
}): Promise<ServiceRecord[]> {
  return invokeIpc<ServiceRecord[]>("services.list", payload);
}

export async function createService(payload: {
  vendorId: string;
  name: string;
  status?: ServiceStatus;
  ownerTeam?: string;
  annualSpendMinor?: number;
  risk?: RiskLevel;
  replacementStatus?: ReplacementStatus;
}): Promise<ServiceRecord | null> {
  return invokeIpc<ServiceRecord | null>("services.create", payload);
}

export async function updateService(payload: {
  id: string;
  vendorId: string;
  name: string;
  status?: ServiceStatus;
  ownerTeam?: string;
  annualSpendMinor?: number;
  risk?: RiskLevel;
  replacementStatus?: ReplacementStatus;
}): Promise<ServiceRecord | null> {
  return invokeIpc<ServiceRecord | null>("services.update", payload);
}

export async function deleteService(id: string): Promise<{ ok: boolean; id: string }> {
  return invokeIpc<{ ok: boolean; id: string }>("services.delete", { id });
}

export async function listContracts(payload?: {
  includeDeleted?: boolean;
}): Promise<ContractRecord[]> {
  return invokeIpc<ContractRecord[]>("contracts.list", payload);
}

export async function createContract(payload: {
  serviceId: string;
  contractNumber?: string;
  startDate?: string;
  endDate?: string;
  renewalType?: ContractRenewalType;
  renewalDate?: string;
  noticePeriodDays?: number;
  owner?: string;
  lifecycleStatus?: ContractLifecycleStatus;
  renewalAction?: ContractRenewalAction;
}): Promise<ContractRecord | null> {
  return invokeIpc<ContractRecord | null>("contracts.create", payload);
}

export async function updateContract(payload: {
  id: string;
  serviceId: string;
  contractNumber?: string;
  startDate?: string;
  endDate?: string;
  renewalType?: ContractRenewalType;
  renewalDate?: string;
  noticePeriodDays?: number;
  owner?: string;
  lifecycleStatus?: ContractLifecycleStatus;
  renewalAction?: ContractRenewalAction;
}): Promise<ContractRecord | null> {
  return invokeIpc<ContractRecord | null>("contracts.update", payload);
}

export async function deleteContract(id: string): Promise<{ ok: boolean; id: string }> {
  return invokeIpc<{ ok: boolean; id: string }>("contracts.delete", { id });
}

export async function listExpenses(payload?: {
  scenarioId?: string;
  includeDeleted?: boolean;
}): Promise<ExpenseLineRecord[]> {
  return invokeIpc<ExpenseLineRecord[]>("expenses.list", payload);
}

export async function createExpense(payload: {
  scenarioId?: string;
  serviceId: string;
  contractId?: string | null;
  name: string;
  expenseType: ExpenseType;
  status: ExpenseStatus;
  amountMinor: number;
  currency?: string;
  capexOpex?: CapexOpex | null;
  glAccountCode?: string | null;
  costCenterCode?: string | null;
  fundingSource?: string | null;
  startDate?: string;
  endDate?: string | null;
  recurrence?: {
    frequency: RecurrenceFrequency;
    interval: number;
    dayOfMonth: number;
    monthOfYear?: number;
    anchorDate?: string;
  };
}): Promise<ExpenseLineRecord | null> {
  return invokeIpc<ExpenseLineRecord | null>("expenses.create", payload);
}

export async function updateExpense(payload: {
  id: string;
  scenarioId?: string;
  serviceId: string;
  contractId?: string | null;
  name: string;
  expenseType: ExpenseType;
  status: ExpenseStatus;
  amountMinor: number;
  currency?: string;
  capexOpex?: CapexOpex | null;
  glAccountCode?: string | null;
  costCenterCode?: string | null;
  fundingSource?: string | null;
  startDate?: string;
  endDate?: string | null;
}): Promise<ExpenseLineRecord | null> {
  return invokeIpc<ExpenseLineRecord | null>("expenses.update", payload);
}

export async function deleteExpense(id: string): Promise<{ ok: boolean; id: string }> {
  return invokeIpc<{ ok: boolean; id: string }>("expenses.delete", { id });
}

export async function listRecurrences(payload?: {
  expenseLineId?: string;
}): Promise<RecurrenceRuleRecord[]> {
  return invokeIpc<RecurrenceRuleRecord[]>("recurrences.list", payload);
}

export async function createRecurrence(payload: {
  expenseLineId: string;
  frequency: RecurrenceFrequency;
  interval: number;
  dayOfMonth: number;
  monthOfYear?: number;
  anchorDate?: string;
}): Promise<RecurrenceRuleRecord | null> {
  return invokeIpc<RecurrenceRuleRecord | null>("recurrences.create", payload);
}

export async function updateRecurrence(payload: {
  id: string;
  expenseLineId: string;
  frequency: RecurrenceFrequency;
  interval: number;
  dayOfMonth: number;
  monthOfYear?: number;
  anchorDate?: string;
}): Promise<RecurrenceRuleRecord | null> {
  return invokeIpc<RecurrenceRuleRecord | null>("recurrences.update", payload);
}

export async function deleteRecurrence(id: string): Promise<{ ok: boolean; id: string }> {
  return invokeIpc<{ ok: boolean; id: string }>("recurrences.delete", { id });
}

export async function listDimensions(): Promise<DimensionRecord[]> {
  return invokeIpc<DimensionRecord[]>("dimensions.list");
}

export async function createDimension(payload: {
  name: string;
  mode: DimensionMode;
  required: boolean;
}): Promise<DimensionRecord | null> {
  return invokeIpc<DimensionRecord | null>("dimensions.create", payload);
}

export async function updateDimension(payload: {
  id: string;
  name: string;
  mode: DimensionMode;
  required: boolean;
}): Promise<DimensionRecord | null> {
  return invokeIpc<DimensionRecord | null>("dimensions.update", payload);
}

export async function deleteDimension(id: string): Promise<{ ok: boolean; id: string }> {
  return invokeIpc<{ ok: boolean; id: string }>("dimensions.delete", { id });
}

export async function listTags(payload?: {
  dimensionId?: string;
  includeArchived?: boolean;
  entityType?: string;
  entityId?: string;
}): Promise<{
  tags: TagRecord[];
  assignments: TagAssignmentRecord[];
}> {
  return invokeIpc<{
    tags: TagRecord[];
    assignments: TagAssignmentRecord[];
  }>("tags.list", payload);
}

export async function createTag(payload: {
  dimensionId: string;
  name: string;
  parentTagId?: string | null;
}): Promise<TagRecord | null> {
  return invokeIpc<TagRecord | null>("tags.create", payload);
}

export async function updateTag(payload: {
  id: string;
  name: string;
  parentTagId?: string | null;
}): Promise<TagRecord | null> {
  return invokeIpc<TagRecord | null>("tags.update", payload);
}

export async function archiveTag(payload: {
  id: string;
  archived: boolean;
}): Promise<TagRecord | null> {
  return invokeIpc<TagRecord | null>("tags.archive", payload);
}

export async function mergeTags(payload: {
  dimensionId: string;
  sourceTagId: string;
  targetTagId: string;
}): Promise<{ ok: boolean; reassignedCount: number }> {
  return invokeIpc<{ ok: boolean; reassignedCount: number }>("tags.merge", payload);
}

export async function assignTag(payload: {
  entityType: string;
  entityId: string;
  dimensionId: string;
  tagId: string;
}): Promise<TagAssignmentRecord | null> {
  return invokeIpc<TagAssignmentRecord | null>("tags.assign", payload);
}

export async function unassignTag(payload: {
  entityType: string;
  entityId: string;
  dimensionId: string;
  tagId: string;
}): Promise<{ ok: boolean }> {
  return invokeIpc<{ ok: boolean }>("tags.unassign", payload);
}

export async function listScenarios(): Promise<ScenarioRecord[]> {
  return invokeIpc<ScenarioRecord[]>("scenarios.list");
}

export async function createScenario(payload: {
  name: string;
  parentScenarioId?: string | null;
  approvalStatus?: ScenarioApprovalStatus;
}): Promise<ScenarioRecord | null> {
  return invokeIpc<ScenarioRecord | null>("scenarios.create", payload);
}

export async function cloneScenario(payload: {
  sourceScenarioId: string;
  newScenarioName?: string;
}): Promise<ScenarioRecord | null> {
  return invokeIpc<ScenarioRecord | null>("scenarios.clone", payload);
}

export async function approveScenario(payload: {
  scenarioId: string;
  nextStatus?: ScenarioApprovalStatus;
}): Promise<ScenarioRecord | null> {
  return invokeIpc<ScenarioRecord | null>("scenarios.approve", payload);
}

export async function lockScenario(payload: {
  scenarioId: string;
}): Promise<ScenarioRecord | null> {
  return invokeIpc<ScenarioRecord | null>("scenarios.lock", payload);
}

export async function getScenarioSettings(payload?: {
  scenarioId?: string;
}): Promise<ScenarioSettingsRecord> {
  return invokeIpc<ScenarioSettingsRecord>("scenarioSettings.get", payload);
}

export async function updateScenarioSettings(payload: {
  scenarioId?: string;
  fiscalYearStartMonth?: number;
  horizonMonths?: number;
  defaultCurrency?: string;
}): Promise<ScenarioSettingsRecord> {
  return invokeIpc<ScenarioSettingsRecord>("scenarioSettings.update", payload);
}

export async function listCostCenters(): Promise<CostCenterRecord[]> {
  return invokeIpc<CostCenterRecord[]>("costCenters.list");
}

export async function createCostCenter(payload: {
  code: string;
  name: string;
  active?: boolean;
}): Promise<CostCenterRecord | null> {
  return invokeIpc<CostCenterRecord | null>("costCenters.create", payload);
}

export async function updateCostCenter(payload: {
  code: string;
  name: string;
  active?: boolean;
}): Promise<CostCenterRecord | null> {
  return invokeIpc<CostCenterRecord | null>("costCenters.update", payload);
}

export async function deleteCostCenter(code: string): Promise<{ ok: boolean; code: string }> {
  return invokeIpc<{ ok: boolean; code: string }>("costCenters.delete", { code });
}

export async function listGlAccounts(): Promise<GlAccountRecord[]> {
  return invokeIpc<GlAccountRecord[]>("glAccounts.list");
}

export async function createGlAccount(payload: {
  code: string;
  name: string;
  active?: boolean;
}): Promise<GlAccountRecord | null> {
  return invokeIpc<GlAccountRecord | null>("glAccounts.create", payload);
}

export async function updateGlAccount(payload: {
  code: string;
  name: string;
  active?: boolean;
}): Promise<GlAccountRecord | null> {
  return invokeIpc<GlAccountRecord | null>("glAccounts.update", payload);
}

export async function deleteGlAccount(code: string): Promise<{ ok: boolean; code: string }> {
  return invokeIpc<{ ok: boolean; code: string }>("glAccounts.delete", { code });
}

export async function listUnmatchedActuals(payload?: {
  scenarioId?: string;
}): Promise<UnmatchedActualListResult> {
  return invokeIpc<UnmatchedActualListResult>("actuals.unmatched.list", payload);
}

export async function reviewUnmatchedActual(payload: {
  transactionId: string;
  scenarioId?: string;
  disposition: UnmatchedActualReviewDisposition;
  matchedOccurrenceId?: string;
  reviewer?: string;
  driverTag?: "timing" | "price" | "scope";
  comment?: string;
}): Promise<{ ok: boolean; transactionId: string; disposition: string }> {
  return invokeIpc<{ ok: boolean; transactionId: string; disposition: string }>(
    "actuals.unmatched.review",
    payload
  );
}

export async function createExpenseFromUnmatchedActual(payload: {
  transactionId: string;
  reviewer?: string;
  name?: string;
  expenseType?: ExpenseType;
  status?: ExpenseStatus;
  capexOpex?: CapexOpex | null;
  glAccountCode?: string | null;
  costCenterCode?: string | null;
  fundingSource?: string | null;
  comment?: string;
  driverTag?: "timing" | "price" | "scope";
}): Promise<{ ok: boolean; transactionId: string; expenseLineId: string }> {
  return invokeIpc<{ ok: boolean; transactionId: string; expenseLineId: string }>(
    "actuals.unmatched.createExpense",
    payload
  );
}

export async function generateShowbackStatement(payload: {
  scenarioId?: string;
  periodStart: string;
  periodEnd: string;
  groupBy?: "cost_center" | "team";
  generatedBy?: string;
  currency?: string;
}): Promise<ShowbackStatement> {
  return invokeIpc<ShowbackStatement>("showback.generate", payload);
}

export async function listShowbackStatements(payload?: {
  scenarioId?: string;
  includeLines?: boolean;
}): Promise<{ statements: ShowbackStatement[] }> {
  return invokeIpc<{ statements: ShowbackStatement[] }>("showback.list", payload);
}

export async function exportShowbackStatement(payload: {
  statementId: string;
  format: "csv" | "xlsx";
  outputDir?: string;
  baseFileName?: string;
}): Promise<{
  statement: ShowbackStatement;
  files: Partial<Record<"csv" | "xlsx", string>>;
}> {
  return invokeIpc<{
    statement: ShowbackStatement;
    files: Partial<Record<"csv" | "xlsx", string>>;
  }>("showback.export", payload);
}

export async function listApprovalRecords(payload?: {
  scenarioId?: string;
  entityType?: string;
  limit?: number;
}): Promise<ApprovalRecord[]> {
  return invokeIpc<ApprovalRecord[]>("approvals.list", payload);
}

export async function createApprovalRecord(payload: {
  scenarioId?: string;
  servicePlanId?: string;
  entityType: string;
  entityId: string;
  action: string;
  actor?: string;
  comment?: string;
}): Promise<ApprovalRecord> {
  return invokeIpc<ApprovalRecord>("approvals.create", payload);
}

export async function listAuditRecords(payload?: {
  entityType?: string;
  entityId?: string;
  limit?: number;
}): Promise<AuditRecord[]> {
  return invokeIpc<AuditRecord[]>("audit.list", payload);
}

export function onAlertNavigate(
  listener: (payload: AlertNavigatePayload) => void
): (() => void) | undefined {
  return getBridge()?.onAlertNavigate?.(listener);
}
