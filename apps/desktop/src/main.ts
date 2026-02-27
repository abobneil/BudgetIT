import path from "node:path";

import {
  bootstrapEncryptedDatabase,
  runMigrations,
  type AlertEventRecord
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

function requireAlertStore(): AlertStore {
  if (!alertStore) {
    throw new Error("Alert store is not initialized.");
  }
  return alertStore;
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

function setupIpcHandlers(requestExit: () => void): void {
  ipcMain.handle("settings.get", async () => runtimeSettings);
  ipcMain.handle("settings.update", async (_event, payload: Partial<RuntimeSettings>) => {
    const nextSettings = mergeRuntimeSettings(runtimeSettings, payload ?? {});
    return persistRuntimeSettings(nextSettings);
  });
  ipcMain.handle("app.exit", async () => {
    requestExit();
    return { ok: true };
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
}

function publishDesktopAlert(event: AlertEventRecord, onClick: () => void): void {
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
  processAlertNotifications(store, now, publishDesktopAlert, navigateToAlert);
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

