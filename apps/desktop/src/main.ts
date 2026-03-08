import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  BudgetCrudRepository,
  bootstrapEncryptedDatabase,
  buildReportPresetDataset,
  buildMonthlyVarianceDataset,
  createEncryptedBackup,
  getReplacementPlanDetail,
  listUnmatchedActualTransactions,
  materializeScenarioOccurrences,
  parseNlqToFilterSpec,
  queryExpensesByFilterSpec,
  rekeyEncryptedDatabase,
  restoreEncryptedBackup,
  runMigrations,
  type AlertEventRecord,
  type FilterSpec,
  type ReportDatasetFilters,
  type ReportPresetQuery,
  type RestoreEncryptedBackupResult
} from "@budgetit/db";
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  Notification,
  Tray,
  nativeImage,
  safeStorage,
  type BrowserWindowConstructorOptions,
  type MenuItemConstructorOptions
} from "electron";

import {
  createDatabaseAlertStore,
  processAlertNotifications,
  type AlertNavigatePayload,
  type AlertStore
} from "./alert-center";
import { FileSecretVault, resolveDatabaseKey } from "./key-vault";
import {
  buildLoginItemSettings,
  createExitHandler,
  DEFAULT_RUNTIME_SETTINGS,
  mergeRuntimeSettings,
  shouldStartHiddenToTray,
  shouldMinimizeToTrayOnClose,
  type RuntimeSettings
} from "./lifecycle";
import { readRuntimeSettings, writeRuntimeSettings } from "./settings-store";
import {
  createTeamsWorkflowChannel,
  type TeamsAlertInput,
  type TeamsChannelSettings
} from "./teams-channel";
import {
  createEmptyBackupHealthState,
  evaluateBackupFreshness,
  loadBackupHealthState,
  recordBackupCreated,
  recordBackupVerificationFailure,
  recordBackupVerificationSuccess,
  recordStaleBackupAlert,
  saveBackupHealthState,
  type BackupHealthState
} from "./backup-health";
import {
  loadAutoTagRules,
  suggestRulesFromManualCorrections,
  type AutoTagSuggestion
} from "./auto-tagging";
import {
  commitExpenseImport,
  deleteImportTemplate,
  listImportTemplates,
  previewExpenseImport,
  type ImportColumnMapping
} from "./import-wizard";
import {
  commitActualsImport,
  previewActualsImport,
  type ActualImportMapping
} from "./actuals-import";
import {
  createDashboardHtml,
  exportDashboardReport,
  exportNlqResultsReport,
  type ExportFormat,
  type NlqExportFormat,
  type ReportRenderers
} from "./report-export";
import * as XLSX from "xlsx";

export interface DesktopRuntime {
  whenReady: () => Promise<void>;
  createWindow: () => void;
  onActivate: (callback: () => void) => void;
  onAllWindowsClosed: (callback: () => void) => void;
  hasOpenWindows: () => boolean;
  quit: () => void;
  platform: NodeJS.Platform;
}

const SETTINGS_FILE_NAME = "runtime-settings.json";
const DATABASE_KEY_FILE_NAME = "database-key.json";
const ALERT_TICK_INTERVAL_MS = 60_000;
const DEFAULT_BACKUP_SUBDIR = path.join("BudgetIT", "backups");
const DEFAULT_EXPORT_SUBDIR = path.join("BudgetIT", "exports");
const BACKUP_HEALTH_FILE_NAME = "backup-health.json";
const BACKUP_STALE_THRESHOLD_DAYS = 7;
const IMPORT_TEMPLATE_FILE_NAME = "import-mappings.json";
const AUTO_TAG_RULES_FILE_NAME = "auto-tag-rules.json";
const WINDOWS_APP_ICON_FILE_NAME = "app-icon.ico";
const LINUX_APP_ICON_FILE_NAME = "app-icon.png";
const TRAY_ICON_FILE_NAME = "tray-icon.png";
const DIAGNOSTICS_LOG_DIR_NAME = "logs";
const DIAGNOSTICS_LOG_FILE_NAME = "desktop.log";
const DEFAULT_SINGLE_USER_ACTOR = "single-it-user";
const HELP_DOCUMENT_FILE_NAME = "help-system.md";

const IMPORT_FIELDS = new Set([
  "scenarioId",
  "serviceId",
  "contractId",
  "name",
  "expenseType",
  "status",
  "amount",
  "currency",
  "startDate",
  "endDate",
  "frequency",
  "interval",
  "dayOfMonth",
  "monthOfYear",
  "anchorDate",
  "transactionDate",
  "description",
  "capexOpex",
  "glAccountCode",
  "costCenterCode",
  "fundingSource"
]);

const VENDOR_STATUSES = ["active", "watch", "archived"] as const;
const RISK_LEVELS = ["low", "medium", "high"] as const;
const SERVICE_STATUSES = ["active", "trial", "deprecated", "retiring", "retired"] as const;
const REPLACEMENT_STATUSES = ["not-started", "candidate-review", "approved"] as const;
const RENEWAL_TYPES = ["auto", "manual", "none"] as const;
const CONTRACT_LIFECYCLE_STATUSES = ["active", "renewal-window", "notice-window", "expired"] as const;
const RENEWAL_ACTIONS = ["auto-renew", "manual-review", "cancel-window"] as const;
const EXPENSE_TYPES = ["recurring", "one_time"] as const;
const EXPENSE_STATUSES = ["planned", "approved", "committed", "actual", "cancelled"] as const;
const CAPEX_OPEX_VALUES = ["capex", "opex"] as const;
const RECURRENCE_FREQUENCIES = ["monthly", "quarterly", "yearly"] as const;
const DIMENSION_MODES = ["single_select", "multi_select"] as const;
const SCENARIO_APPROVAL_STATUSES = ["draft", "reviewed", "approved"] as const;

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

const REPORT_PRESET_QUERY_SET = new Set<ReportPresetQuery>([
  "dashboard.summary",
  "renewals.timeline",
  "spend.byTag",
  "spend.byVendor",
  "replacement.pipeline",
  "tagging.completeness",
  "nlq.saved"
]);

const REPORT_QUERY_SET = new Set<ReportsQueryValue>([
  ...REPORT_PRESET_QUERY_SET,
  "variance.monthly",
  "replacement.detail",
  "scenario.comparison",
  "actuals.unmatched.summary",
  "showback.summary",
  "dataQuality.summary",
  "maintenance.materialize",
  "maintenance.diagnostics"
]);

export const DIAGNOSTICS_TRACKED_TABLES = [
  "vendor",
  "service",
  "contract",
  "expense_line",
  "occurrence",
  "spend_transaction",
  "alert_event"
] as const;

export function getMainWindowOptions(preloadPath: string): BrowserWindowConstructorOptions {
  return {
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 720,
    autoHideMenuBar: true,
    show: false,
    icon: resolveMainWindowIconPath(),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  };
}

export function createDesktopRuntime(): DesktopRuntime {
  return {
    whenReady: () => app.whenReady(),
    createWindow: () => {
      const preloadPath = path.join(__dirname, "preload.js");
      const mainWindow = new BrowserWindow(getMainWindowOptions(preloadPath));
      loadRendererRoute(mainWindow, "/");

      mainWindow.once("ready-to-show", () => {
        mainWindow.show();
      });
    },
    onActivate: (callback) => {
      app.on("activate", callback);
    },
    onAllWindowsClosed: (callback) => {
      app.on("window-all-closed", callback);
    },
    hasOpenWindows: () => BrowserWindow.getAllWindows().length > 0,
    quit: () => {
      app.quit();
    },
    platform: process.platform
  };
}

export async function bootstrapDesktop(runtime: DesktopRuntime): Promise<void> {
  await runtime.whenReady();
  runtime.createWindow();

  runtime.onActivate(() => {
    if (!runtime.hasOpenWindows()) {
      runtime.createWindow();
    }
  });

  runtime.onAllWindowsClosed(() => {
    if (runtime.platform !== "darwin") {
      runtime.quit();
    }
  });
}

if (require.main === module) {
  void startDesktopApp();
}

let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;
let helpWindow: BrowserWindow | null = null;
let isQuitting = false;
let runtimeSettings: RuntimeSettings = DEFAULT_RUNTIME_SETTINGS;
let runtimeSettingsPath = "";
let databaseHandle: ReturnType<typeof bootstrapEncryptedDatabase> | null = null;
let alertStore: AlertStore | null = null;
let schedulerTimer: NodeJS.Timeout | null = null;
let lastRestoreSummary: RestoreEncryptedBackupResult | null = null;
let backupHealthState: BackupHealthState = createEmptyBackupHealthState();
let diagnosticsLogFilePath: string | null = null;
let diagnosticsLoggingInitialized = false;
const teamsChannel = createTeamsWorkflowChannel();

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function currentIsoDate(): string {
  return toIsoDate(new Date());
}

function getDatabaseKeyPath(): string {
  return path.join(app.getPath("userData"), "secrets", DATABASE_KEY_FILE_NAME);
}

function getDatabaseDataDirectory(): string {
  return path.join(app.getPath("userData"), "data");
}

function getBackupHealthPath(): string {
  return path.join(app.getPath("userData"), BACKUP_HEALTH_FILE_NAME);
}

function getImportTemplateStorePath(): string {
  return path.join(app.getPath("userData"), IMPORT_TEMPLATE_FILE_NAME);
}

function getAutoTagRulesPath(): string {
  return path.join(app.getPath("userData"), AUTO_TAG_RULES_FILE_NAME);
}

function resolveMainWindowIconPath(): string | undefined {
  const iconCandidates =
    process.platform === "linux"
      ? [LINUX_APP_ICON_FILE_NAME, TRAY_ICON_FILE_NAME, WINDOWS_APP_ICON_FILE_NAME]
      : [WINDOWS_APP_ICON_FILE_NAME, TRAY_ICON_FILE_NAME, LINUX_APP_ICON_FILE_NAME];

  for (const iconFileName of iconCandidates) {
    const iconPath = path.join(__dirname, "../assets", iconFileName);
    if (fs.existsSync(iconPath)) {
      return iconPath;
    }
  }

  return undefined;
}

function serializeDiagnosticDetails(details: unknown): string {
  if (details instanceof Error) {
    const stack = details.stack ? `\n${details.stack}` : "";
    return `${details.name}: ${details.message}${stack}`;
  }
  if (typeof details === "string") {
    return details;
  }
  try {
    return JSON.stringify(details);
  } catch {
    return String(details);
  }
}

function appendDiagnosticLog(level: "INFO" | "WARN" | "ERROR", message: string, details?: unknown): void {
  if (!diagnosticsLogFilePath) {
    return;
  }

  const detailText = details === undefined ? "" : ` | ${serializeDiagnosticDetails(details)}`;
  const line = `${new Date().toISOString()} [${level}] ${message}${detailText}\n`;

  try {
    fs.appendFileSync(diagnosticsLogFilePath, line, "utf8");
  } catch (error) {
    console.error("Failed to append desktop diagnostics log.", error);
  }
}

function initializeDiagnosticsLogging(): void {
  if (diagnosticsLoggingInitialized) {
    return;
  }
  diagnosticsLoggingInitialized = true;

  const logDir = path.join(app.getPath("userData"), DIAGNOSTICS_LOG_DIR_NAME);
  fs.mkdirSync(logDir, { recursive: true });
  diagnosticsLogFilePath = path.join(logDir, DIAGNOSTICS_LOG_FILE_NAME);
  appendDiagnosticLog("INFO", "Desktop diagnostics logging initialized.", {
    platform: process.platform,
    appVersion: app.getVersion()
  });

  process.on("uncaughtException", (error) => {
    appendDiagnosticLog("ERROR", "Uncaught exception in main process.", error);
    console.error("Uncaught exception in main process.", error);
  });

  process.on("unhandledRejection", (reason) => {
    appendDiagnosticLog("ERROR", "Unhandled rejection in main process.", reason);
    console.error("Unhandled rejection in main process.", reason);
  });

  app.on("render-process-gone", (_event, webContents, details) => {
    appendDiagnosticLog("ERROR", "Renderer process exited unexpectedly.", {
      details,
      webContentsId: webContents.id
    });
  });

  app.on("child-process-gone", (_event, details) => {
    appendDiagnosticLog("ERROR", "Electron child process exited unexpectedly.", details);
  });
}

function createDatabaseVault(secretPath: string): FileSecretVault {
  return new FileSecretVault(secretPath, {
    isAvailable: () => safeStorage.isEncryptionAvailable(),
    encrypt: (value) => safeStorage.encryptString(value),
    decrypt: (value) => safeStorage.decryptString(value)
  });
}

function initializeDatabaseAndAlerts(): void {
  const vault = createDatabaseVault(getDatabaseKeyPath());
  const keyHex = resolveDatabaseKey(vault);
  databaseHandle = bootstrapEncryptedDatabase(getDatabaseDataDirectory(), keyHex);
  runMigrations(databaseHandle.db);
  alertStore = createDatabaseAlertStore(databaseHandle.db);
  backupHealthState = loadBackupHealthState(getBackupHealthPath());
}

function stopSchedulerAndCloseDatabase(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }

  if (databaseHandle) {
    databaseHandle.db.close();
    databaseHandle = null;
  }

  alertStore = null;
}

function getRuntimeSettingsPath(): string {
  if (runtimeSettingsPath) {
    return runtimeSettingsPath;
  }

  runtimeSettingsPath = path.join(app.getPath("userData"), SETTINGS_FILE_NAME);
  return runtimeSettingsPath;
}

function persistRuntimeSettings(nextSettings: RuntimeSettings): RuntimeSettings {
  runtimeSettings = nextSettings;
  writeRuntimeSettings(getRuntimeSettingsPath(), runtimeSettings);
  app.setLoginItemSettings(
    buildLoginItemSettings(runtimeSettings.startWithWindows, process.platform)
  );
  return runtimeSettings;
}

function persistBackupHealthState(nextState: BackupHealthState): void {
  backupHealthState = nextState;
  saveBackupHealthState(getBackupHealthPath(), backupHealthState);
}

function getTeamsSettings(): TeamsChannelSettings {
  return {
    enabled: runtimeSettings.teamsEnabled,
    webhookUrl: runtimeSettings.teamsWebhookUrl
  };
}

function requireAlertStore(): AlertStore {
  if (!alertStore) {
    throw new Error("Alert store is not initialized.");
  }
  return alertStore;
}

function requireDatabaseHandle(): NonNullable<typeof databaseHandle> {
  if (!databaseHandle) {
    throw new Error("Encrypted database is not initialized.");
  }
  return databaseHandle;
}

function getCrudRepository(): BudgetCrudRepository {
  return new BudgetCrudRepository(requireDatabaseHandle().db);
}

function requireObjectPayload(
  payload: unknown,
  errorMessage: string
): Record<string, unknown> {
  if (!payload || typeof payload !== "object") {
    throw new Error(errorMessage);
  }
  return payload as Record<string, unknown>;
}

function getRequiredString(
  source: Record<string, unknown>,
  key: string,
  errorMessage: string
): string {
  const value = source[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(errorMessage);
  }
  return value.trim();
}

