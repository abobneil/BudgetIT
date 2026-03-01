export interface RuntimeSettings {
  startWithWindows: boolean;
  minimizeToTray: boolean;
  teamsEnabled: boolean;
  teamsWebhookUrl: string;
}

export const WINDOWS_STARTUP_MARKER_ARG = "--budgetit-startup";

export const DEFAULT_RUNTIME_SETTINGS: RuntimeSettings = {
  startWithWindows: true,
  minimizeToTray: true,
  teamsEnabled: false,
  teamsWebhookUrl: ""
};

export function mergeRuntimeSettings(
  current: RuntimeSettings,
  update: Partial<RuntimeSettings>
): RuntimeSettings {
  return {
    startWithWindows:
      typeof update.startWithWindows === "boolean"
        ? update.startWithWindows
        : current.startWithWindows,
    minimizeToTray:
      typeof update.minimizeToTray === "boolean"
        ? update.minimizeToTray
        : current.minimizeToTray,
    teamsEnabled:
      typeof update.teamsEnabled === "boolean"
        ? update.teamsEnabled
        : current.teamsEnabled,
    teamsWebhookUrl:
      typeof update.teamsWebhookUrl === "string"
        ? update.teamsWebhookUrl
        : current.teamsWebhookUrl
  };
}

export function shouldMinimizeToTrayOnClose(
  settings: RuntimeSettings,
  isQuitting: boolean
): boolean {
  return settings.minimizeToTray && !isQuitting;
}

export function buildLoginItemSettings(
  openAtLogin: boolean,
  platform: NodeJS.Platform
): { openAtLogin: boolean; args?: string[] } {
  if (platform === "win32") {
    return {
      openAtLogin,
      args: openAtLogin ? [WINDOWS_STARTUP_MARKER_ARG] : []
    };
  }

  return { openAtLogin };
}

export function shouldStartHiddenToTray(
  settings: RuntimeSettings,
  platform: NodeJS.Platform,
  argv: readonly string[]
): boolean {
  return (
    platform === "win32" &&
    settings.startWithWindows &&
    argv.includes(WINDOWS_STARTUP_MARKER_ARG)
  );
}

export function createExitHandler(stopScheduler: () => void, quitApp: () => void): () => void {
  return () => {
    stopScheduler();
    quitApp();
  };
}

