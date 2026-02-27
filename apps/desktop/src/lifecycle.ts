export interface RuntimeSettings {
  startWithWindows: boolean;
  minimizeToTray: boolean;
  teamsEnabled: boolean;
  teamsWebhookUrl: string;
}

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

export function createExitHandler(stopScheduler: () => void, quitApp: () => void): () => void {
  return () => {
    stopScheduler();
    quitApp();
  };
}