function getOptionalString(
  source: Record<string, unknown>,
  key: string
): string | undefined {
  const value = source[key];
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function getOptionalNullableString(
  source: Record<string, unknown>,
  key: string
): string | null | undefined {
  const value = source[key];
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function getOptionalNumber(
  source: Record<string, unknown>,
  key: string
): number | undefined {
  const value = source[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return value;
}

function getOptionalBoolean(
  source: Record<string, unknown>,
  key: string
): boolean | undefined {
  const value = source[key];
  if (typeof value !== "boolean") {
    return undefined;
  }
  return value;
}

function getOptionalEnumValue<T extends string>(
  source: Record<string, unknown>,
  key: string,
  allowed: readonly T[]
): T | undefined {
  const value = getOptionalString(source, key);
  if (!value) {
    return undefined;
  }
  return (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

function getOptionalNullableEnumValue<T extends string>(
  source: Record<string, unknown>,
  key: string,
  allowed: readonly T[]
): T | null | undefined {
  const value = getOptionalNullableString(source, key);
  if (value === undefined || value === null) {
    return value;
  }
  return (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

function getRequiredEnumValue<T extends string>(
  source: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  errorMessage: string
): T {
  const value = getRequiredString(source, key, errorMessage);
  if (!(allowed as readonly string[]).includes(value)) {
    throw new Error(errorMessage);
  }
  return value as T;
}

function getRequiredIdPayload(payload: unknown, channelName: string): string {
  const value = requireObjectPayload(payload, `${channelName} requires payload with id.`);
  return getRequiredString(value, "id", `${channelName} requires a non-empty id.`);
}

function writeAuditLog(input: {
  action: string;
  entityType: string;
  entityId: string;
  actor?: string;
  before?: unknown;
  after?: unknown;
}): void {
  const handle = requireDatabaseHandle();
  handle.db
    .prepare(
      `
        INSERT INTO audit_log (
          id,
          actor,
          action,
          entity_type,
          entity_id,
          before_json,
          after_json,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `
    )
    .run(
      crypto.randomUUID(),
      input.actor ?? DEFAULT_SINGLE_USER_ACTOR,
      input.action,
      input.entityType,
      input.entityId,
      input.before === undefined ? null : JSON.stringify(input.before),
      input.after === undefined ? null : JSON.stringify(input.after)
    );
}

function writeApprovalRecord(input: {
  scenarioId?: string;
  servicePlanId?: string;
  entityType: string;
  entityId: string;
  action: string;
  actor?: string;
  comment?: string;
}): string {
  const handle = requireDatabaseHandle();
  const id = crypto.randomUUID();
  handle.db
    .prepare(
      `
        INSERT INTO approval_record (
          id,
          scenario_id,
          service_plan_id,
          entity_type,
          entity_id,
          action,
          actor,
          comment,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `
    )
    .run(
      id,
      input.scenarioId ?? null,
      input.servicePlanId ?? null,
      input.entityType,
      input.entityId,
      input.action,
      input.actor ?? DEFAULT_SINGLE_USER_ACTOR,
      input.comment ?? null
    );
  return id;
}

function parseAckPayload(payload: unknown): { alertEventId: string } {
  if (!payload || typeof payload !== "object") {
    throw new Error("alerts.ack requires { alertEventId } payload.");
  }
  const value = payload as { alertEventId?: unknown };
  if (typeof value.alertEventId !== "string" || value.alertEventId.trim().length === 0) {
    throw new Error("alerts.ack requires a non-empty alertEventId.");
  }
  return { alertEventId: value.alertEventId };
}

function parseSnoozePayload(payload: unknown): {
  alertEventId: string;
  snoozedUntil: string | null;
} {
  if (!payload || typeof payload !== "object") {
    throw new Error("alerts.snooze requires payload.");
  }
  const value = payload as { alertEventId?: unknown; snoozedUntil?: unknown };
  if (typeof value.alertEventId !== "string" || value.alertEventId.trim().length === 0) {
    throw new Error("alerts.snooze requires a non-empty alertEventId.");
  }

  if (value.snoozedUntil === null || typeof value.snoozedUntil === "undefined") {
    return { alertEventId: value.alertEventId, snoozedUntil: null };
  }

  if (typeof value.snoozedUntil !== "string" || value.snoozedUntil.trim().length === 0) {
    throw new Error("alerts.snooze requires snoozedUntil to be an ISO date string or null.");
  }

  return { alertEventId: value.alertEventId, snoozedUntil: value.snoozedUntil };
}

function parseBackupCreatePayload(payload: unknown): { destinationDir: string } {
  const defaultDestination = path.join(app.getPath("documents"), DEFAULT_BACKUP_SUBDIR);
  if (!payload || typeof payload !== "object") {
    return { destinationDir: defaultDestination };
  }

  const value = payload as { destinationDir?: unknown };
  if (typeof value.destinationDir !== "string" || value.destinationDir.trim().length === 0) {
    return { destinationDir: defaultDestination };
  }

  return { destinationDir: value.destinationDir };
}

function parseBackupRestorePayload(payload: unknown): {
  backupPath: string;
  manifestPath: string;
} {
  if (!payload || typeof payload !== "object") {
    throw new Error("backup.restore requires backupPath and manifestPath.");
  }

  const value = payload as { backupPath?: unknown; manifestPath?: unknown };
  if (typeof value.backupPath !== "string" || value.backupPath.trim().length === 0) {
    throw new Error("backup.restore requires a non-empty backupPath.");
  }
  if (typeof value.manifestPath !== "string" || value.manifestPath.trim().length === 0) {
    throw new Error("backup.restore requires a non-empty manifestPath.");
  }

  return {
    backupPath: value.backupPath,
    manifestPath: value.manifestPath
  };
}

function parseBackupVerifyPayload(payload: unknown): {
  backupPath: string | null;
  manifestPath: string | null;
} {
  if (!payload || typeof payload !== "object") {
    return { backupPath: null, manifestPath: null };
  }

  const value = payload as { backupPath?: unknown; manifestPath?: unknown };
  return {
    backupPath: typeof value.backupPath === "string" && value.backupPath.trim().length > 0 ? value.backupPath : null,
    manifestPath:
      typeof value.manifestPath === "string" && value.manifestPath.trim().length > 0 ? value.manifestPath : null
  };
}

function parseDbRekeyPayload(payload: unknown): {
  newKeyHex?: string;
} {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const value = payload as { newKeyHex?: unknown };
  if (typeof value.newKeyHex !== "string" || value.newKeyHex.trim().length === 0) {
    return {};
  }
  const normalized = value.newKeyHex.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new Error("db.rekey newKeyHex must be a 64-character hex key.");
  }
  return { newKeyHex: normalized };
}

function parseHelpOpenPayload(payload: unknown): {
  topic?: string;
  anchor?: string;
} {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const value = payload as { topic?: unknown; anchor?: unknown };
  const topic =
    typeof value.topic === "string" && value.topic.trim().length > 0
      ? value.topic.trim()
      : undefined;
  const anchor =
    typeof value.anchor === "string" && value.anchor.trim().length > 0
      ? value.anchor.trim()
      : undefined;

  return { topic, anchor };
}

export function parsePickFileDialogPayload(payload: unknown): {
  title?: string;
  defaultPath?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
} {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const value = payload as {
    title?: unknown;
    defaultPath?: unknown;
    filters?: unknown;
  };

  const filters = Array.isArray(value.filters)
    ? value.filters
        .filter((entry): entry is { name?: unknown; extensions?: unknown } =>
          Boolean(entry && typeof entry === "object")
        )
        .map((entry) => ({
          name:
            typeof entry.name === "string" && entry.name.trim().length > 0
              ? entry.name.trim()
              : "Files",
          extensions: Array.isArray(entry.extensions)
            ? entry.extensions.filter(
                (extension): extension is string =>
                  typeof extension === "string" && extension.trim().length > 0
              )
            : []
        }))
        .filter((entry) => entry.extensions.length > 0)
    : undefined;

  return {
    title:
      typeof value.title === "string" && value.title.trim().length > 0
        ? value.title.trim()
        : undefined,
    defaultPath:
      typeof value.defaultPath === "string" && value.defaultPath.trim().length > 0
        ? value.defaultPath.trim()
        : undefined,
    filters
  };
}

export function parsePickDirectoryDialogPayload(payload: unknown): {
  title?: string;
  defaultPath?: string;
} {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const value = payload as { title?: unknown; defaultPath?: unknown };
  return {
    title:
      typeof value.title === "string" && value.title.trim().length > 0
        ? value.title.trim()
        : undefined,
    defaultPath:
      typeof value.defaultPath === "string" && value.defaultPath.trim().length > 0
        ? value.defaultPath.trim()
        : undefined
  };
}

function parseImportPayload(payload: unknown): {
  mode: "expenses" | "actuals";
  filePath: string;
  mapping?: Record<string, string>;
  templateName?: string;
  templatePack?: "aws-cur" | "azure-cost" | "gcp-billing";
  useSavedTemplate?: boolean;
  saveTemplate?: boolean;
  requireFinanceMetadata?: boolean;
} {
  if (!payload || typeof payload !== "object") {
    throw new Error("import payload requires a filePath.");
  }

  const value = payload as {
    mode?: unknown;
    filePath?: unknown;
    mapping?: unknown;
    templateName?: unknown;
    templatePack?: unknown;
    useSavedTemplate?: unknown;
    saveTemplate?: unknown;
    requireFinanceMetadata?: unknown;
  };

  if (typeof value.filePath !== "string" || value.filePath.trim().length === 0) {
    throw new Error("import payload requires a non-empty filePath.");
  }

  let mapping: Record<string, string> | undefined;
  if (value.mapping && typeof value.mapping === "object") {
    const entries = Object.entries(value.mapping as Record<string, unknown>);
    mapping = {};
    for (const [field, column] of entries) {
      if (!IMPORT_FIELDS.has(field) || typeof column !== "string" || column.trim().length === 0) {
        continue;
      }
      mapping[field as keyof ImportColumnMapping] = column;
    }
  }

  const templateName =
    typeof value.templateName === "string" && value.templateName.trim().length > 0
      ? value.templateName
      : undefined;
  const templatePack =
    value.templatePack === "aws-cur" ||
    value.templatePack === "azure-cost" ||
    value.templatePack === "gcp-billing"
      ? value.templatePack
      : undefined;

  return {
    mode: value.mode === "actuals" ? "actuals" : "expenses",
    filePath: value.filePath,
    mapping,
    templateName,
    templatePack,
    useSavedTemplate: typeof value.useSavedTemplate === "boolean" ? value.useSavedTemplate : undefined,
    saveTemplate: typeof value.saveTemplate === "boolean" ? value.saveTemplate : undefined,
    requireFinanceMetadata:
      typeof value.requireFinanceMetadata === "boolean"
        ? value.requireFinanceMetadata
        : undefined
  };
}

function parseReportFilters(payload: unknown): ReportDatasetFilters | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const value = payload as { dateFrom?: unknown; dateTo?: unknown; tag?: unknown };
  const dateFrom =
    typeof value.dateFrom === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.dateFrom)
      ? value.dateFrom
      : undefined;
  const dateTo =
    typeof value.dateTo === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.dateTo)
      ? value.dateTo
      : undefined;
  const tag =
    typeof value.tag === "string" && value.tag.trim().length > 0 ? value.tag.trim() : undefined;

  if (!dateFrom && !dateTo && !tag) {
    return undefined;
  }

  return {
    dateFrom,
    dateTo,
    tag
  };
}

function isReportPresetQuery(value: ReportsQueryValue): value is ReportPresetQuery {
  return REPORT_PRESET_QUERY_SET.has(value as ReportPresetQuery);
}

export function parseReportsQueryPayload(payload: unknown): {
  query: ReportsQueryValue;
  scenarioId: string;
  servicePlanId?: string;
  horizonMonths?: number;
  comparisonScenarioId?: string;
  baselineScenarioId?: string;
  filters?: ReportDatasetFilters;
} {
  if (!payload || typeof payload !== "object") {
    throw new Error("reports.query requires payload with query and scenarioId.");
  }
  const value = payload as {
    query?: unknown;
    scenarioId?: unknown;
    servicePlanId?: unknown;
    horizonMonths?: unknown;
    comparisonScenarioId?: unknown;
    baselineScenarioId?: unknown;
    filters?: unknown;
  };
  if (typeof value.query !== "string" || value.query.trim().length === 0) {
    throw new Error("reports.query requires a non-empty query.");
  }
  const query = value.query.trim() as ReportsQueryValue;
  if (!REPORT_QUERY_SET.has(query)) {
    throw new Error(`Unsupported reports.query value: ${value.query}`);
  }
  const scenarioId = getRequiredString(
    value,
    "scenarioId",
    "reports.query requires a non-empty scenarioId."
  );
  const parsedHorizon =
    typeof value.horizonMonths === "number" && Number.isFinite(value.horizonMonths)
      ? Math.floor(value.horizonMonths)
      : undefined;
  const horizonMonths =
    parsedHorizon && parsedHorizon > 0 && parsedHorizon <= 60 ? parsedHorizon : undefined;
  const baselineScenarioId =
    typeof value.baselineScenarioId === "string" && value.baselineScenarioId.trim().length > 0
      ? value.baselineScenarioId.trim()
      : undefined;
  if (query === "scenario.comparison" && !baselineScenarioId) {
    throw new Error("reports.query scenario.comparison requires baselineScenarioId.");
  }
  return {
    query,
    scenarioId,
    servicePlanId:
      typeof value.servicePlanId === "string" && value.servicePlanId.trim().length > 0
        ? value.servicePlanId
        : undefined,
    horizonMonths,
    comparisonScenarioId:
      typeof value.comparisonScenarioId === "string" && value.comparisonScenarioId.trim().length > 0
        ? value.comparisonScenarioId.trim()
        : undefined,
    baselineScenarioId,
    filters: parseReportFilters(value.filters)
  };
}

type ExportReportType = ReportPresetQuery | "nlq.results";

export function parseExportReportPayload(payload: unknown, defaultOutputDir: string = path.join(app.getPath("documents"), DEFAULT_EXPORT_SUBDIR)): {
  scenarioId: string;
  reportType: ExportReportType;
  outputDir: string;
  baseFileName?: string;
  formats?: ExportFormat[];
  filters?: ReportDatasetFilters;
  filterSpec?: FilterSpec;
} {
  if (!payload || typeof payload !== "object") {
    throw new Error("export.report requires payload with scenarioId.");
  }

  const value = payload as {
    scenarioId?: unknown;
    reportType?: unknown;
    outputDir?: unknown;
    destinationPath?: unknown;
    baseFileName?: unknown;
    formats?: unknown;
    filters?: unknown;
    filterSpec?: unknown;
  };

  const scenarioId = getRequiredString(
    value,
    "scenarioId",
    "export.report requires a non-empty scenarioId."
  );
  const reportTypeCandidate =
    typeof value.reportType === "string" && value.reportType.trim().length > 0
      ? value.reportType.trim()
      : "dashboard.summary";
  const reportTypeValues = new Set<string>([...REPORT_PRESET_QUERY_SET, "nlq.results"]);
  if (!reportTypeValues.has(reportTypeCandidate)) {
    throw new Error(`Unsupported export.report reportType: ${reportTypeCandidate}`);
  }
  const reportType = reportTypeCandidate as ExportReportType;
  const legacyDestinationPath =
    typeof value.destinationPath === "string" && value.destinationPath.trim().length > 0
      ? value.destinationPath
      : undefined;
  const outputDir =
    typeof value.outputDir === "string" && value.outputDir.trim().length > 0
      ? value.outputDir
      : legacyDestinationPath ?? defaultOutputDir;
  const baseFileName =
    typeof value.baseFileName === "string" && value.baseFileName.trim().length > 0
      ? value.baseFileName
      : undefined;

  const allowedFormats = new Set<ExportFormat>(["html", "pdf", "excel", "csv", "png"]);
  let formats: ExportFormat[] | undefined;
  if (value.formats !== undefined) {
    if (!Array.isArray(value.formats) || !value.formats.every((entry) => typeof entry === "string")) {
      throw new Error("export.report formats must be an array of strings.");
    }

    const parsedFormats: ExportFormat[] = [];
    for (const entry of value.formats) {
      const normalized = entry.trim() as ExportFormat;
      if (!allowedFormats.has(normalized)) {
        throw new Error(`Unsupported export.report format: ${entry}`);
      }
      parsedFormats.push(normalized);
    }
    formats = parsedFormats;
  }
  const filters = parseReportFilters(value.filters);
  const filterSpec =
    value.filterSpec && typeof value.filterSpec === "object" ? (value.filterSpec as FilterSpec) : undefined;

  return {
    scenarioId,
    reportType,
    outputDir,
    baseFileName,
    formats,
    filters,
    filterSpec
  };
}

export function parseReportPreviewPayload(payload: unknown): {
  scenarioId: string;
  reportType: ReportPresetQuery;
  filters?: ReportDatasetFilters;
} {
  if (!payload || typeof payload !== "object") {
    throw new Error("report.preview requires payload with scenarioId.");
  }

  const value = payload as {
    scenarioId?: unknown;
    reportType?: unknown;
    filters?: unknown;
  };

  const scenarioId = getRequiredString(
    value,
    "scenarioId",
    "report.preview requires a non-empty scenarioId."
  );
  const reportTypeCandidate =
    typeof value.reportType === "string" && value.reportType.trim().length > 0
      ? value.reportType.trim()
      : "dashboard.summary";

  if (!REPORT_PRESET_QUERY_SET.has(reportTypeCandidate as ReportPresetQuery)) {
    throw new Error(`Unsupported report.preview reportType: ${reportTypeCandidate}`);
  }

  return {
    scenarioId,
    reportType: reportTypeCandidate as ReportPresetQuery,
    filters: parseReportFilters(value.filters)
  };
}

function parseNlqPayload(payload: unknown): {
  query: string;
  referenceDate?: string;
} {
  if (!payload || typeof payload !== "object") {
    throw new Error("nlq.parse requires payload with query.");
  }

  const value = payload as { query?: unknown; referenceDate?: unknown };
  if (typeof value.query !== "string" || value.query.trim().length === 0) {
    throw new Error("nlq.parse requires a non-empty query.");
  }
  return {
    query: value.query,
    referenceDate:
      typeof value.referenceDate === "string" && value.referenceDate.trim().length > 0
        ? value.referenceDate
        : undefined
  };
}

function isIsoDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function parseUnmatchedListPayload(payload: unknown): { scenarioId: string } {
  const value = requireObjectPayload(
    payload,
    "actuals.unmatched.list requires payload with scenarioId."
  );
  return {
    scenarioId: getRequiredString(
      value,
      "scenarioId",
      "actuals.unmatched.list requires scenarioId."
    )
  };
}

type UnmatchedReviewDisposition = "matched" | "rejected" | "ignored" | "create_expense";

export function parseUnmatchedReviewPayload(payload: unknown): {
  transactionId: string;
  scenarioId: string;
  disposition: UnmatchedReviewDisposition;
  matchedOccurrenceId?: string;
  reviewer: string;
  driverTag?: "timing" | "price" | "scope";
  comment?: string;
} {
  const value = requireObjectPayload(
    payload,
    "actuals.unmatched.review requires payload with transactionId and disposition."
  );
  const dispositionRaw = getRequiredString(
    value,
    "disposition",
    "actuals.unmatched.review requires disposition."
  );
  if (
    dispositionRaw !== "matched" &&
    dispositionRaw !== "rejected" &&
    dispositionRaw !== "ignored" &&
    dispositionRaw !== "create_expense"
  ) {
    throw new Error("actuals.unmatched.review disposition is invalid.");
  }
  const matchedOccurrenceId = getOptionalString(value, "matchedOccurrenceId");
  if (dispositionRaw === "matched" && !matchedOccurrenceId) {
    throw new Error("actuals.unmatched.review matched disposition requires matchedOccurrenceId.");
  }
  const driverTag = getOptionalString(value, "driverTag");
  if (driverTag && driverTag !== "timing" && driverTag !== "price" && driverTag !== "scope") {
    throw new Error("actuals.unmatched.review driverTag must be timing, price, or scope.");
  }
  return {
    transactionId: getRequiredString(
      value,
      "transactionId",
      "actuals.unmatched.review requires transactionId."
    ),
    scenarioId: getRequiredString(
      value,
      "scenarioId",
      "actuals.unmatched.review requires scenarioId."
    ),
    disposition: dispositionRaw,
    matchedOccurrenceId,
    reviewer: getOptionalString(value, "reviewer") ?? DEFAULT_SINGLE_USER_ACTOR,
    driverTag: driverTag as "timing" | "price" | "scope" | undefined,
    comment: getOptionalString(value, "comment")
  };
}

export function parseUnmatchedCreateExpensePayload(payload: unknown): {
  transactionId: string;
  scenarioId: string;
  reviewer: string;
  name?: string;
  expenseType?: "recurring" | "one_time";
  status?: "planned" | "approved" | "committed" | "actual" | "cancelled";
  capexOpex?: "capex" | "opex" | null;
  glAccountCode?: string | null;
  costCenterCode?: string | null;
  fundingSource?: string | null;
  comment?: string;
  driverTag?: "timing" | "price" | "scope";
} {
  const value = requireObjectPayload(
    payload,
    "actuals.unmatched.createExpense requires payload with transactionId."
  );
  const expenseType = getOptionalString(value, "expenseType");
  if (expenseType && expenseType !== "recurring" && expenseType !== "one_time") {
    throw new Error("actuals.unmatched.createExpense expenseType is invalid.");
  }
  const status = getOptionalString(value, "status");
  if (
    status &&
    status !== "planned" &&
    status !== "approved" &&
    status !== "committed" &&
    status !== "actual" &&
    status !== "cancelled"
  ) {
    throw new Error("actuals.unmatched.createExpense status is invalid.");
  }
  const capexOpex = getOptionalNullableString(value, "capexOpex");
  if (capexOpex !== undefined && capexOpex !== null && capexOpex !== "capex" && capexOpex !== "opex") {
    throw new Error("actuals.unmatched.createExpense capexOpex must be capex or opex.");
  }
  const driverTag = getOptionalString(value, "driverTag");
  if (driverTag && driverTag !== "timing" && driverTag !== "price" && driverTag !== "scope") {
    throw new Error("actuals.unmatched.createExpense driverTag must be timing, price, or scope.");
  }
  return {
    transactionId: getRequiredString(
      value,
      "transactionId",
      "actuals.unmatched.createExpense requires transactionId."
    ),
    scenarioId: getRequiredString(
      value,
      "scenarioId",
      "actuals.unmatched.createExpense requires scenarioId."
    ),
    reviewer: getOptionalString(value, "reviewer") ?? DEFAULT_SINGLE_USER_ACTOR,
    name: getOptionalString(value, "name"),
    expenseType: expenseType as "recurring" | "one_time" | undefined,
    status: status as "planned" | "approved" | "committed" | "actual" | "cancelled" | undefined,
    capexOpex: capexOpex as "capex" | "opex" | null | undefined,
    glAccountCode: getOptionalNullableString(value, "glAccountCode"),
    costCenterCode: getOptionalNullableString(value, "costCenterCode"),
    fundingSource: getOptionalNullableString(value, "fundingSource"),
    comment: getOptionalString(value, "comment"),
    driverTag: driverTag as "timing" | "price" | "scope" | undefined
  };
}

export function parseScenarioSettingsPayload(
  payload: unknown,
  actionName: "scenarioSettings.get" | "scenarioSettings.update"
): { scenarioId: string } {
  const value = requireObjectPayload(payload, `${actionName} requires payload with scenarioId.`);
  return {
    scenarioId: getRequiredString(value, "scenarioId", `${actionName} requires scenarioId.`)
  };
}

export function parseExpenseListPayload(payload: unknown): {
  scenarioId: string;
  includeDeleted: boolean;
} {
  const value = requireObjectPayload(payload, "expenses.list requires payload with scenarioId.");
  return {
    scenarioId: getRequiredString(value, "scenarioId", "expenses.list requires scenarioId."),
    includeDeleted: value.includeDeleted === true
  };
}

function parseShowbackGeneratePayload(payload: unknown): {
  scenarioId: string;
  periodStart: string;
  periodEnd: string;
  groupBy: "cost_center" | "team";
  generatedBy: string;
  currency?: string;
} {
  const value = requireObjectPayload(payload, "showback.generate requires payload.");
  const periodStart = getRequiredString(value, "periodStart", "showback.generate requires periodStart.");
  const periodEnd = getRequiredString(value, "periodEnd", "showback.generate requires periodEnd.");
  if (!isIsoDateString(periodStart) || !isIsoDateString(periodEnd)) {
    throw new Error("showback.generate periodStart and periodEnd must be YYYY-MM-DD.");
  }
  const groupBy = getOptionalString(value, "groupBy");
  if (groupBy && groupBy !== "cost_center" && groupBy !== "team") {
    throw new Error("showback.generate groupBy must be cost_center or team.");
  }
  return {
    scenarioId: getRequiredString(
      value,
      "scenarioId",
      "showback.generate requires scenarioId."
    ),
    periodStart,
    periodEnd,
    groupBy: (groupBy as "cost_center" | "team" | undefined) ?? "cost_center",
    generatedBy: getOptionalString(value, "generatedBy") ?? DEFAULT_SINGLE_USER_ACTOR,
    currency: getOptionalString(value, "currency")
  };
}

export function parseShowbackListPayload(payload: unknown): {
  scenarioId?: string;
  includeLines: boolean;
} {
  if (!payload || typeof payload !== "object") {
    return { includeLines: false };
  }
  const value = payload as { scenarioId?: unknown; includeLines?: unknown };
  return {
    scenarioId:
      typeof value.scenarioId === "string" && value.scenarioId.trim().length > 0
        ? value.scenarioId.trim()
        : undefined,
    includeLines: typeof value.includeLines === "boolean" ? value.includeLines : false
  };
}

function parseShowbackExportPayload(payload: unknown): {
  statementId: string;
  format: "csv" | "xlsx";
  outputDir: string;
  baseFileName?: string;
} {
  const value = requireObjectPayload(payload, "showback.export requires payload.");
  const formatRaw = getOptionalString(value, "format") ?? "csv";
  if (formatRaw !== "csv" && formatRaw !== "xlsx") {
    throw new Error("showback.export format must be csv or xlsx.");
  }
  const outputDir =
    getOptionalString(value, "outputDir") ?? path.join(app.getPath("documents"), DEFAULT_EXPORT_SUBDIR);
  return {
    statementId: getRequiredString(value, "statementId", "showback.export requires statementId."),
    format: formatRaw,
    outputDir,
    baseFileName: getOptionalString(value, "baseFileName")
  };
}

export function parseApprovalCreatePayload(payload: unknown): {
  scenarioId: string;
  servicePlanId?: string;
  entityType: string;
  entityId: string;
  action: string;
  actor: string;
  comment?: string;
} {
  const value = requireObjectPayload(payload, "approvals.create requires payload with scenarioId.");
  return {
    scenarioId: getRequiredString(value, "scenarioId", "approvals.create requires scenarioId."),
    servicePlanId: getOptionalString(value, "servicePlanId"),
    entityType: getRequiredString(value, "entityType", "approvals.create requires entityType."),
    entityId: getRequiredString(value, "entityId", "approvals.create requires entityId."),
    action: getRequiredString(value, "action", "approvals.create requires action."),
    actor: getOptionalString(value, "actor") ?? DEFAULT_SINGLE_USER_ACTOR,
    comment: getOptionalString(value, "comment")
  };
}

export function parseApprovalListPayload(payload: unknown): {
  scenarioId: string;
  entityType?: string;
  limit: number;
} {
  const value = requireObjectPayload(payload, "approvals.list requires payload with scenarioId.");
  const limitRaw =
    typeof value.limit === "number" && Number.isFinite(value.limit)
      ? Math.floor(value.limit)
      : 100;
  return {
    scenarioId: getRequiredString(value, "scenarioId", "approvals.list requires scenarioId."),
    entityType: getOptionalString(value, "entityType"),
    limit: Math.min(Math.max(limitRaw, 1), 500)
  };
}

function parseAuditListPayload(payload: unknown): {
  entityType?: string;
  entityId?: string;
  limit: number;
} {
  if (!payload || typeof payload !== "object") {
    return { limit: 250 };
  }
  const value = payload as { entityType?: unknown; entityId?: unknown; limit?: unknown };
  const limitRaw = typeof value.limit === "number" && Number.isFinite(value.limit) ? Math.floor(value.limit) : 250;
  return {
    entityType:
      typeof value.entityType === "string" && value.entityType.trim().length > 0
        ? value.entityType.trim()
        : undefined,
    entityId:
      typeof value.entityId === "string" && value.entityId.trim().length > 0
        ? value.entityId.trim()
        : undefined,
    limit: Math.min(Math.max(limitRaw, 1), 1000)
  };
}

function parseNotificationEndpointListPayload(payload: unknown): {
  endpointType?: string;
  limit: number;
} {
  if (!payload || typeof payload !== "object") {
    return { limit: 50 };
  }
  const value = payload as { endpointType?: unknown; limit?: unknown };
  const limitRaw = typeof value.limit === "number" && Number.isFinite(value.limit) ? Math.floor(value.limit) : 50;
  return {
    endpointType:
      typeof value.endpointType === "string" && value.endpointType.trim().length > 0
        ? value.endpointType.trim()
        : undefined,
    limit: Math.min(Math.max(limitRaw, 1), 500)
  };
}

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  const text = String(value);
  if (!text.includes(",") && !text.includes("\"") && !text.includes("\n")) {
    return text;
  }
  return `"${text.replaceAll("\"", "\"\"")}"`;
}

async function withHiddenReportWindow<T>(html: string, run: (window: BrowserWindow) => Promise<T>): Promise<T> {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true
    }
  });

  try {
    await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
    return await run(window);
  } finally {
    window.destroy();
  }
}

