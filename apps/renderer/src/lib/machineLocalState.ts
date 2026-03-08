import type { RestoreSummary } from "../restore-banner";
import { resolveBrowserStorage } from "./browserStorage";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key"> & {
  length: number;
};

export type MachineLocalStateScope = "device" | "profile";
export type MachineLocalStateBackupCoverage = "excluded";
export type MachineLocalStateRestoreBehavior = "clear-after-restore";
export type MachineLocalStatePolicy = {
  id:
    | "dashboard-layout"
    | "saved-report-presets"
    | "nlq-history"
    | "quick-start-checklist";
  label: string;
  scope: MachineLocalStateScope;
  backupCoverage: MachineLocalStateBackupCoverage;
  restoreBehavior: MachineLocalStateRestoreBehavior;
  rationale: string;
  storageKey?: string;
  storageKeyPrefix?: string;
};

export const DASHBOARD_LAYOUT_STORAGE_KEY = "budgetit.dashboard-layout.v1";
export const SAVED_REPORT_PRESETS_STORAGE_KEY = "budgetit.saved-report-presets.v1";
export const NLQ_HISTORY_STORAGE_KEY_PREFIX = "budgetit.nlq-history.v1";
export const QUICK_START_CHECKLIST_STORAGE_KEY = "budgetit.help.quick-start-checklist.v1";

const MACHINE_LOCAL_STATE_RESTORE_TOKEN_KEY = "budgetit.machine-local.restore-token.v1";

export function getNlqHistoryStorageKey(profileId: string): string {
  return `${NLQ_HISTORY_STORAGE_KEY_PREFIX}:${profileId}`;
}

export const MACHINE_LOCAL_STATE_POLICY: MachineLocalStatePolicy[] = [
  {
    id: "dashboard-layout",
    label: "dashboard layout",
    scope: "device",
    backupCoverage: "excluded",
    restoreBehavior: "clear-after-restore",
    rationale: "Dashboard layout is a per-device workspace preference.",
    storageKey: DASHBOARD_LAYOUT_STORAGE_KEY
  },
  {
    id: "saved-report-presets",
    label: "saved report presets",
    scope: "device",
    backupCoverage: "excluded",
    restoreBehavior: "clear-after-restore",
    rationale:
      "Saved report presets are renderer-side workspace shortcuts, not source-of-truth report data.",
    storageKey: SAVED_REPORT_PRESETS_STORAGE_KEY
  },
  {
    id: "nlq-history",
    label: "NLQ history",
    scope: "profile",
    backupCoverage: "excluded",
    restoreBehavior: "clear-after-restore",
    rationale:
      "NLQ history is a local query convenience and is stored per profile id on the current machine.",
    storageKeyPrefix: `${NLQ_HISTORY_STORAGE_KEY_PREFIX}:`
  },
  {
    id: "quick-start-checklist",
    label: "quick-start checklist progress",
    scope: "device",
    backupCoverage: "excluded",
    restoreBehavior: "clear-after-restore",
    rationale: "Quick-start checklist progress is onboarding state for the current installation.",
    storageKey: QUICK_START_CHECKLIST_STORAGE_KEY
  }
];

function getStorage(
  storage: StorageLike | null | undefined = undefined
): StorageLike | null {
  return resolveBrowserStorage(storage) as StorageLike | null;
}

function listStorageKeys(storage: StorageLike): string[] {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key) {
      keys.push(key);
    }
  }
  return keys;
}

function matchesMachineLocalState(key: string): boolean {
  return MACHINE_LOCAL_STATE_POLICY.some((definition) => {
    if (definition.storageKey && key === definition.storageKey) {
      return true;
    }
    if (definition.storageKeyPrefix && key.startsWith(definition.storageKeyPrefix)) {
      return true;
    }
    return false;
  });
}

function buildRestoreToken(summary: RestoreSummary): string {
  return JSON.stringify([
    summary.restoredAt,
    summary.sourceLastMutationAt,
    summary.schemaVersion
  ]);
}

function joinLabels(labels: string[]): string {
  if (labels.length === 0) {
    return "";
  }
  if (labels.length === 1) {
    return labels[0];
  }
  if (labels.length === 2) {
    return `${labels[0]} and ${labels[1]}`;
  }
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

export const MACHINE_LOCAL_STATE_LABELS = MACHINE_LOCAL_STATE_POLICY.map(
  (definition) => definition.label
);

export const MACHINE_LOCAL_STATE_SUMMARY = joinLabels(MACHINE_LOCAL_STATE_LABELS);

export const MACHINE_LOCAL_STATE_DECISION_SUMMARY =
  `${MACHINE_LOCAL_STATE_SUMMARY} are intentionally kept as machine-local UI state. ` +
  "They are excluded from encrypted backup coverage and cleared after restore to avoid stale UI state.";

export function clearMachineLocalState(
  storage: StorageLike | null | undefined = getStorage()
): string[] {
  const resolvedStorage = getStorage(storage);
  if (!resolvedStorage) {
    return [];
  }

  const keysToClear = listStorageKeys(resolvedStorage).filter(matchesMachineLocalState);
  for (const key of keysToClear) {
    resolvedStorage.removeItem(key);
  }
  return keysToClear;
}

export function reconcileMachineLocalStateAfterRestore(
  restoreSummary: RestoreSummary | null | undefined,
  storage: StorageLike | null | undefined = getStorage()
): string[] {
  if (!restoreSummary) {
    return [];
  }

  const resolvedStorage = getStorage(storage);
  if (!resolvedStorage) {
    return [];
  }

  const token = buildRestoreToken(restoreSummary);
  if (resolvedStorage.getItem(MACHINE_LOCAL_STATE_RESTORE_TOKEN_KEY) === token) {
    return [];
  }

  const clearedKeys = clearMachineLocalState(resolvedStorage);
  resolvedStorage.setItem(MACHINE_LOCAL_STATE_RESTORE_TOKEN_KEY, token);
  return clearedKeys;
}
