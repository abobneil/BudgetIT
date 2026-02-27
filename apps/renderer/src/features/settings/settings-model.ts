import type { RuntimeSettings } from "../../lib/ipcClient";

export type SettingsSectionDirtyState = {
  runtime: boolean;
  notifications: boolean;
};

export type SettingsValidationResult = {
  runtime: string[];
  notifications: string[];
  backupRestore: string[];
};

export function computeSettingsSectionDirtyState(
  baseline: RuntimeSettings,
  draft: RuntimeSettings
): SettingsSectionDirtyState {
  return {
    runtime:
      baseline.startWithWindows !== draft.startWithWindows ||
      baseline.minimizeToTray !== draft.minimizeToTray,
    notifications:
      baseline.teamsEnabled !== draft.teamsEnabled ||
      baseline.teamsWebhookUrl !== draft.teamsWebhookUrl
  };
}

export function validateSettingsDraft(
  draft: RuntimeSettings,
  restoreInput: { backupPath: string; manifestPath: string }
): SettingsValidationResult {
  const runtime: string[] = [];
  const notifications: string[] = [];
  const backupRestore: string[] = [];

  if (draft.teamsEnabled) {
    if (!draft.teamsWebhookUrl.trim()) {
      notifications.push("Webhook URL is required when Teams notifications are enabled.");
    } else if (!/^https?:\/\//i.test(draft.teamsWebhookUrl.trim())) {
      notifications.push("Webhook URL must start with http:// or https://.");
    }
  }

  const hasBackupPath = restoreInput.backupPath.trim().length > 0;
  const hasManifestPath = restoreInput.manifestPath.trim().length > 0;
  if (hasBackupPath !== hasManifestPath) {
    backupRestore.push("Provide both backup and manifest paths before restoring.");
  }

  return {
    runtime,
    notifications,
    backupRestore
  };
}

export function hasDirtySections(state: SettingsSectionDirtyState): boolean {
  return state.runtime || state.notifications;
}
