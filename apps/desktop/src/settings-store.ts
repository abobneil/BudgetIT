import fs from "node:fs";
import path from "node:path";

import { DEFAULT_RUNTIME_SETTINGS, mergeRuntimeSettings, type RuntimeSettings } from "./lifecycle";

export interface RuntimeSettingsSecretStore {
  readSecret(): string | null;
  writeSecret(secret: string): void;
  deleteSecret(): void;
}

type PersistedRuntimeSettings = Omit<RuntimeSettings, "teamsWebhookUrl"> & {
  teamsWebhookUrl?: string;
};

function parsePersistedRuntimeSettings(filePath: string): Partial<PersistedRuntimeSettings> | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as Partial<PersistedRuntimeSettings>;
  } catch {
    return null;
  }
}

export function hasPlaintextRuntimeSettingsSecrets(filePath: string): boolean {
  const parsed = parsePersistedRuntimeSettings(filePath);
  return typeof parsed?.teamsWebhookUrl === "string" && parsed.teamsWebhookUrl.trim().length > 0;
}

export function readRuntimeSettings(
  filePath: string,
  secretStore?: RuntimeSettingsSecretStore
): RuntimeSettings {
  const parsed = parsePersistedRuntimeSettings(filePath);
  const merged = mergeRuntimeSettings(DEFAULT_RUNTIME_SETTINGS, parsed ?? {});
  const secret = secretStore?.readSecret();

  if (typeof secret === "string") {
    return {
      ...merged,
      teamsWebhookUrl: secret
    };
  }

  return merged;
}

export function writeRuntimeSettings(
  filePath: string,
  settings: RuntimeSettings,
  secretStore?: RuntimeSettingsSecretStore
): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  if (!secretStore) {
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), "utf8");
    return;
  }

  const normalizedSecret = settings.teamsWebhookUrl.trim();
  const persistedSettings: RuntimeSettings = {
    ...settings,
    teamsWebhookUrl: ""
  };

  fs.writeFileSync(filePath, JSON.stringify(persistedSettings, null, 2), "utf8");

  if (normalizedSecret.length > 0) {
    secretStore.writeSecret(normalizedSecret);
    return;
  }

  secretStore.deleteSecret();
}

