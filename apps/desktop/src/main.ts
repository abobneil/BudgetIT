import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  bootstrapEncryptedDatabase,
  createEncryptedBackup,
  restoreEncryptedBackup,
  runMigrations,
  type AlertEventRecord,
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
  commitExpenseImport,
  previewExpenseImport,
  type ImportColumnMapping
} from "./import-wizard";

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
const BACKUP_HEALTH_FILE_NAME = "backup-health.json";
const BACKUP_STALE_THRESHOLD_DAYS = 7;
const IMPORT_TEMPLATE_FILE_NAME = "import-mappings.json";

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
  "anchorDate"
]);

export function getMainWindowOptions(preloadPath: string): BrowserWindowConstructorOptions {
  return {
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 720,
    show: false,
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

function parseImportPayload(payload: unknown): {
  filePath: string;
  mapping?: ImportColumnMapping;
  templateName?: string;
  useSavedTemplate?: boolean;
  saveTemplate?: boolean;
} {
  if (!payload || typeof payload !== "object") {
    throw new Error("import payload requires a filePath.");
  }

  const value = payload as {
    filePath?: unknown;
    mapping?: unknown;
    templateName?: unknown;
    useSavedTemplate?: unknown;
    saveTemplate?: unknown;
  };

  if (typeof value.filePath !== "string" || value.filePath.trim().length === 0) {
    throw new Error("import payload requires a non-empty filePath.");
  }

  let mapping: ImportColumnMapping | undefined;
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
    filePath: value.filePath,
    mapping,
    templateName,
    useSavedTemplate: typeof value.useSavedTemplate === "boolean" ? value.useSavedTemplate : undefined,
    saveTemplate: typeof value.saveTemplate === "boolean" ? value.saveTemplate : undefined
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
    return previewExpenseImport(handle.db, {
      ...parsed,
      templateStorePath: getImportTemplateStorePath()
    });
  });
  ipcMain.handle("import.commit", async (_event, payload: unknown) => {
    const parsed = parseImportPayload(payload);
    const handle = requireDatabaseHandle();
    return commitExpenseImport(handle.db, {
      ...parsed,
      templateStorePath: getImportTemplateStorePath()
    });
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

function ensureTray(requestExit: () => void): Tray {
  if (tray) {
    return tray;
  }

  tray = new Tray(nativeImage.createEmpty());
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

