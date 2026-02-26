import path from "node:path";

import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  Tray,
  nativeImage,
  type BrowserWindowConstructorOptions,
  type MenuItemConstructorOptions
} from "electron";

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

const scheduler = {
  stop: () => undefined
};

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
        // Placeholder: alert scheduler will be added in issue C1.
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
    () => scheduler.stop(),
    () => {
      isQuitting = true;
      app.quit();
    }
  );

  await app.whenReady();

  runtimeSettings = readRuntimeSettings(getRuntimeSettingsPath());
  app.setLoginItemSettings({ openAtLogin: runtimeSettings.startWithWindows });

  setupIpcHandlers(requestExit);

  mainWindow = createMainWindow();
  ensureTray(requestExit);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    } else {
      mainWindow?.show();
    }
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}

