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
  | "anchorDate";

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

export const defaultSettings: RuntimeSettings = {
  startWithWindows: true,
  minimizeToTray: true,
  teamsEnabled: false,
  teamsWebhookUrl: ""
};

function getBridge() {
  return window.budgetit;
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

export async function restoreBackup(
  backupPath: string,
  manifestPath: string
): Promise<RestoreSummary> {
  return invokeIpc<RestoreSummary>("backup.restore", {
    backupPath,
    manifestPath
  });
}

export async function previewImport(input: {
  mode: "expenses" | "actuals";
  filePath: string;
  templateName?: string;
  useSavedTemplate?: boolean;
  saveTemplate?: boolean;
}): Promise<ImportPreviewResult> {
  return invokeIpc<ImportPreviewResult>("import.preview", input);
}

export async function commitImport(input: {
  mode: "expenses" | "actuals";
  filePath: string;
  templateName?: string;
  useSavedTemplate?: boolean;
  saveTemplate?: boolean;
}): Promise<ImportCommitResult> {
  return invokeIpc<ImportCommitResult>("import.commit", input);
}

export async function queryReport(payload: unknown): Promise<unknown> {
  return invokeIpc<unknown>("reports.query", payload);
}

export async function exportReport(payload: unknown): Promise<{
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

export function onAlertNavigate(
  listener: (payload: AlertNavigatePayload) => void
): (() => void) | undefined {
  return getBridge()?.onAlertNavigate?.(listener);
}