function createElectronReportRenderers(): ReportRenderers {
  return {
    renderPdf: async (html: string) =>
      withHiddenReportWindow(html, async (window) =>
        Buffer.from(
          await window.webContents.printToPDF({
            printBackground: true
          })
        )
      ),
    renderPng: async (html: string) =>
      withHiddenReportWindow(html, async (window) => {
        const image = await window.webContents.capturePage();
        return image.toPNG();
      })
  };
}

function insertBackupReliabilityAlert(kind: string, message: string, severity: "info" | "high"): void {
  const handle = databaseHandle;
  if (!handle) {
    return;
  }

  const fireAt = currentIsoDate();
  const dedupeKey = `backup-health|${kind}|${fireAt}`;
  const formattedMessage = severity === "high" ? `[HIGH] ${message}` : message;

  try {
    handle.db
      .prepare(
        `
          INSERT INTO alert_event (
            id,
            scenario_id,
            alert_rule_id,
            entity_type,
            entity_id,
            fire_at,
            fired_at,
            status,
            snoozed_until,
            dedupe_key,
            message,
            created_at,
            updated_at
          ) VALUES (?, 'baseline', 'system-backup-health', 'backup', 'system', ?, NULL, 'pending', NULL, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `
      )
      .run(crypto.randomUUID(), fireAt, dedupeKey, formattedMessage);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (!detail.includes("UNIQUE")) {
      throw error;
    }
  }
}

function monitorBackupFreshness(nowIsoDate: string): void {
  const freshness = evaluateBackupFreshness(backupHealthState, {
    nowIso: nowIsoDate,
    staleThresholdDays: BACKUP_STALE_THRESHOLD_DAYS
  });

  if (!freshness.shouldAlert) {
    return;
  }

  persistBackupHealthState(
    recordStaleBackupAlert(backupHealthState, {
      checkedAt: nowIsoDate,
      detail: freshness.detail
    })
  );
  insertBackupReliabilityAlert("stale", freshness.detail, "high");
}

