import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  bootstrapEncryptedDatabase,
  buildReportPresetDataset,
  buildMonthlyVarianceDataset,
  createEncryptedBackup,
  getReplacementPlanDetail,
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
  createExitHandler,
  DEFAULT_RUNTIME_SETTINGS,
  mergeRuntimeSettings,
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
const APP_ICON_FILE_NAME = "app-icon.ico";
const TRAY_ICON_FILE_NAME = "tray-icon.png";
const DIAGNOSTICS_LOG_DIR_NAME = "logs";
const DIAGNOSTICS_LOG_FILE_NAME = "desktop.log";

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
  "costCenter"
]);

export type ReportsQueryValue =
  | ReportPresetQuery
  | "variance.monthly"
  | "replacement.detail"
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

      const devServerUrl = process.env.BUDGETIT_RENDERER_URL;
      if (devServerUrl) {
        void mainWindow.loadURL(devServerUrl);
      } else {
        const indexPath = path.join(__dirname, "../../renderer/dist/index.html");
        void mainWindow.loadFile(indexPath);
      }

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
  const appIconPath = path.join(__dirname, "../assets", APP_ICON_FILE_NAME);
  if (fs.existsSync(appIconPath)) {
    return appIconPath;
  }

  const trayIconPath = path.join(__dirname, "../assets", TRAY_ICON_FILE_NAME);
  if (fs.existsSync(trayIconPath)) {
    return trayIconPath;
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
  app.setLoginItemSettings({ openAtLogin: runtimeSettings.startWithWindows });
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

function parseImportPayload(payload: unknown): {
  mode: "expenses" | "actuals";
  filePath: string;
  mapping?: Record<string, string>;
  templateName?: string;
  useSavedTemplate?: boolean;
  saveTemplate?: boolean;
} {
  if (!payload || typeof payload !== "object") {
    throw new Error("import payload requires a filePath.");
  }

  const value = payload as {
    mode?: unknown;
    filePath?: unknown;
    mapping?: unknown;
    templateName?: unknown;
    useSavedTemplate?: unknown;
    saveTemplate?: unknown;
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

  return {
    mode: value.mode === "actuals" ? "actuals" : "expenses",
    filePath: value.filePath,
    mapping,
    templateName,
    useSavedTemplate: typeof value.useSavedTemplate === "boolean" ? value.useSavedTemplate : undefined,
    saveTemplate: typeof value.saveTemplate === "boolean" ? value.saveTemplate : undefined
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
  filters?: ReportDatasetFilters;
} {
  if (!payload || typeof payload !== "object") {
    throw new Error("reports.query requires payload with query.");
  }
  const value = payload as {
    query?: unknown;
    scenarioId?: unknown;
    servicePlanId?: unknown;
    horizonMonths?: unknown;
    filters?: unknown;
  };
  if (typeof value.query !== "string" || value.query.trim().length === 0) {
    throw new Error("reports.query requires a non-empty query.");
  }
  const query = value.query.trim() as ReportsQueryValue;
  if (!REPORT_QUERY_SET.has(query)) {
    throw new Error(`Unsupported reports.query value: ${value.query}`);
  }
  const parsedHorizon =
    typeof value.horizonMonths === "number" && Number.isFinite(value.horizonMonths)
      ? Math.floor(value.horizonMonths)
      : undefined;
  const horizonMonths =
    parsedHorizon && parsedHorizon > 0 && parsedHorizon <= 60 ? parsedHorizon : undefined;
  return {
    query,
    scenarioId: typeof value.scenarioId === "string" && value.scenarioId.trim().length > 0 ? value.scenarioId : "baseline",
    servicePlanId:
      typeof value.servicePlanId === "string" && value.servicePlanId.trim().length > 0
        ? value.servicePlanId
        : undefined,
    horizonMonths,
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
    return {
      scenarioId: "baseline",
      reportType: "dashboard.summary",
      outputDir: defaultOutputDir
    };
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

  const scenarioId =
    typeof value.scenarioId === "string" && value.scenarioId.trim().length > 0
      ? value.scenarioId
      : "baseline";
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
    return {
      scenarioId: "baseline",
      reportType: "dashboard.summary"
    };
  }

  const value = payload as {
    scenarioId?: unknown;
    reportType?: unknown;
    filters?: unknown;
  };

  const scenarioId =
    typeof value.scenarioId === "string" && value.scenarioId.trim().length > 0
      ? value.scenarioId
      : "baseline";
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
  ipcMain.handle("alerts.sendTest", async () => teamsChannel.sendTest(getTeamsSettings()));
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
      useSavedTemplate: parsed.useSavedTemplate,
      saveTemplate: parsed.saveTemplate,
      templateStorePath: getImportTemplateStorePath()
    });
  });
  ipcMain.handle("import.commit", async (_event, payload: unknown) => {
    const parsed = parseImportPayload(payload);
    const handle = requireDatabaseHandle();
    if (parsed.mode === "actuals") {
      return commitActualsImport(handle.db, {
        filePath: parsed.filePath,
        mapping: parsed.mapping as ActualImportMapping | undefined
      });
    }
    const rules = loadAutoTagRules(getAutoTagRulesPath());
    const committed = commitExpenseImport(handle.db, {
      filePath: parsed.filePath,
      mapping: parsed.mapping as ImportColumnMapping | undefined,
      templateName: parsed.templateName,
      useSavedTemplate: parsed.useSavedTemplate,
      saveTemplate: parsed.saveTemplate,
      templateStorePath: getImportTemplateStorePath(),
      autoTagRules: rules
    });
    const suggestions: AutoTagSuggestion[] = suggestRulesFromManualCorrections(handle.db);
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
      return getReplacementPlanDetail(handle.db, parsed.servicePlanId);
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

function createMainWindow(): BrowserWindow {
  const preloadPath = path.join(__dirname, "preload.js");
  const win = new BrowserWindow(getMainWindowOptions(preloadPath));

  const devServerUrl = process.env.BUDGETIT_RENDERER_URL;
  if (devServerUrl) {
    void win.loadURL(devServerUrl);
  } else {
    const indexPath = path.join(__dirname, "../../renderer/dist/index.html");
    void win.loadFile(indexPath);
  }

  win.once("ready-to-show", () => {
    win.show();
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
  app.setLoginItemSettings({ openAtLogin: runtimeSettings.startWithWindows });

  initializeDatabaseAndAlerts();
  setupIpcHandlers(requestExit);

  mainWindow = createMainWindow();
  ensureTray(requestExit);
  startAlertScheduler();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    } else {
      mainWindow?.show();
    }
  });

  app.on("before-quit", () => {
    stopSchedulerAndCloseDatabase();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      requestExit();
    }
  });
}