function setupIpcHandlers(requestExit: () => void): void {
  ipcMain.handle("help.open", async (_event, payload: unknown) => {
    const parsed = parseHelpOpenPayload(payload);
    openHelpWindow(parsed);
    return { ok: true } as const;
  });

  ipcMain.handle("help.document.get", async () => getHelpDocument());

  ipcMain.handle("dialog.pickFile", async (_event, payload: unknown) => {
    const parsed = parsePickFileDialogPayload(payload);
    const result = await dialog.showOpenDialog({
      title: parsed.title,
      defaultPath: parsed.defaultPath,
      filters: parsed.filters,
      properties: ["openFile"]
    });
    return result.canceled ? null : result.filePaths[0] ?? null;
  });

  ipcMain.handle("dialog.pickDirectory", async (_event, payload: unknown) => {
    const parsed = parsePickDirectoryDialogPayload(payload);
    const result = await dialog.showOpenDialog({
      title: parsed.title,
      defaultPath: parsed.defaultPath,
      properties: ["openDirectory", "createDirectory"]
    });
    return result.canceled ? null : result.filePaths[0] ?? null;
  });

  ipcMain.handle("settings.get", async () => ({
    ...runtimeSettings,
    lastRestoreSummary
  }));
  ipcMain.handle("settings.update", async (_event, payload: Partial<RuntimeSettings>) => {
    const nextSettings = mergeRuntimeSettings(runtimeSettings, payload ?? {});
    return persistRuntimeSettings(nextSettings);
  });
  ipcMain.handle("app.exit", async () => {
    requestExit();
    return { ok: true };
  });
  ipcMain.handle("db.open", async () => {
    const handle = requireDatabaseHandle();
    const vault = createDatabaseVault(getDatabaseKeyPath());
    return {
      databasePath: handle.dbPath,
      keyPresent: vault.hasSecret(),
      safeStorageAvailable: safeStorage.isEncryptionAvailable()
    };
  });
  ipcMain.handle("db.rekey", async (_event, payload: unknown) => {
    const parsed = parseDbRekeyPayload(payload);
    const handle = requireDatabaseHandle();
    const currentKeyHex = handle.keyHex;
    const nextKeyHex = parsed.newKeyHex ?? crypto.randomBytes(32).toString("hex");
    if (nextKeyHex === currentKeyHex) {
      throw new Error("db.rekey requires a key different from the current key.");
    }

    const vault = createDatabaseVault(getDatabaseKeyPath());
    stopSchedulerAndCloseDatabase();
    try {
      rekeyEncryptedDatabase(handle.dbPath, currentKeyHex, nextKeyHex);
      vault.writeSecret(nextKeyHex);
    } finally {
      initializeDatabaseAndAlerts();
      startAlertScheduler();
    }

    return {
      ok: true,
      rotatedAt: new Date().toISOString()
    };
  });
  ipcMain.handle("backup.create", async (_event, payload: unknown) => {
    const parsed = parseBackupCreatePayload(payload);
    const handle = requireDatabaseHandle();
    const created = await createEncryptedBackup({
      sourceDbPath: handle.dbPath,
      dbKeyHex: handle.keyHex,
      destinationDir: parsed.destinationDir
    });
    persistBackupHealthState(
      recordBackupCreated(backupHealthState, {
        checkedAt: created.manifest.createdAt,
        backupPath: created.backupPath,
        manifestPath: created.manifestPath
      })
    );
    return created;
  });
  ipcMain.handle("backup.restore", async (_event, payload: unknown) => {
    const parsed = parseBackupRestorePayload(payload);
    const handle = requireDatabaseHandle();
    const restoreInput = {
      backupPath: parsed.backupPath,
      manifestPath: parsed.manifestPath,
      targetDbPath: handle.dbPath,
      dbKeyHex: handle.keyHex
    };

    stopSchedulerAndCloseDatabase();
    try {
      const restored = await restoreEncryptedBackup(restoreInput);
      lastRestoreSummary = restored;
      return restored;
    } finally {
      initializeDatabaseAndAlerts();
      startAlertScheduler();
    }
  });
  ipcMain.handle("backup.verify", async (_event, payload: unknown) => {
    const parsed = parseBackupVerifyPayload(payload);
    const backupPath = parsed.backupPath ?? backupHealthState.latestBackupPath;
    const manifestPath = parsed.manifestPath ?? backupHealthState.latestManifestPath;
    if (!backupPath || !manifestPath) {
      throw new Error("No backup is available to verify. Provide backupPath and manifestPath.");
    }

    const handle = requireDatabaseHandle();
    const schemaRow = handle.db
      .prepare("SELECT schema_version FROM meta WHERE id = 1")
      .get() as { schema_version: number } | undefined;
    const currentSchemaVersion = schemaRow?.schema_version ?? 0;
    const nowIsoDate = new Date().toISOString();
    const verifyTargetPath = path.join(os.tmpdir(), `budgetit-verify-${crypto.randomUUID()}.db`);

    try {
      await restoreEncryptedBackup({
        backupPath,
        manifestPath,
        targetDbPath: verifyTargetPath,
        dbKeyHex: handle.keyHex,
        currentSchemaVersion,
        restoredAt: new Date(nowIsoDate)
      });
      persistBackupHealthState(
        recordBackupVerificationSuccess(backupHealthState, {
          checkedAt: nowIsoDate,
          backupPath,
          manifestPath
        })
      );
      return {
        ok: true,
        lastVerifiedAt: backupHealthState.lastVerifiedAt
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      persistBackupHealthState(
        recordBackupVerificationFailure(backupHealthState, {
          checkedAt: nowIsoDate,
          backupPath,
          manifestPath,
          detail
        })
      );
      insertBackupReliabilityAlert("verify_failed", `Backup verification failed: ${detail}`, "high");
      return {
        ok: false,
        error: detail,
        lastVerifiedAt: backupHealthState.lastVerifiedAt
      };
    } finally {
      try {
        fs.rmSync(verifyTargetPath, { force: true });
        fs.rmSync(`${verifyTargetPath}-wal`, { force: true });
        fs.rmSync(`${verifyTargetPath}-shm`, { force: true });
      } catch {
        // Best-effort cleanup.
      }
    }
  });
  ipcMain.handle("alerts.list", async () => requireAlertStore().list());
  ipcMain.handle("alerts.ack", async (_event, payload: unknown) => {
    const parsed = parseAckPayload(payload);
    return requireAlertStore().acknowledge(parsed.alertEventId, currentIsoDate());
  });
  ipcMain.handle("alerts.snooze", async (_event, payload: unknown) => {
    const parsed = parseSnoozePayload(payload);
    if (!parsed.snoozedUntil) {
      return requireAlertStore().unsnooze(parsed.alertEventId);
    }
    return requireAlertStore().snooze(parsed.alertEventId, parsed.snoozedUntil);
  });
  ipcMain.handle("alerts.sendTest", async () => {
    const result = await teamsChannel.sendTest(getTeamsSettings());
    const handle = requireDatabaseHandle();
    const now = new Date().toISOString();
    handle.db
      .prepare(
        `
          INSERT INTO notification_endpoint (
            id,
            endpoint_type,
            endpoint_url,
            enabled,
            last_test_result,
            last_test_at,
            last_failure_reason,
            created_at,
            updated_at
          ) VALUES (?, 'teams', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET
            endpoint_url = excluded.endpoint_url,
            enabled = excluded.enabled,
            last_test_result = excluded.last_test_result,
            last_test_at = excluded.last_test_at,
            last_failure_reason = excluded.last_failure_reason,
            updated_at = CURRENT_TIMESTAMP
        `
      )
      .run(
        "teams-default",
        runtimeSettings.teamsWebhookUrl || "",
        runtimeSettings.teamsEnabled ? 1 : 0,
        result.ok ? "ok" : "failed",
        now,
        result.ok ? null : `status:${result.statusCode ?? "none"}`
      );
    return result;
  });
  ipcMain.handle("notifications.endpoints.list", async (_event, payload: unknown) => {
    const parsed = parseNotificationEndpointListPayload(payload);
    const handle = requireDatabaseHandle();
    const clauses: string[] = [];
    const params: string[] = [];
    if (parsed.endpointType) {
      clauses.push("endpoint_type = ?");
      params.push(parsed.endpointType);
    }
    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = handle.db
      .prepare(
        `
          SELECT
            id,
            endpoint_type AS endpointType,
            endpoint_url AS endpointUrl,
            enabled,
            last_test_result AS lastTestResult,
            last_test_at AS lastTestAt,
            last_failure_reason AS lastFailureReason,
            created_at AS createdAt,
            updated_at AS updatedAt
          FROM notification_endpoint
          ${whereClause}
          ORDER BY updated_at DESC
          LIMIT ?
        `
      )
      .all(...params, parsed.limit) as Array<{
      id: string;
      endpointType: string;
      endpointUrl: string;
      enabled: number;
      lastTestResult: string | null;
      lastTestAt: string | null;
      lastFailureReason: string | null;
      createdAt: string;
      updatedAt: string;
    }>;
    return rows.map((entry) => ({
      ...entry,
      enabled: entry.enabled === 1
    }));
  });
  ipcMain.handle("import.templates.list", async () =>
    listImportTemplates(getImportTemplateStorePath())
  );
  ipcMain.handle("import.templates.delete", async (_event, payload: unknown) => {
    const value = requireObjectPayload(payload, "import.templates.delete requires payload.");
    const name = getRequiredString(value, "name", "import.templates.delete requires name.");
    const deleted = deleteImportTemplate(getImportTemplateStorePath(), name);
    writeAuditLog({
      action: "import.templates.delete",
      entityType: "import_template",
      entityId: name,
      after: deleted
    });
    return deleted;
  });
  ipcMain.handle("import.preview", async (_event, payload: unknown) => {
    const parsed = parseImportPayload(payload);
    const handle = requireDatabaseHandle();
    if (parsed.mode === "actuals") {
      return previewActualsImport(handle.db, {
        filePath: parsed.filePath,
        mapping: parsed.mapping as ActualImportMapping | undefined
      });
    }
    return previewExpenseImport(handle.db, {
      filePath: parsed.filePath,
      mapping: parsed.mapping as ImportColumnMapping | undefined,
      templateName: parsed.templateName,
      templatePack: parsed.templatePack,
      useSavedTemplate: parsed.useSavedTemplate,
      saveTemplate: parsed.saveTemplate,
      requireFinanceMetadata: parsed.requireFinanceMetadata,
      templateStorePath: getImportTemplateStorePath()
    });
  });
  ipcMain.handle("import.commit", async (_event, payload: unknown) => {
    const parsed = parseImportPayload(payload);
    const handle = requireDatabaseHandle();
    if (parsed.mode === "actuals") {
      const result = commitActualsImport(handle.db, {
        filePath: parsed.filePath,
        mapping: parsed.mapping as ActualImportMapping | undefined
      });
      writeAuditLog({
        action: "import.commit",
        entityType: "import_job",
        entityId: crypto.randomUUID(),
        after: {
          mode: "actuals",
          filePath: parsed.filePath,
          totalRows: result.totalRows,
          insertedCount: result.insertedCount,
          matchedCount: result.matchedCount,
          unmatchedCount: result.unmatchedCount,
          duplicateCount: result.duplicateCount,
          rejectedCount: result.rejectedCount
        }
      });
      return result;
    }
    const rules = loadAutoTagRules(getAutoTagRulesPath());
    const committed = commitExpenseImport(handle.db, {
      filePath: parsed.filePath,
      mapping: parsed.mapping as ImportColumnMapping | undefined,
      templateName: parsed.templateName,
      templatePack: parsed.templatePack,
      useSavedTemplate: parsed.useSavedTemplate,
      saveTemplate: parsed.saveTemplate,
      requireFinanceMetadata: parsed.requireFinanceMetadata,
      templateStorePath: getImportTemplateStorePath(),
      autoTagRules: rules
    });
    const suggestions: AutoTagSuggestion[] = suggestRulesFromManualCorrections(handle.db);
    writeAuditLog({
      action: "import.commit",
      entityType: "import_job",
      entityId: crypto.randomUUID(),
      after: {
        mode: "expenses",
        filePath: parsed.filePath,
        totalRows: committed.totalRows,
        insertedCount: committed.insertedCount,
        duplicateCount: committed.duplicateCount,
        rejectedCount: committed.rejectedCount,
        templateName: parsed.templateName ?? null,
        templatePack: parsed.templatePack ?? null,
        requireFinanceMetadata: parsed.requireFinanceMetadata ?? false
      }
    });
    return {
      ...committed,
      suggestions
    };
  });
  ipcMain.handle("reports.query", async (_event, payload: unknown) => {
    const parsed = parseReportsQueryPayload(payload);
    const handle = requireDatabaseHandle();
    if (isReportPresetQuery(parsed.query)) {
      return buildReportPresetDataset(handle.db, parsed.query, parsed.scenarioId, parsed.filters);
    }
    if (parsed.query === "variance.monthly") {
      return buildMonthlyVarianceDataset(handle.db, parsed.scenarioId);
    }
    if (parsed.query === "replacement.detail") {
      if (!parsed.servicePlanId) {
        throw new Error("reports.query replacement.detail requires servicePlanId.");
      }
      const detail = getReplacementPlanDetail(handle.db, parsed.servicePlanId);
      if (detail.servicePlan.scenarioId !== parsed.scenarioId) {
        throw new Error("reports.query replacement.detail scenarioId does not match service plan scenario.");
      }
      return detail;
    }
    if (parsed.query === "scenario.comparison") {
      if (!parsed.baselineScenarioId) {
        throw new Error("reports.query scenario.comparison requires baselineScenarioId.");
      }
      const baselineScenarioId = parsed.baselineScenarioId;
      const comparisonScenarioId = parsed.comparisonScenarioId ?? parsed.scenarioId;
      const totals = handle.db
        .prepare(
          `
            SELECT
              scenario_id AS scenarioId,
              COUNT(*) AS expenseCount,
              COALESCE(SUM(amount_minor), 0) AS totalMinor,
              SUM(CASE WHEN capex_opex IS NOT NULL THEN 1 ELSE 0 END) AS classifiedExpenseCount
            FROM expense_line
            WHERE scenario_id IN (?, ?)
              AND deleted_at IS NULL
            GROUP BY scenario_id
          `
        )
        .all(baselineScenarioId, comparisonScenarioId) as Array<{
        scenarioId: string;
        expenseCount: number;
        totalMinor: number;
        classifiedExpenseCount: number;
      }>;
      const totalsByScenario = new Map(totals.map((row) => [row.scenarioId, row]));
      const baseline = totalsByScenario.get(baselineScenarioId) ?? {
        scenarioId: baselineScenarioId,
        expenseCount: 0,
        totalMinor: 0,
        classifiedExpenseCount: 0
      };
      const comparison = totalsByScenario.get(comparisonScenarioId) ?? {
        scenarioId: comparisonScenarioId,
        expenseCount: 0,
        totalMinor: 0,
        classifiedExpenseCount: 0
      };
      return {
        baselineScenarioId,
        comparisonScenarioId,
        baseline,
        comparison,
        delta: {
          expenseCount: comparison.expenseCount - baseline.expenseCount,
          totalMinor: comparison.totalMinor - baseline.totalMinor,
          classifiedExpenseCount:
            comparison.classifiedExpenseCount - baseline.classifiedExpenseCount
        },
        generatedAt: new Date().toISOString()
      };
    }
    if (parsed.query === "actuals.unmatched.summary") {
      const summary = handle.db
        .prepare(
          `
            SELECT
              COUNT(*) AS unmatchedCount,
              COALESCE(SUM(amount_minor), 0) AS unmatchedAmountMinor
            FROM spend_transaction
            WHERE scenario_id = ?
              AND matched_occurrence_id IS NULL
          `
        )
        .get(parsed.scenarioId) as
        | {
            unmatchedCount: number;
            unmatchedAmountMinor: number;
          }
        | undefined;

      const drivers = handle.db
        .prepare(
          `
            SELECT
              COALESCE(r.driver_tag, 'unclassified') AS driverTag,
              COUNT(*) AS count
            FROM spend_transaction t
            LEFT JOIN unmatched_actual_review r ON r.transaction_id = t.id
            WHERE t.scenario_id = ?
              AND t.matched_occurrence_id IS NULL
            GROUP BY COALESCE(r.driver_tag, 'unclassified')
            ORDER BY count DESC
          `
        )
        .all(parsed.scenarioId) as Array<{ driverTag: string; count: number }>;
      return {
        scenarioId: parsed.scenarioId,
        unmatchedCount: summary?.unmatchedCount ?? 0,
        unmatchedAmountMinor: summary?.unmatchedAmountMinor ?? 0,
        drivers,
        generatedAt: new Date().toISOString()
      };
    }
    if (parsed.query === "showback.summary") {
      const rows = handle.db
        .prepare(
          `
            SELECT
              s.id,
              s.scenario_id AS scenarioId,
              s.period_start AS periodStart,
              s.period_end AS periodEnd,
              s.group_by AS groupBy,
              s.generated_at AS generatedAt,
              s.generated_by AS generatedBy,
              s.total_minor AS totalMinor,
              s.currency,
              COUNT(l.id) AS lineCount
            FROM showback_statement s
            LEFT JOIN showback_line l ON l.statement_id = s.id
            WHERE s.scenario_id = ?
            GROUP BY
              s.id,
              s.scenario_id,
              s.period_start,
              s.period_end,
              s.group_by,
              s.generated_at,
              s.generated_by,
              s.total_minor,
              s.currency
            ORDER BY s.generated_at DESC
          `
        )
        .all(parsed.scenarioId) as Array<{
        id: string;
        scenarioId: string;
        periodStart: string;
        periodEnd: string;
        groupBy: string;
        generatedAt: string;
        generatedBy: string;
        totalMinor: number;
        currency: string;
        lineCount: number;
      }>;
      return {
        scenarioId: parsed.scenarioId,
        statements: rows,
        generatedAt: new Date().toISOString()
      };
    }
    if (parsed.query === "dataQuality.summary") {
      const expenseTotals = handle.db
        .prepare(
          `
            SELECT
              COUNT(*) AS expenseCount,
              SUM(CASE WHEN cost_center_code IS NULL OR TRIM(cost_center_code) = '' THEN 1 ELSE 0 END) AS missingCostCenterCount,
              SUM(CASE WHEN gl_account_code IS NULL OR TRIM(gl_account_code) = '' THEN 1 ELSE 0 END) AS missingGlAccountCount,
              SUM(CASE WHEN capex_opex IS NULL OR TRIM(capex_opex) = '' THEN 1 ELSE 0 END) AS missingCapexOpexCount
            FROM expense_line
            WHERE scenario_id = ?
              AND deleted_at IS NULL
          `
        )
        .get(parsed.scenarioId) as
        | {
            expenseCount: number;
            missingCostCenterCount: number;
            missingGlAccountCount: number;
            missingCapexOpexCount: number;
          }
        | undefined;
      const requiredDimMissing = handle.db
        .prepare(
          `
            SELECT COUNT(*) AS missingRequiredTagCount
            FROM expense_line e
            WHERE e.scenario_id = ?
              AND e.deleted_at IS NULL
              AND EXISTS (
                SELECT 1
                FROM dimension d
                WHERE d.required = 1
                  AND NOT EXISTS (
                    SELECT 1
                    FROM tag_assignment ta
                    WHERE ta.entity_type = 'expense_line'
                      AND ta.entity_id = e.id
                      AND ta.dimension_id = d.id
                  )
              )
          `
        )
        .get(parsed.scenarioId) as { missingRequiredTagCount: number } | undefined;

      return {
        scenarioId: parsed.scenarioId,
        expenseCount: expenseTotals?.expenseCount ?? 0,
        missingCostCenterCount: expenseTotals?.missingCostCenterCount ?? 0,
        missingGlAccountCount: expenseTotals?.missingGlAccountCount ?? 0,
        missingCapexOpexCount: expenseTotals?.missingCapexOpexCount ?? 0,
        missingRequiredTagCount: requiredDimMissing?.missingRequiredTagCount ?? 0,
        generatedAt: new Date().toISOString()
      };
    }
    if (parsed.query === "maintenance.materialize") {
      const generatedCount = materializeScenarioOccurrences(
        handle.db,
        parsed.scenarioId,
        parsed.horizonMonths ?? 24
      );
      return {
        ok: true,
        generatedCount,
        horizonMonths: parsed.horizonMonths ?? 24,
        scenarioId: parsed.scenarioId,
        generatedAt: new Date().toISOString()
      };
    }
    if (parsed.query === "maintenance.diagnostics") {
      const tableCounts: Record<string, number> = {};
      for (const tableName of DIAGNOSTICS_TRACKED_TABLES) {
        const row = handle.db
          .prepare(`SELECT COUNT(*) as count FROM ${tableName}`)
          .get() as { count: number } | undefined;
        tableCounts[tableName] = row?.count ?? 0;
      }

      const metaRow = handle.db
        .prepare(
          "SELECT schema_version, forecast_stale, forecast_generated_at, last_mutation_at FROM meta WHERE id = 1"
        )
        .get() as
        | {
            schema_version: number;
            forecast_stale: number;
            forecast_generated_at: string | null;
            last_mutation_at: string;
          }
        | undefined;
      const integrityResult = handle.db
        .prepare("PRAGMA integrity_check")
        .all() as Array<{ integrity_check: string }>;

      return {
        scenarioId: parsed.scenarioId,
        generatedAt: new Date().toISOString(),
        database: {
          path: handle.dbPath,
          schemaVersion: metaRow?.schema_version ?? 0,
          forecastStale: (metaRow?.forecast_stale ?? 0) === 1,
          forecastGeneratedAt: metaRow?.forecast_generated_at ?? null,
          lastMutationAt: metaRow?.last_mutation_at ?? null,
          integrity: integrityResult[0]?.integrity_check ?? "unknown"
        },
        backup: {
          lastBackupAt: backupHealthState.latestBackupCreatedAt,
          lastVerifiedAt: backupHealthState.lastVerifiedAt
        },
        counts: tableCounts
      };
    }
    throw new Error(`Unsupported reports.query value: ${parsed.query}`);
  });
  ipcMain.handle("report.preview", async (_event, payload: unknown) => {
    const parsed = parseReportPreviewPayload(payload);
    const handle = requireDatabaseHandle();
    const dataset = buildReportPresetDataset(
      handle.db,
      parsed.reportType,
      parsed.scenarioId,
      parsed.filters
    );
    return {
      html: createDashboardHtml(dataset),
      scenarioId: parsed.scenarioId,
      reportType: parsed.reportType
    };
  });
  ipcMain.handle("export.report", async (_event, payload: unknown) => {
    const parsed = parseExportReportPayload(payload);
    const handle = requireDatabaseHandle();
    if (parsed.reportType === "nlq.results") {
      if (!parsed.filterSpec) {
        throw new Error("export.report nlq.results requires filterSpec.");
      }
      const requestedFormats = parsed.formats ?? ["csv", "excel"];
      const nlqFormats: NlqExportFormat[] = [];
      for (const format of requestedFormats) {
        if (format !== "csv" && format !== "excel") {
          throw new Error("NLQ export supports only csv and excel formats.");
        }
        nlqFormats.push(format);
      }

      const queried = queryExpensesByFilterSpec(handle.db, parsed.filterSpec);
      return exportNlqResultsReport({
        rows: queried.rows.map((row) => ({
          id: row.id,
          name: row.name,
          amountMinor: row.amount_minor
        })),
        outputDir: parsed.outputDir,
        baseFileName: parsed.baseFileName,
        formats: nlqFormats
      });
    }

    if (isReportPresetQuery(parsed.reportType)) {
      const dataset = buildReportPresetDataset(
        handle.db,
        parsed.reportType,
        parsed.scenarioId,
        parsed.filters
      );
      return exportDashboardReport(
        {
          dataset,
          outputDir: parsed.outputDir,
          baseFileName: parsed.baseFileName,
          formats: parsed.formats
        },
        createElectronReportRenderers()
      );
    }

    throw new Error(`Unsupported export.report reportType: ${parsed.reportType}`);
  });
  ipcMain.handle("nlq.parse", async (_event, payload: unknown) => {
    const parsed = parseNlqPayload(payload);
    const handle = requireDatabaseHandle();
    const referenceDate = parsed.referenceDate ? new Date(parsed.referenceDate) : undefined;
    const nlq = parseNlqToFilterSpec(parsed.query, { referenceDate });
    const queried = queryExpensesByFilterSpec(handle.db, nlq.filterSpec);
    return {
      filterSpec: nlq.filterSpec,
      explanation: queried.compiled.explanation,
      sql: queried.compiled.sql,
      params: queried.compiled.params,
      rows: queried.rows
    };
  });
  ipcMain.handle("vendors.list", async (_event, payload: unknown) => {
    const includeDeleted = Boolean(
      payload &&
        typeof payload === "object" &&
        (payload as { includeDeleted?: unknown }).includeDeleted === true
    );
    return getCrudRepository().listVendors(includeDeleted);
  });
  ipcMain.handle("vendors.create", async (_event, payload: unknown) => {
    const value = requireObjectPayload(payload, "vendors.create requires payload.");
    const repo = getCrudRepository();
    const id = repo.createVendor({
      name: getRequiredString(value, "name", "vendors.create requires name."),
      website: getOptionalString(value, "website"),
      notes: getOptionalString(value, "notes"),
      owner: getOptionalString(value, "owner"),
      annualSpendMinor: getOptionalNumber(value, "annualSpendMinor"),
      status: getOptionalEnumValue(value, "status", VENDOR_STATUSES),
      risk: getOptionalEnumValue(value, "risk", RISK_LEVELS)
    });
    const created = repo.listVendors(true).find((entry) => entry.id === id) ?? null;
    writeAuditLog({
      action: "vendors.create",
      entityType: "vendor",
      entityId: id,
      after: created
    });
    return created;
  });
  ipcMain.handle("vendors.update", async (_event, payload: unknown) => {
    const value = requireObjectPayload(payload, "vendors.update requires payload.");
    const id = getRequiredString(value, "id", "vendors.update requires id.");
    const repo = getCrudRepository();
    const before = repo.listVendors(true).find((entry) => entry.id === id) ?? null;
    repo.updateVendor(id, {
      name: getRequiredString(value, "name", "vendors.update requires name."),
      website: getOptionalString(value, "website"),
      notes: getOptionalString(value, "notes"),
      owner: getOptionalString(value, "owner"),
      annualSpendMinor: getOptionalNumber(value, "annualSpendMinor"),
      status: getOptionalEnumValue(value, "status", VENDOR_STATUSES),
      risk: getOptionalEnumValue(value, "risk", RISK_LEVELS)
    });
    const after = repo.listVendors(true).find((entry) => entry.id === id) ?? null;
    writeAuditLog({
      action: "vendors.update",
      entityType: "vendor",
      entityId: id,
      before,
      after
    });
    return after;
  });
  ipcMain.handle("vendors.delete", async (_event, payload: unknown) => {
    const id = getRequiredIdPayload(payload, "vendors.delete");
    const repo = getCrudRepository();
    const before = repo.listVendors(true).find((entry) => entry.id === id) ?? null;
    repo.deleteVendor(id);
    const after = repo.listVendors(true).find((entry) => entry.id === id) ?? null;
    writeAuditLog({
      action: "vendors.delete",
      entityType: "vendor",
      entityId: id,
      before,
      after
    });
    return { ok: true, id };
  });

  ipcMain.handle("services.list", async (_event, payload: unknown) => {
    const includeDeleted = Boolean(
      payload &&
        typeof payload === "object" &&
        (payload as { includeDeleted?: unknown }).includeDeleted === true
    );
    return getCrudRepository().listServices(includeDeleted);
  });
  ipcMain.handle("services.create", async (_event, payload: unknown) => {
    const value = requireObjectPayload(payload, "services.create requires payload.");
    const repo = getCrudRepository();
    const id = repo.createService({
      vendorId: getRequiredString(value, "vendorId", "services.create requires vendorId."),
      name: getRequiredString(value, "name", "services.create requires name."),
      status: getOptionalEnumValue(value, "status", SERVICE_STATUSES) ?? "active",
      ownerTeam: getOptionalString(value, "ownerTeam"),
      annualSpendMinor: getOptionalNumber(value, "annualSpendMinor"),
      risk: getOptionalEnumValue(value, "risk", RISK_LEVELS),
      replacementStatus: getOptionalEnumValue(value, "replacementStatus", REPLACEMENT_STATUSES)
    });
    const created = repo.listServices(true).find((entry) => entry.id === id) ?? null;
    writeAuditLog({
      action: "services.create",
      entityType: "service",
      entityId: id,
      after: created
    });
    return created;
  });
  ipcMain.handle("services.update", async (_event, payload: unknown) => {
    const value = requireObjectPayload(payload, "services.update requires payload.");
    const id = getRequiredString(value, "id", "services.update requires id.");
    const repo = getCrudRepository();
    const before = repo.listServices(true).find((entry) => entry.id === id) ?? null;
    repo.updateService(id, {
      vendorId: getRequiredString(value, "vendorId", "services.update requires vendorId."),
      name: getRequiredString(value, "name", "services.update requires name."),
      status: getOptionalEnumValue(value, "status", SERVICE_STATUSES) ?? "active",
      ownerTeam: getOptionalString(value, "ownerTeam"),
      annualSpendMinor: getOptionalNumber(value, "annualSpendMinor"),
      risk: getOptionalEnumValue(value, "risk", RISK_LEVELS),
      replacementStatus: getOptionalEnumValue(value, "replacementStatus", REPLACEMENT_STATUSES)
    });
    const after = repo.listServices(true).find((entry) => entry.id === id) ?? null;
    writeAuditLog({
      action: "services.update",
      entityType: "service",
      entityId: id,
      before,
      after
    });
    return after;
  });
  ipcMain.handle("services.delete", async (_event, payload: unknown) => {
    const id = getRequiredIdPayload(payload, "services.delete");
    const repo = getCrudRepository();
    const before = repo.listServices(true).find((entry) => entry.id === id) ?? null;
    repo.deleteService(id);
    const after = repo.listServices(true).find((entry) => entry.id === id) ?? null;
    writeAuditLog({
      action: "services.delete",
      entityType: "service",
      entityId: id,
      before,
      after
    });
    return { ok: true, id };
  });

  ipcMain.handle("contracts.list", async (_event, payload: unknown) => {
    const includeDeleted = Boolean(
      payload &&
        typeof payload === "object" &&
        (payload as { includeDeleted?: unknown }).includeDeleted === true
    );
    return getCrudRepository().listContracts(includeDeleted);
  });
  ipcMain.handle("contracts.create", async (_event, payload: unknown) => {
    const value = requireObjectPayload(payload, "contracts.create requires payload.");
    const repo = getCrudRepository();
    const id = repo.createContract({
      serviceId: getRequiredString(value, "serviceId", "contracts.create requires serviceId."),
      contractNumber: getOptionalString(value, "contractNumber"),
      startDate: getOptionalString(value, "startDate"),
      endDate: getOptionalString(value, "endDate"),
      renewalType: getOptionalEnumValue(value, "renewalType", RENEWAL_TYPES),
      renewalDate: getOptionalString(value, "renewalDate"),
      noticePeriodDays: getOptionalNumber(value, "noticePeriodDays"),
      owner: getOptionalString(value, "owner"),
      lifecycleStatus: getOptionalEnumValue(value, "lifecycleStatus", CONTRACT_LIFECYCLE_STATUSES),
      renewalAction: getOptionalEnumValue(value, "renewalAction", RENEWAL_ACTIONS)
    });
    const created = repo.listContracts(true).find((entry) => entry.id === id) ?? null;
    writeAuditLog({
      action: "contracts.create",
      entityType: "contract",
      entityId: id,
      after: created
    });
    return created;
  });
  ipcMain.handle("contracts.update", async (_event, payload: unknown) => {
    const value = requireObjectPayload(payload, "contracts.update requires payload.");
    const id = getRequiredString(value, "id", "contracts.update requires id.");
    const repo = getCrudRepository();
    const before = repo.listContracts(true).find((entry) => entry.id === id) ?? null;
    repo.updateContract(id, {
      serviceId: getRequiredString(value, "serviceId", "contracts.update requires serviceId."),
      contractNumber: getOptionalString(value, "contractNumber"),
      startDate: getOptionalString(value, "startDate"),
      endDate: getOptionalString(value, "endDate"),
      renewalType: getOptionalEnumValue(value, "renewalType", RENEWAL_TYPES),
      renewalDate: getOptionalString(value, "renewalDate"),
      noticePeriodDays: getOptionalNumber(value, "noticePeriodDays"),
      owner: getOptionalString(value, "owner"),
      lifecycleStatus: getOptionalEnumValue(value, "lifecycleStatus", CONTRACT_LIFECYCLE_STATUSES),
      renewalAction: getOptionalEnumValue(value, "renewalAction", RENEWAL_ACTIONS)
    });
    const after = repo.listContracts(true).find((entry) => entry.id === id) ?? null;
    writeAuditLog({
      action: "contracts.update",
      entityType: "contract",
      entityId: id,
      before,
      after
    });
    return after;
  });
  ipcMain.handle("contracts.delete", async (_event, payload: unknown) => {
    const id = getRequiredIdPayload(payload, "contracts.delete");
    const repo = getCrudRepository();
    const before = repo.listContracts(true).find((entry) => entry.id === id) ?? null;
    repo.deleteContract(id);
    const after = repo.listContracts(true).find((entry) => entry.id === id) ?? null;
    writeAuditLog({
      action: "contracts.delete",
      entityType: "contract",
      entityId: id,
      before,
      after
    });
    return { ok: true, id };
  });

  ipcMain.handle("expenses.list", async (_event, payload: unknown) => {
    const parsed = parseExpenseListPayload(payload);
    return getCrudRepository().listExpenseLines(parsed.scenarioId, parsed.includeDeleted);
  });
  ipcMain.handle("expenses.create", async (_event, payload: unknown) => {
    const value = requireObjectPayload(payload, "expenses.create requires payload.");
    const recurrence =
      value.recurrence && typeof value.recurrence === "object"
        ? (value.recurrence as Record<string, unknown>)
        : undefined;
    let recurrenceInput:
      | {
          expenseLineId: string;
          frequency: "monthly" | "quarterly" | "yearly";
          interval: number;
          dayOfMonth: number;
          monthOfYear?: number;
          anchorDate?: string;
        }
      | undefined;
    if (recurrence) {
      const recurrenceInterval = getOptionalNumber(recurrence, "interval");
      const recurrenceDayOfMonth = getOptionalNumber(recurrence, "dayOfMonth");
      if (recurrenceInterval === undefined || recurrenceDayOfMonth === undefined) {
        throw new Error("expenses.create recurrence requires interval and dayOfMonth.");
      }
      recurrenceInput = {
        expenseLineId: "",
        frequency: getRequiredEnumValue(
          recurrence,
          "frequency",
          RECURRENCE_FREQUENCIES,
          "recurrence.frequency is required."
        ),
        interval: recurrenceInterval,
        dayOfMonth: recurrenceDayOfMonth,
        monthOfYear: getOptionalNumber(recurrence, "monthOfYear"),
        anchorDate: getOptionalString(recurrence, "anchorDate")
      };
    }
    const repo = getCrudRepository();
    const amountMinor = getOptionalNumber(value, "amountMinor");
    if (amountMinor === undefined) {
      throw new Error("expenses.create requires numeric amountMinor.");
    }
    const id = repo.createExpenseLineWithOptionalRecurrence(
      {
        scenarioId: getRequiredString(value, "scenarioId", "expenses.create requires scenarioId."),
        serviceId: getRequiredString(value, "serviceId", "expenses.create requires serviceId."),
        contractId: getOptionalNullableString(value, "contractId"),
        name: getRequiredString(value, "name", "expenses.create requires name."),
        expenseType: getRequiredEnumValue(
          value,
          "expenseType",
          EXPENSE_TYPES,
          "expenses.create requires valid expenseType."
        ),
        status: getRequiredEnumValue(
          value,
          "status",
          EXPENSE_STATUSES,
          "expenses.create requires valid status."
        ),
        amountMinor,
        currency: getOptionalString(value, "currency") ?? "USD",
        capexOpex: getOptionalNullableEnumValue(value, "capexOpex", CAPEX_OPEX_VALUES),
        glAccountCode: getOptionalNullableString(value, "glAccountCode"),
        costCenterCode: getOptionalNullableString(value, "costCenterCode"),
        fundingSource: getOptionalNullableString(value, "fundingSource"),
        startDate: getOptionalString(value, "startDate"),
        endDate: getOptionalNullableString(value, "endDate")
      },
      recurrenceInput
    );
    const created = repo.listExpenseLines(undefined, true).find((entry) => entry.id === id) ?? null;
    writeAuditLog({
      action: "expenses.create",
      entityType: "expense_line",
      entityId: id,
      after: created
    });
    return created;
  });
  ipcMain.handle("expenses.update", async (_event, payload: unknown) => {
    const value = requireObjectPayload(payload, "expenses.update requires payload.");
    const id = getRequiredString(value, "id", "expenses.update requires id.");
    const repo = getCrudRepository();
    const before = repo.listExpenseLines(undefined, true).find((entry) => entry.id === id) ?? null;
    const amountMinor = getOptionalNumber(value, "amountMinor");
    if (amountMinor === undefined) {
      throw new Error("expenses.update requires numeric amountMinor.");
    }
    repo.updateExpenseLine(id, {
      scenarioId: getRequiredString(value, "scenarioId", "expenses.update requires scenarioId."),
      serviceId: getRequiredString(value, "serviceId", "expenses.update requires serviceId."),
      contractId: getOptionalNullableString(value, "contractId"),
      name: getRequiredString(value, "name", "expenses.update requires name."),
      expenseType: getRequiredEnumValue(
        value,
        "expenseType",
        EXPENSE_TYPES,
        "expenses.update requires valid expenseType."
      ),
      status: getRequiredEnumValue(
        value,
        "status",
        EXPENSE_STATUSES,
        "expenses.update requires valid status."
      ),
      amountMinor,
      currency: getOptionalString(value, "currency") ?? "USD",
      capexOpex: getOptionalNullableEnumValue(value, "capexOpex", CAPEX_OPEX_VALUES),
      glAccountCode: getOptionalNullableString(value, "glAccountCode"),
      costCenterCode: getOptionalNullableString(value, "costCenterCode"),
      fundingSource: getOptionalNullableString(value, "fundingSource"),
      startDate: getOptionalString(value, "startDate"),
      endDate: getOptionalNullableString(value, "endDate")
    });
    const after = repo.listExpenseLines(undefined, true).find((entry) => entry.id === id) ?? null;
    writeAuditLog({
      action: "expenses.update",
      entityType: "expense_line",
      entityId: id,
      before,
      after
    });
    return after;
  });
  ipcMain.handle("expenses.delete", async (_event, payload: unknown) => {
    const id = getRequiredIdPayload(payload, "expenses.delete");
    const repo = getCrudRepository();
    const before = repo.listExpenseLines(undefined, true).find((entry) => entry.id === id) ?? null;
    repo.deleteExpenseLine(id);
    const after = repo.listExpenseLines(undefined, true).find((entry) => entry.id === id) ?? null;
    writeAuditLog({
      action: "expenses.delete",
      entityType: "expense_line",
      entityId: id,
      before,
      after
    });
    return { ok: true, id };
  });

  ipcMain.handle("recurrences.list", async (_event, payload: unknown) => {
    if (!payload || typeof payload !== "object") {
      return getCrudRepository().listRecurrenceRules();
    }
    const value = payload as { expenseLineId?: unknown };
    return getCrudRepository().listRecurrenceRules(
      typeof value.expenseLineId === "string" && value.expenseLineId.trim().length > 0
        ? value.expenseLineId.trim()
        : undefined
    );
  });

  ipcMain.handle("recurrences.create", async (_event, payload: unknown) => {
    const value = requireObjectPayload(payload, "recurrences.create requires payload.");
    const repo = getCrudRepository();
    const interval = getOptionalNumber(value, "interval");
    const dayOfMonth = getOptionalNumber(value, "dayOfMonth");
    if (interval === undefined || dayOfMonth === undefined) {
      throw new Error("recurrences.create requires numeric interval and dayOfMonth.");
    }
    const id = repo.createRecurrenceRule({
      expenseLineId: getRequiredString(
        value,
        "expenseLineId",
        "recurrences.create requires expenseLineId."
      ),
      frequency: getRequiredEnumValue(
        value,
        "frequency",
        RECURRENCE_FREQUENCIES,
        "recurrences.create requires frequency."
      ),
      interval,
      dayOfMonth,
      monthOfYear: getOptionalNumber(value, "monthOfYear"),
      anchorDate: getOptionalString(value, "anchorDate")
    });
    const created = repo.listRecurrenceRules().find((entry) => entry.id === id) ?? null;
    writeAuditLog({
      action: "recurrences.create",
      entityType: "recurrence_rule",
      entityId: id,
      after: created
    });
    return created;
  });
  ipcMain.handle("recurrences.update", async (_event, payload: unknown) => {
    const value = requireObjectPayload(payload, "recurrences.update requires payload.");
    const id = getRequiredString(value, "id", "recurrences.update requires id.");
    const repo = getCrudRepository();
    const before = repo.listRecurrenceRules().find((entry) => entry.id === id) ?? null;
    const interval = getOptionalNumber(value, "interval");
    const dayOfMonth = getOptionalNumber(value, "dayOfMonth");
    if (interval === undefined || dayOfMonth === undefined) {
      throw new Error("recurrences.update requires numeric interval and dayOfMonth.");
    }
    repo.updateRecurrenceRule(id, {
      expenseLineId: getRequiredString(
        value,
        "expenseLineId",
        "recurrences.update requires expenseLineId."
      ),
      frequency: getRequiredEnumValue(
        value,
        "frequency",
        RECURRENCE_FREQUENCIES,
        "recurrences.update requires frequency."
      ),
      interval,
      dayOfMonth,
      monthOfYear: getOptionalNumber(value, "monthOfYear"),
      anchorDate: getOptionalString(value, "anchorDate")
    });
    const after = repo.listRecurrenceRules().find((entry) => entry.id === id) ?? null;
    writeAuditLog({
      action: "recurrences.update",
      entityType: "recurrence_rule",
      entityId: id,
      before,
      after
    });
    return after;
  });
  ipcMain.handle("recurrences.delete", async (_event, payload: unknown) => {
    const id = getRequiredIdPayload(payload, "recurrences.delete");
    const repo = getCrudRepository();
    const before = repo.listRecurrenceRules().find((entry) => entry.id === id) ?? null;
    repo.deleteRecurrenceRule(id);
    writeAuditLog({
      action: "recurrences.delete",
      entityType: "recurrence_rule",
      entityId: id,
      before
    });
    return { ok: true, id };
  });

  ipcMain.handle("dimensions.list", async () => getCrudRepository().listDimensions());
  ipcMain.handle("dimensions.create", async (_event, payload: unknown) => {
    const value = requireObjectPayload(payload, "dimensions.create requires payload.");
    const repo = getCrudRepository();
    const id = repo.createDimension({
      name: getRequiredString(value, "name", "dimensions.create requires name."),
      mode: getRequiredEnumValue(
        value,
        "mode",
        DIMENSION_MODES,
        "dimensions.create requires valid mode."
      ),
      required: getOptionalBoolean(value, "required") ?? false
    });
    const created = repo.listDimensions().find((entry) => entry.id === id) ?? null;
    writeAuditLog({
      action: "dimensions.create",
      entityType: "dimension",
      entityId: id,
      after: created
    });
    return created;
  });
  ipcMain.handle("dimensions.update", async (_event, payload: unknown) => {
    const value = requireObjectPayload(payload, "dimensions.update requires payload.");
    const id = getRequiredString(value, "id", "dimensions.update requires id.");
    const repo = getCrudRepository();
    const before = repo.listDimensions().find((entry) => entry.id === id) ?? null;
    repo.updateDimension(id, {
      name: getRequiredString(value, "name", "dimensions.update requires name."),
      mode: getRequiredEnumValue(
        value,
        "mode",
        DIMENSION_MODES,
        "dimensions.update requires valid mode."
      ),
      required: getOptionalBoolean(value, "required") ?? false
    });
    const after = repo.listDimensions().find((entry) => entry.id === id) ?? null;
    writeAuditLog({
      action: "dimensions.update",
      entityType: "dimension",
      entityId: id,
      before,
      after
    });
    return after;
  });
  ipcMain.handle("dimensions.delete", async (_event, payload: unknown) => {
    const id = getRequiredIdPayload(payload, "dimensions.delete");
    const repo = getCrudRepository();
    const before = repo.listDimensions().find((entry) => entry.id === id) ?? null;
    repo.deleteDimension(id);
    writeAuditLog({
      action: "dimensions.delete",
      entityType: "dimension",
      entityId: id,
      before
    });
    return { ok: true, id };
  });

  ipcMain.handle("tags.list", async (_event, payload: unknown) => {
    if (!payload || typeof payload !== "object") {
      return {
        tags: getCrudRepository().listTags(),
        assignments: getCrudRepository().listTagAssignments()
      };
    }
    const value = payload as {
      dimensionId?: unknown;
      includeArchived?: unknown;
      entityType?: unknown;
      entityId?: unknown;
    };
    return {
      tags: getCrudRepository().listTags(
        typeof value.dimensionId === "string" && value.dimensionId.trim().length > 0
          ? value.dimensionId.trim()
          : undefined,
        value.includeArchived === true
      ),
      assignments: getCrudRepository().listTagAssignments(
        typeof value.entityType === "string" && value.entityType.trim().length > 0
          ? value.entityType.trim()
          : undefined,
        typeof value.entityId === "string" && value.entityId.trim().length > 0
          ? value.entityId.trim()
          : undefined
      )
    };
  });
  ipcMain.handle("tags.create", async (_event, payload: unknown) => {
    const value = requireObjectPayload(payload, "tags.create requires payload.");
    const repo = getCrudRepository();
    const id = repo.createTag({
      dimensionId: getRequiredString(value, "dimensionId", "tags.create requires dimensionId."),
      name: getRequiredString(value, "name", "tags.create requires name."),
      parentTagId: getOptionalNullableString(value, "parentTagId")
    });
    const created = repo.listTags(undefined, true).find((entry) => entry.id === id) ?? null;
    writeAuditLog({
      action: "tags.create",
      entityType: "tag",
      entityId: id,
      after: created
    });
    return created;
  });
  ipcMain.handle("tags.update", async (_event, payload: unknown) => {
    const value = requireObjectPayload(payload, "tags.update requires payload.");
    const id = getRequiredString(value, "id", "tags.update requires id.");
    const repo = getCrudRepository();
    const before = repo.listTags(undefined, true).find((entry) => entry.id === id) ?? null;
    repo.updateTag(id, {
      name: getRequiredString(value, "name", "tags.update requires name."),
      parentTagId: getOptionalNullableString(value, "parentTagId")
    });
    const after = repo.listTags(undefined, true).find((entry) => entry.id === id) ?? null;
    writeAuditLog({
      action: "tags.update",
      entityType: "tag",
      entityId: id,
      before,
      after
    });
    return after;
  });
  ipcMain.handle("tags.archive", async (_event, payload: unknown) => {
    const value = requireObjectPayload(payload, "tags.archive requires payload.");
    const id = getRequiredString(value, "id", "tags.archive requires id.");
    const archived = getOptionalBoolean(value, "archived") ?? true;
    const repo = getCrudRepository();
    const before = repo.listTags(undefined, true).find((entry) => entry.id === id) ?? null;
    repo.archiveTag(id, archived);
    const after = repo.listTags(undefined, true).find((entry) => entry.id === id) ?? null;
    writeAuditLog({
      action: archived ? "tags.archive" : "tags.unarchive",
      entityType: "tag",
      entityId: id,
      before,
      after
    });
    return after;
  });
  ipcMain.handle("tags.merge", async (_event, payload: unknown) => {
    const value = requireObjectPayload(payload, "tags.merge requires payload.");
    const dimensionId = getRequiredString(
      value,
      "dimensionId",
      "tags.merge requires dimensionId."
    );
    const sourceTagId = getRequiredString(
      value,
      "sourceTagId",
      "tags.merge requires sourceTagId."
    );
    const targetTagId = getRequiredString(
      value,
      "targetTagId",
      "tags.merge requires targetTagId."
    );
    if (sourceTagId === targetTagId) {
      throw new Error("tags.merge requires distinct sourceTagId and targetTagId.");
    }
    const repo = getCrudRepository();
    const reassignedCount = repo.mergeTagAssignments(dimensionId, sourceTagId, targetTagId);
    writeAuditLog({
      action: "tags.merge",
      entityType: "tag",
      entityId: sourceTagId,
      after: {
        sourceTagId,
        targetTagId,
        reassignedCount
      }
    });
    return { ok: true, reassignedCount };
  });
  ipcMain.handle("tags.assign", async (_event, payload: unknown) => {
    const value = requireObjectPayload(payload, "tags.assign requires payload.");
    const repo = getCrudRepository();
    const id = repo.assignTagToEntity({
      entityType: getRequiredString(value, "entityType", "tags.assign requires entityType."),
      entityId: getRequiredString(value, "entityId", "tags.assign requires entityId."),
      dimensionId: getRequiredString(value, "dimensionId", "tags.assign requires dimensionId."),
      tagId: getRequiredString(value, "tagId", "tags.assign requires tagId.")
    });
    const created = repo.listTagAssignments().find((entry) => entry.id === id) ?? null;
    writeAuditLog({
      action: "tags.assign",
      entityType: "tag_assignment",
      entityId: id,
      after: created
    });
    return created;
  });
  ipcMain.handle("tags.unassign", async (_event, payload: unknown) => {
    const value = requireObjectPayload(payload, "tags.unassign requires payload.");
    const entityType = getRequiredString(value, "entityType", "tags.unassign requires entityType.");
    const entityId = getRequiredString(value, "entityId", "tags.unassign requires entityId.");
    const dimensionId = getRequiredString(value, "dimensionId", "tags.unassign requires dimensionId.");
    const tagId = getRequiredString(value, "tagId", "tags.unassign requires tagId.");
    const repo = getCrudRepository();
    repo.removeTagAssignment(entityType, entityId, dimensionId, tagId);
    writeAuditLog({
      action: "tags.unassign",
      entityType: "tag_assignment",
      entityId: `${entityType}:${entityId}:${dimensionId}:${tagId}`
    });
    return { ok: true };
  });

  ipcMain.handle("scenarios.list", async () => getCrudRepository().listScenarios());
  ipcMain.handle("scenarios.create", async (_event, payload: unknown) => {
    const value = requireObjectPayload(payload, "scenarios.create requires payload.");
    const repo = getCrudRepository();
    const id = repo.createScenario({
      name: getRequiredString(value, "name", "scenarios.create requires name."),
      parentScenarioId: getOptionalNullableString(value, "parentScenarioId"),
      approvalStatus: getOptionalEnumValue(value, "approvalStatus", SCENARIO_APPROVAL_STATUSES)
    });
    const created = repo.listScenarios().find((entry) => entry.id === id) ?? null;
    writeAuditLog({
      action: "scenarios.create",
      entityType: "scenario",
      entityId: id,
      after: created
    });
    return created;
  });
  ipcMain.handle("scenarios.clone", async (_event, payload: unknown) => {
    const value = requireObjectPayload(payload, "scenarios.clone requires payload.");
    const sourceScenarioId = getRequiredString(
      value,
      "sourceScenarioId",
      "scenarios.clone requires sourceScenarioId."
    );
    const repo = getCrudRepository();
    const source = repo.listScenarios().find((entry) => entry.id === sourceScenarioId);
    if (!source) {
      throw new Error(`Scenario not found: ${sourceScenarioId}`);
    }
    const requestedName = getOptionalString(value, "newScenarioName");
    const name = requestedName ?? `${source.name} Copy ${new Date().toISOString().slice(0, 10)}`;
    const id = repo.cloneScenario(sourceScenarioId, name);
    const created = repo.listScenarios().find((entry) => entry.id === id) ?? null;
    writeAuditLog({
      action: "scenarios.clone",
      entityType: "scenario",
      entityId: id,
      before: source,
      after: created
    });
    return created;
  });
  ipcMain.handle("scenarios.approve", async (_event, payload: unknown) => {
    const value = requireObjectPayload(payload, "scenarios.approve requires payload.");
    const scenarioId = getRequiredString(value, "scenarioId", "scenarios.approve requires scenarioId.");
    const repo = getCrudRepository();
    const before = repo.listScenarios().find((entry) => entry.id === scenarioId) ?? null;
    if (!before) {
      throw new Error(`Scenario not found: ${scenarioId}`);
    }
    const requestedStatus = getOptionalString(value, "nextStatus");
    const nextStatus =
      requestedStatus ??
      (before.approvalStatus === "draft"
        ? "reviewed"
        : before.approvalStatus === "reviewed"
          ? "approved"
          : before.approvalStatus);
    if (nextStatus !== before.approvalStatus) {
      repo.setScenarioApprovalStatus(scenarioId, nextStatus as "draft" | "reviewed" | "approved");
      writeApprovalRecord({
        scenarioId,
        entityType: "scenario",
        entityId: scenarioId,
        action: "scenarios.approve",
        comment: `Approval status changed to ${nextStatus}.`
      });
    }
    const after = repo.listScenarios().find((entry) => entry.id === scenarioId) ?? null;
    writeAuditLog({
      action: "scenarios.approve",
      entityType: "scenario",
      entityId: scenarioId,
      before,
      after
    });
    return after;
  });
  ipcMain.handle("scenarios.lock", async (_event, payload: unknown) => {
    const value = requireObjectPayload(payload, "scenarios.lock requires payload.");
    const scenarioId = getRequiredString(value, "scenarioId", "scenarios.lock requires scenarioId.");
    const repo = getCrudRepository();
    const before = repo.listScenarios().find((entry) => entry.id === scenarioId) ?? null;
    repo.lockScenario(scenarioId);
    writeApprovalRecord({
      scenarioId,
      entityType: "scenario",
      entityId: scenarioId,
      action: "scenarios.lock",
      comment: "Scenario locked."
    });
    const after = repo.listScenarios().find((entry) => entry.id === scenarioId) ?? null;
    writeAuditLog({
      action: "scenarios.lock",
      entityType: "scenario",
      entityId: scenarioId,
      before,
      after
    });
    return after;
  });

  ipcMain.handle("scenarioSettings.get", async (_event, payload: unknown) => {
    const parsed = parseScenarioSettingsPayload(payload, "scenarioSettings.get");
    return getCrudRepository().getScenarioSettings(parsed.scenarioId);
  });
  ipcMain.handle("scenarioSettings.update", async (_event, payload: unknown) => {
    const value = requireObjectPayload(payload, "scenarioSettings.update requires payload.");
    const repo = getCrudRepository();
    const scenarioId = parseScenarioSettingsPayload(payload, "scenarioSettings.update").scenarioId;
    const before = repo.getScenarioSettings(scenarioId);
    const after = repo.upsertScenarioSettings({
      scenarioId,
      fiscalYearStartMonth: getOptionalNumber(value, "fiscalYearStartMonth"),
      horizonMonths: getOptionalNumber(value, "horizonMonths"),
      defaultCurrency: getOptionalString(value, "defaultCurrency")
    });
    writeAuditLog({
      action: "scenarioSettings.update",
      entityType: "scenario_settings",
      entityId: scenarioId,
      before,
      after
    });
    return after;
  });

  ipcMain.handle("costCenters.list", async () => getCrudRepository().listCostCenters());
  ipcMain.handle("costCenters.create", async (_event, payload: unknown) => {
    const value = requireObjectPayload(payload, "costCenters.create requires payload.");
    const code = getRequiredString(value, "code", "costCenters.create requires code.");
    const repo = getCrudRepository();
    repo.upsertCostCenter({
      code,
      name: getRequiredString(value, "name", "costCenters.create requires name."),
      active: getOptionalBoolean(value, "active")
    });
    const after = repo.listCostCenters().find((entry) => entry.code === code) ?? null;
    writeAuditLog({
      action: "costCenters.create",
      entityType: "cost_center",
      entityId: code,
      after
    });
    return after;
  });
  ipcMain.handle("costCenters.update", async (_event, payload: unknown) => {
    const value = requireObjectPayload(payload, "costCenters.update requires payload.");
    const code = getRequiredString(value, "code", "costCenters.update requires code.");
    const repo = getCrudRepository();
    const before = repo.listCostCenters().find((entry) => entry.code === code) ?? null;
    repo.upsertCostCenter({
      code,
      name: getRequiredString(value, "name", "costCenters.update requires name."),
      active: getOptionalBoolean(value, "active")
    });
    const after = repo.listCostCenters().find((entry) => entry.code === code) ?? null;
    writeAuditLog({
      action: "costCenters.update",
      entityType: "cost_center",
      entityId: code,
      before,
      after
    });
    return after;
  });
  ipcMain.handle("costCenters.delete", async (_event, payload: unknown) => {
    const value = requireObjectPayload(payload, "costCenters.delete requires payload.");
    const code = getOptionalString(value, "code") ?? getOptionalString(value, "id");
    if (!code) {
      throw new Error("costCenters.delete requires code.");
    }
    const repo = getCrudRepository();
    const before = repo.listCostCenters().find((entry) => entry.code === code) ?? null;
    repo.deleteCostCenter(code);
    writeAuditLog({
      action: "costCenters.delete",
      entityType: "cost_center",
      entityId: code,
      before
    });
    return { ok: true, code };
  });

  ipcMain.handle("glAccounts.list", async () => getCrudRepository().listGlAccounts());
  ipcMain.handle("glAccounts.create", async (_event, payload: unknown) => {
    const value = requireObjectPayload(payload, "glAccounts.create requires payload.");
    const code = getRequiredString(value, "code", "glAccounts.create requires code.");
    const repo = getCrudRepository();
    repo.upsertGlAccount({
      code,
      name: getRequiredString(value, "name", "glAccounts.create requires name."),
      active: getOptionalBoolean(value, "active")
    });
    const after = repo.listGlAccounts().find((entry) => entry.code === code) ?? null;
    writeAuditLog({
      action: "glAccounts.create",
      entityType: "gl_account",
      entityId: code,
      after
    });
    return after;
  });
  ipcMain.handle("glAccounts.update", async (_event, payload: unknown) => {
    const value = requireObjectPayload(payload, "glAccounts.update requires payload.");
    const code = getRequiredString(value, "code", "glAccounts.update requires code.");
    const repo = getCrudRepository();
    const before = repo.listGlAccounts().find((entry) => entry.code === code) ?? null;
    repo.upsertGlAccount({
      code,
      name: getRequiredString(value, "name", "glAccounts.update requires name."),
      active: getOptionalBoolean(value, "active")
    });
    const after = repo.listGlAccounts().find((entry) => entry.code === code) ?? null;
    writeAuditLog({
      action: "glAccounts.update",
      entityType: "gl_account",
      entityId: code,
      before,
      after
    });
    return after;
  });
  ipcMain.handle("glAccounts.delete", async (_event, payload: unknown) => {
    const value = requireObjectPayload(payload, "glAccounts.delete requires payload.");
    const code = getOptionalString(value, "code") ?? getOptionalString(value, "id");
    if (!code) {
      throw new Error("glAccounts.delete requires code.");
    }
    const repo = getCrudRepository();
    const before = repo.listGlAccounts().find((entry) => entry.code === code) ?? null;
    repo.deleteGlAccount(code);
    writeAuditLog({
      action: "glAccounts.delete",
      entityType: "gl_account",
      entityId: code,
      before
    });
    return { ok: true, code };
  });

  ipcMain.handle("actuals.unmatched.list", async (_event, payload: unknown) => {
    const parsed = parseUnmatchedListPayload(payload);
    const handle = requireDatabaseHandle();
    const unmatched = listUnmatchedActualTransactions(handle.db, parsed.scenarioId);
    const suggestionQuery = handle.db.prepare(
      `
        SELECT
          o.id AS occurrenceId,
          o.occurrence_date AS occurrenceDate,
          o.amount_minor AS amountMinor,
          o.currency AS currency
        FROM occurrence o
        JOIN expense_line e ON e.id = o.expense_line_id
        LEFT JOIN spend_transaction t ON t.matched_occurrence_id = o.id
        WHERE o.scenario_id = ?
          AND e.service_id = ?
          AND o.amount_minor = ?
          AND o.currency = ?
          AND t.id IS NULL
        ORDER BY ABS(julianday(o.occurrence_date) - julianday(?)), o.occurrence_date
        LIMIT 5
      `
    );
    const reviewQuery = handle.db.prepare(
      `
        SELECT
          id,
          disposition,
          driver_tag AS driverTag,
          matched_occurrence_id AS matchedOccurrenceId,
          created_expense_line_id AS createdExpenseLineId,
          reviewer,
          comment,
          reviewed_at AS reviewedAt
        FROM unmatched_actual_review
        WHERE transaction_id = ?
      `
    );

    const items = unmatched.map((entry) => ({
      ...entry,
      suggestions: suggestionQuery.all(
        entry.scenarioId,
        entry.serviceId,
        entry.amountMinor,
        entry.currency,
        entry.transactionDate
      ),
      review:
        (reviewQuery.get(entry.id) as
          | {
              id: string;
              disposition: string;
              driverTag: string | null;
              matchedOccurrenceId: string | null;
              createdExpenseLineId: string | null;
              reviewer: string;
              comment: string | null;
              reviewedAt: string;
            }
          | undefined) ?? null
    }));
    return {
      scenarioId: parsed.scenarioId,
      total: items.length,
      items
    };
  });
  ipcMain.handle("actuals.unmatched.review", async (_event, payload: unknown) => {
    const parsed = parseUnmatchedReviewPayload(payload);
    const handle = requireDatabaseHandle();
    const transaction = handle.db
      .prepare(
        `
          SELECT
            id,
            scenario_id AS scenarioId
          FROM spend_transaction
          WHERE id = ?
        `
      )
      .get(parsed.transactionId) as { id: string; scenarioId: string } | undefined;
    if (!transaction) {
      throw new Error(`Unmatched transaction not found: ${parsed.transactionId}`);
    }
    if (parsed.scenarioId !== transaction.scenarioId) {
      throw new Error("actuals.unmatched.review scenarioId does not match transaction scenario.");
    }

    const run = handle.db.transaction(() => {
      if (parsed.disposition === "matched" && parsed.matchedOccurrenceId) {
        handle.db
          .prepare(
            `
              UPDATE spend_transaction
              SET matched_occurrence_id = ?,
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `
          )
          .run(parsed.matchedOccurrenceId, parsed.transactionId);
        handle.db
          .prepare(
            `
              UPDATE occurrence
              SET state = 'actualized',
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `
          )
          .run(parsed.matchedOccurrenceId);
      }

      handle.db
        .prepare(
          `
            INSERT INTO unmatched_actual_review (
              id,
              transaction_id,
              scenario_id,
              disposition,
              driver_tag,
              matched_occurrence_id,
              created_expense_line_id,
              reviewer,
              comment,
              reviewed_at,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT(transaction_id) DO UPDATE SET
              disposition = excluded.disposition,
              driver_tag = excluded.driver_tag,
              matched_occurrence_id = excluded.matched_occurrence_id,
              reviewer = excluded.reviewer,
              comment = excluded.comment,
              reviewed_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          `
        )
        .run(
          crypto.randomUUID(),
          parsed.transactionId,
          transaction.scenarioId,
          parsed.disposition,
          parsed.driverTag ?? null,
          parsed.matchedOccurrenceId ?? null,
          parsed.reviewer,
          parsed.comment ?? null
        );
    });
    run();
    writeAuditLog({
      action: "actuals.unmatched.review",
      entityType: "spend_transaction",
      entityId: parsed.transactionId,
      after: parsed
    });
    return {
      ok: true,
      transactionId: parsed.transactionId,
      disposition: parsed.disposition
    };
  });
  ipcMain.handle("actuals.unmatched.createExpense", async (_event, payload: unknown) => {
    const parsed = parseUnmatchedCreateExpensePayload(payload);
    const handle = requireDatabaseHandle();
    const transaction = handle.db
      .prepare(
        `
          SELECT
            id,
            scenario_id AS scenarioId,
            service_id AS serviceId,
            contract_id AS contractId,
            transaction_date AS transactionDate,
            amount_minor AS amountMinor,
            currency,
            description
          FROM spend_transaction
          WHERE id = ?
        `
      )
      .get(parsed.transactionId) as
      | {
          id: string;
          scenarioId: string;
          serviceId: string;
          contractId: string | null;
          transactionDate: string;
          amountMinor: number;
          currency: string;
          description: string | null;
        }
      | undefined;
    if (!transaction) {
      throw new Error(`Unmatched transaction not found: ${parsed.transactionId}`);
    }
    if (parsed.scenarioId !== transaction.scenarioId) {
      throw new Error(
        "actuals.unmatched.createExpense scenarioId does not match transaction scenario."
      );
    }

    const repo = getCrudRepository();
    const expenseLineId = repo.createExpenseLineWithOptionalRecurrence({
      scenarioId: transaction.scenarioId,
      serviceId: transaction.serviceId,
      contractId: transaction.contractId,
      name:
        parsed.name ??
        transaction.description?.trim() ??
        `Imported actual ${transaction.transactionDate}`,
      expenseType: parsed.expenseType ?? "one_time",
      status: parsed.status ?? "actual",
      amountMinor: transaction.amountMinor,
      currency: transaction.currency,
      capexOpex: parsed.capexOpex,
      glAccountCode: parsed.glAccountCode,
      costCenterCode: parsed.costCenterCode,
      fundingSource: parsed.fundingSource,
      startDate: transaction.transactionDate,
      endDate: transaction.transactionDate
    });

    handle.db
      .prepare(
        `
          INSERT INTO unmatched_actual_review (
            id,
            transaction_id,
            scenario_id,
            disposition,
            driver_tag,
            matched_occurrence_id,
            created_expense_line_id,
            reviewer,
            comment,
            reviewed_at,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, 'create_expense', ?, NULL, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT(transaction_id) DO UPDATE SET
            disposition = excluded.disposition,
            driver_tag = excluded.driver_tag,
            created_expense_line_id = excluded.created_expense_line_id,
            reviewer = excluded.reviewer,
            comment = excluded.comment,
            reviewed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        `
      )
      .run(
        crypto.randomUUID(),
        parsed.transactionId,
        transaction.scenarioId,
        parsed.driverTag ?? null,
        expenseLineId,
        parsed.reviewer,
        parsed.comment ?? null
      );

    writeAuditLog({
      action: "actuals.unmatched.createExpense",
      entityType: "expense_line",
      entityId: expenseLineId,
      after: {
        transactionId: parsed.transactionId,
        expenseLineId
      }
    });

    return {
      ok: true,
      transactionId: parsed.transactionId,
      expenseLineId
    };
  });

  ipcMain.handle("showback.generate", async (_event, payload: unknown) => {
    const parsed = parseShowbackGeneratePayload(payload);
    const handle = requireDatabaseHandle();
    const sourceRows = handle.db
      .prepare(
        `
          SELECT
            e.id AS expenseLineId,
            e.service_id AS serviceId,
            e.cost_center_code AS costCenterCode,
            s.owner_team AS ownerTeam,
            e.amount_minor AS amountMinor,
            e.currency
          FROM expense_line e
          LEFT JOIN service s ON s.id = e.service_id
          WHERE e.scenario_id = ?
            AND e.deleted_at IS NULL
            AND (e.start_date IS NULL OR e.start_date <= ?)
            AND (e.end_date IS NULL OR e.end_date >= ?)
          ORDER BY e.amount_minor DESC
        `
      )
      .all(parsed.scenarioId, parsed.periodEnd, parsed.periodStart) as Array<{
      expenseLineId: string;
      serviceId: string;
      costCenterCode: string | null;
      ownerTeam: string | null;
      amountMinor: number;
      currency: string;
    }>;

    const lineRows = sourceRows.map((row) => ({
      ...row,
      groupKey:
        parsed.groupBy === "team"
          ? row.ownerTeam ?? "Unassigned"
          : row.costCenterCode ?? "UNALLOCATED"
    }));
    const totalMinor = lineRows.reduce((sum, row) => sum + row.amountMinor, 0);
    const currencies = Array.from(new Set(lineRows.map((row) => row.currency)));
    const statementCurrency =
      parsed.currency ?? (currencies.length === 1 ? currencies[0] : "MIXED");
    const statementId = crypto.randomUUID();
    const generatedAt = new Date().toISOString();

    const run = handle.db.transaction(() => {
      handle.db
        .prepare(
          `
            INSERT INTO showback_statement (
              id,
              scenario_id,
              period_start,
              period_end,
              group_by,
              generated_at,
              generated_by,
              total_minor,
              currency,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `
        )
        .run(
          statementId,
          parsed.scenarioId,
          parsed.periodStart,
          parsed.periodEnd,
          parsed.groupBy,
          generatedAt,
          parsed.generatedBy,
          totalMinor,
          statementCurrency
        );

      const insertLine = handle.db.prepare(
        `
          INSERT INTO showback_line (
            id,
            statement_id,
            cost_center_code,
            owner_team,
            service_id,
            expense_line_id,
            amount_minor,
            currency,
            details_json,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `
      );
      for (const row of lineRows) {
        insertLine.run(
          crypto.randomUUID(),
          statementId,
          row.costCenterCode ?? null,
          row.ownerTeam ?? null,
          row.serviceId,
          row.expenseLineId,
          row.amountMinor,
          row.currency,
          JSON.stringify({
            groupKey: row.groupKey,
            groupBy: parsed.groupBy
          })
        );
      }
    });
    run();

    writeAuditLog({
      action: "showback.generate",
      entityType: "showback_statement",
      entityId: statementId,
      after: {
        scenarioId: parsed.scenarioId,
        lineCount: lineRows.length,
        totalMinor
      }
    });
    return {
      id: statementId,
      scenarioId: parsed.scenarioId,
      periodStart: parsed.periodStart,
      periodEnd: parsed.periodEnd,
      groupBy: parsed.groupBy,
      generatedAt,
      generatedBy: parsed.generatedBy,
      totalMinor,
      currency: statementCurrency,
      lineCount: lineRows.length
    };
  });
  ipcMain.handle("showback.list", async (_event, payload: unknown) => {
    const parsed = parseShowbackListPayload(payload);
    const handle = requireDatabaseHandle();
    const clauses: string[] = [];
    const params: string[] = [];
    if (parsed.scenarioId) {
      clauses.push("scenario_id = ?");
      params.push(parsed.scenarioId);
    }
    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const statements = handle.db
      .prepare(
        `
          SELECT
            id,
            scenario_id AS scenarioId,
            period_start AS periodStart,
            period_end AS periodEnd,
            group_by AS groupBy,
            generated_at AS generatedAt,
            generated_by AS generatedBy,
            total_minor AS totalMinor,
            currency,
            created_at AS createdAt,
            updated_at AS updatedAt
          FROM showback_statement
          ${whereClause}
          ORDER BY generated_at DESC
        `
      )
      .all(...params) as Array<{
      id: string;
      scenarioId: string;
      periodStart: string;
      periodEnd: string;
      groupBy: string;
      generatedAt: string;
      generatedBy: string;
      totalMinor: number;
      currency: string;
      createdAt: string;
      updatedAt: string;
    }>;
    if (!parsed.includeLines) {
      return { statements };
    }
    const lineQuery = handle.db.prepare(
      `
        SELECT
          id,
          statement_id AS statementId,
          cost_center_code AS costCenterCode,
          owner_team AS ownerTeam,
          service_id AS serviceId,
          expense_line_id AS expenseLineId,
          amount_minor AS amountMinor,
          currency,
          details_json AS detailsJson,
          created_at AS createdAt
        FROM showback_line
        WHERE statement_id = ?
        ORDER BY amount_minor DESC
      `
    );
    return {
      statements: statements.map((statement) => ({
        ...statement,
        lines: lineQuery.all(statement.id)
      }))
    };
  });
  ipcMain.handle("showback.export", async (_event, payload: unknown) => {
    const parsed = parseShowbackExportPayload(payload);
    const handle = requireDatabaseHandle();
    const statement = handle.db
      .prepare(
        `
          SELECT
            id,
            scenario_id AS scenarioId,
            period_start AS periodStart,
            period_end AS periodEnd,
            group_by AS groupBy,
            generated_at AS generatedAt,
            generated_by AS generatedBy,
            total_minor AS totalMinor,
            currency
          FROM showback_statement
          WHERE id = ?
        `
      )
      .get(parsed.statementId) as
      | {
          id: string;
          scenarioId: string;
          periodStart: string;
          periodEnd: string;
          groupBy: string;
          generatedAt: string;
          generatedBy: string;
          totalMinor: number;
          currency: string;
        }
      | undefined;
    if (!statement) {
      throw new Error(`Showback statement not found: ${parsed.statementId}`);
    }
    const lines = handle.db
      .prepare(
        `
          SELECT
            id,
            cost_center_code AS costCenterCode,
            owner_team AS ownerTeam,
            service_id AS serviceId,
            expense_line_id AS expenseLineId,
            amount_minor AS amountMinor,
            currency
          FROM showback_line
          WHERE statement_id = ?
          ORDER BY amount_minor DESC
        `
      )
      .all(parsed.statementId) as Array<{
      id: string;
      costCenterCode: string | null;
      ownerTeam: string | null;
      serviceId: string | null;
      expenseLineId: string | null;
      amountMinor: number;
      currency: string;
    }>;

    fs.mkdirSync(parsed.outputDir, { recursive: true });
    const sanitizedBaseName =
      parsed.baseFileName?.replace(/[\\/:*?"<>|]+/g, "-") ??
      `showback-${statement.id}-${statement.generatedAt.replace(/[:.]/g, "-")}`;
    const files: Partial<Record<"csv" | "xlsx", string>> = {};
    const exportRows = lines.map((line) => ({
      statementId: statement.id,
      scenarioId: statement.scenarioId,
      periodStart: statement.periodStart,
      periodEnd: statement.periodEnd,
      groupBy: statement.groupBy,
      costCenterCode: line.costCenterCode,
      ownerTeam: line.ownerTeam,
      serviceId: line.serviceId,
      expenseLineId: line.expenseLineId,
      amountMinor: line.amountMinor,
      amount: (line.amountMinor / 100).toFixed(2),
      currency: line.currency
    }));

    if (parsed.format === "csv") {
      const csvPath = path.join(parsed.outputDir, `${sanitizedBaseName}.csv`);
      const headers = Object.keys(exportRows[0] ?? { statementId: "" });
      const content = [
        headers.map((header) => escapeCsvCell(header)).join(","),
        ...exportRows.map((row) =>
          headers.map((header) => escapeCsvCell(row[header as keyof typeof row])).join(",")
        )
      ].join("\n");
      fs.writeFileSync(csvPath, content, "utf8");
      files.csv = csvPath;
    } else {
      const xlsxPath = path.join(parsed.outputDir, `${sanitizedBaseName}.xlsx`);
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      XLSX.utils.book_append_sheet(workbook, worksheet, "Showback");
      XLSX.writeFile(workbook, xlsxPath);
      files.xlsx = xlsxPath;
    }

    writeAuditLog({
      action: "showback.export",
      entityType: "showback_statement",
      entityId: statement.id,
      after: {
        format: parsed.format,
        files
      }
    });
    return {
      statement,
      files
    };
  });

  ipcMain.handle("approvals.list", async (_event, payload: unknown) => {
    const parsed = parseApprovalListPayload(payload);
    const handle = requireDatabaseHandle();
    const clauses: string[] = [];
    const params: string[] = [];
    if (parsed.scenarioId) {
      clauses.push("scenario_id = ?");
      params.push(parsed.scenarioId);
    }
    if (parsed.entityType) {
      clauses.push("entity_type = ?");
      params.push(parsed.entityType);
    }
    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    return handle.db
      .prepare(
        `
          SELECT
            id,
            scenario_id AS scenarioId,
            service_plan_id AS servicePlanId,
            entity_type AS entityType,
            entity_id AS entityId,
            action,
            actor,
            comment,
            created_at AS createdAt
          FROM approval_record
          ${whereClause}
          ORDER BY created_at DESC
          LIMIT ?
        `
      )
      .all(...params, parsed.limit);
  });
  ipcMain.handle("approvals.create", async (_event, payload: unknown) => {
    const parsed = parseApprovalCreatePayload(payload);
    const id = writeApprovalRecord(parsed);
    writeAuditLog({
      action: "approvals.create",
      entityType: parsed.entityType,
      entityId: parsed.entityId,
      actor: parsed.actor,
      after: {
        approvalRecordId: id,
        action: parsed.action
      }
    });
    return {
      id,
      ...parsed,
      createdAt: new Date().toISOString()
    };
  });

  ipcMain.handle("audit.list", async (_event, payload: unknown) => {
    const parsed = parseAuditListPayload(payload);
    const handle = requireDatabaseHandle();
    const clauses: string[] = [];
    const params: string[] = [];
    if (parsed.entityType) {
      clauses.push("entity_type = ?");
      params.push(parsed.entityType);
    }
    if (parsed.entityId) {
      clauses.push("entity_id = ?");
      params.push(parsed.entityId);
    }
    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    return handle.db
      .prepare(
        `
          SELECT
            id,
            actor,
            action,
            entity_type AS entityType,
            entity_id AS entityId,
            before_json AS beforeJson,
            after_json AS afterJson,
            created_at AS createdAt
          FROM audit_log
          ${whereClause}
          ORDER BY created_at DESC
          LIMIT ?
        `
      )
      .all(...params, parsed.limit);
  });
}

function publishDesktopNotification(event: AlertEventRecord, onClick: () => void): void {
  if (!Notification.isSupported()) {
    return;
  }

  const notification = new Notification({
    title: "BudgetIT Alert",
    body: event.message
  });
  notification.on("click", onClick);
  notification.show();
}

function publishTeamsAlert(event: AlertEventRecord): void {
  const alertInput: TeamsAlertInput = {
    title: "BudgetIT Alert",
    message: event.message,
    entityType: event.entityType,
    entityId: event.entityId,
    fireAt: event.fireAt
  };
  void teamsChannel.sendAlert(getTeamsSettings(), alertInput);
}

function publishAlert(event: AlertEventRecord, onClick: () => void): void {
  publishDesktopNotification(event, onClick);
  publishTeamsAlert(event);
}

function navigateToAlert(payload: AlertNavigatePayload): void {
  mainWindow?.show();
  mainWindow?.webContents.send("alerts.navigate", payload);
}

function runAlertSchedulerTick(): void {
  const store = alertStore;
  if (!store) {
    return;
  }

  const now = currentIsoDate();
  processAlertNotifications(store, now, publishAlert, navigateToAlert);
  monitorBackupFreshness(new Date().toISOString());
}

function startAlertScheduler(): void {
  runAlertSchedulerTick();
  schedulerTimer = setInterval(() => {
    try {
      runAlertSchedulerTick();
    } catch (error) {
      appendDiagnosticLog("ERROR", "Alert scheduler tick failed.", error);
      console.error("Alert scheduler tick failed", error);
    }
  }, ALERT_TICK_INTERVAL_MS);
}

function snoozeAllPendingAlertsForOneDay(): void {
  const store = alertStore;
  if (!store) {
    return;
  }

  const snoozeUntil = toIsoDate(addDays(new Date(), 1));
  for (const event of store.list()) {
    if (event.status === "acked") {
      continue;
    }
    store.snooze(event.id, snoozeUntil);
  }
}

function normalizeHashRoute(route: string): string {
  const trimmed = route.trim();
  if (!trimmed) {
    return "/";
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function loadRendererRoute(window: BrowserWindow, hashRoute: string): void {
  const normalizedHash = normalizeHashRoute(hashRoute);
  const devServerUrl = process.env.BUDGETIT_RENDERER_URL;
  if (devServerUrl) {
    const baseUrl = devServerUrl.replace(/\/+$/, "");
    void window.loadURL(`${baseUrl}#${normalizedHash}`);
    return;
  }

  const indexPath = path.join(__dirname, "../../renderer/dist/index.html");
  void window.loadFile(indexPath, { hash: normalizedHash });
}

function buildHelpHashRoute(payload: { topic?: string; anchor?: string } = {}): string {
  const params = new URLSearchParams();
  if (payload.topic) {
    params.set("topic", payload.topic);
  }
  if (payload.anchor) {
    params.set("anchor", payload.anchor);
  }
  const query = params.toString();
  return query ? `/help?${query}` : "/help";
}

function openHelpWindow(payload: { topic?: string; anchor?: string } = {}): void {
  const route = buildHelpHashRoute(payload);

  if (helpWindow && !helpWindow.isDestroyed()) {
    loadRendererRoute(helpWindow, route);
    helpWindow.show();
    helpWindow.focus();
    return;
  }

  const preloadPath = path.join(__dirname, "preload.js");
  helpWindow = new BrowserWindow({
    width: 980,
    height: 760,
    minWidth: 720,
    minHeight: 560,
    autoHideMenuBar: true,
    show: false,
    title: "BudgetIT Help",
    parent: mainWindow ?? undefined,
    icon: resolveMainWindowIconPath(),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  loadRendererRoute(helpWindow, route);
  helpWindow.once("ready-to-show", () => {
    helpWindow?.show();
  });
  helpWindow.on("closed", () => {
    helpWindow = null;
  });
}

function resolveHelpDocumentPath(): string | null {
  const candidates = [
    path.join(process.cwd(), "docs", HELP_DOCUMENT_FILE_NAME),
    path.join(app.getAppPath(), "docs", HELP_DOCUMENT_FILE_NAME),
    path.join(app.getAppPath(), "..", "..", "docs", HELP_DOCUMENT_FILE_NAME),
    path.join(__dirname, "..", "..", "..", "docs", HELP_DOCUMENT_FILE_NAME)
  ];

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch {
      // Ignore invalid path candidates and continue.
    }
  }
  return null;
}

function getHelpDocument(): { markdown: string; sourcePath: string | null } {
  const sourcePath = resolveHelpDocumentPath();
  if (!sourcePath) {
    return {
      markdown:
        "# BudgetIT Help\n\nHelp document not found. Expected docs/help-system.md in the app workspace.",
      sourcePath: null
    };
  }

  return {
    markdown: fs.readFileSync(sourcePath, "utf8"),
    sourcePath
  };
}

function getApplicationMenuTemplate(
  requestExit: () => void
): MenuItemConstructorOptions[] {
  return [
    {
      label: "File",
      submenu: [
        {
          label: "Show",
          click: () => {
            mainWindow?.show();
          }
        },
        { type: "separator" },
        {
          label: "Exit",
          click: requestExit
        }
      ]
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" }
      ]
    },
    {
      label: "View",
      submenu: [{ role: "reload" }, { role: "toggleDevTools" }, { role: "togglefullscreen" }]
    },
    {
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "close" }]
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Help Center",
          accelerator: "F1",
          click: () => openHelpWindow({ topic: "quick-start" })
        },
        {
          label: "Keyboard Shortcuts",
          click: () => openHelpWindow({ topic: "global-keyboard-shortcuts" })
        }
      ]
    }
  ];
}

function configureApplicationMenu(requestExit: () => void): void {
  Menu.setApplicationMenu(Menu.buildFromTemplate(getApplicationMenuTemplate(requestExit)));
}

function getTrayMenuTemplate(requestExit: () => void): MenuItemConstructorOptions[] {
  return [
    {
      label: "Show",
      click: () => {
        mainWindow?.show();
      }
    },
    {
      label: "Snooze alerts",
      click: () => {
        snoozeAllPendingAlertsForOneDay();
      }
    },
    { type: "separator" },
    {
      label: "Exit",
      click: requestExit
    }
  ];
}

function createFallbackTrayIcon(): Electron.NativeImage {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <circle cx="32" cy="32" r="30" fill="#0c8550"/>
      <circle cx="32" cy="32" r="27.5" fill="none" stroke="#086039" stroke-width="3"/>
      <text x="32" y="44" text-anchor="middle" font-size="36" font-family="Segoe UI, Arial" font-weight="700" fill="#ffffff">$</text>
    </svg>
  `;
  return nativeImage.createFromDataURL(
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  );
}

function createTrayIcon(): Electron.NativeImage {
  const iconPath = path.join(__dirname, "../assets", TRAY_ICON_FILE_NAME);
  const iconFromPath = nativeImage.createFromPath(iconPath);
  if (!iconFromPath.isEmpty()) {
    return iconFromPath.resize({ width: 16, height: 16, quality: "best" });
  }

  const fallback = createFallbackTrayIcon();
  if (!fallback.isEmpty()) {
    return fallback.resize({ width: 16, height: 16, quality: "best" });
  }

  return nativeImage.createEmpty();
}

function ensureTray(requestExit: () => void): Tray {
  if (tray) {
    return tray;
  }

  tray = new Tray(createTrayIcon());
  tray.setToolTip("BudgetIT");
  tray.setContextMenu(Menu.buildFromTemplate(getTrayMenuTemplate(requestExit)));
  tray.on("double-click", () => {
    mainWindow?.show();
  });
  return tray;
}

function createMainWindow(options: { showOnReady?: boolean } = {}): BrowserWindow {
  const { showOnReady = true } = options;
  const preloadPath = path.join(__dirname, "preload.js");
  const win = new BrowserWindow(getMainWindowOptions(preloadPath));
  loadRendererRoute(win, "/");

  win.once("ready-to-show", () => {
    if (showOnReady) {
      win.show();
    }
  });

  win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedUrl) => {
    appendDiagnosticLog("ERROR", "Renderer failed to load URL.", {
      errorCode,
      errorDescription,
      validatedUrl
    });
  });

  win.on("close", (event) => {
    if (shouldMinimizeToTrayOnClose(runtimeSettings, isQuitting)) {
      event.preventDefault();
      win.hide();
    }
  });

  return win;
}

export async function startDesktopApp(): Promise<void> {
  const requestExit = createExitHandler(
    () => stopSchedulerAndCloseDatabase(),
    () => {
      isQuitting = true;
      app.quit();
    }
  );

  await app.whenReady();
  initializeDiagnosticsLogging();

  runtimeSettings = readRuntimeSettings(getRuntimeSettingsPath());
  app.setLoginItemSettings(
    buildLoginItemSettings(runtimeSettings.startWithWindows, process.platform)
  );
  const startHiddenToTray = shouldStartHiddenToTray(
    runtimeSettings,
    process.platform,
    process.argv
  );

  initializeDatabaseAndAlerts();
  setupIpcHandlers(requestExit);

  configureApplicationMenu(requestExit);
  ensureTray(requestExit);
  mainWindow = createMainWindow({ showOnReady: !startHiddenToTray });
  startAlertScheduler();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    } else {
      mainWindow?.show();
    }
  });

  app.on("before-quit", () => {
    helpWindow?.destroy();
    helpWindow = null;
    stopSchedulerAndCloseDatabase();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      requestExit();
    }
  });
}

