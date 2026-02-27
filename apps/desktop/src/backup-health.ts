import fs from "node:fs";
import path from "node:path";

export type BackupHealthStatus =
  | "backup_created"
  | "stale_backup"
  | "verify_success"
  | "verify_failed";

export type BackupHealthSeverity = "info" | "high";

export type BackupHealthEntry = {
  checkedAt: string;
  status: BackupHealthStatus;
  severity: BackupHealthSeverity;
  backupPath: string | null;
  manifestPath: string | null;
  detail: string | null;
};

export type BackupHealthState = {
  history: BackupHealthEntry[];
  latestBackupCreatedAt: string | null;
  latestBackupPath: string | null;
  latestManifestPath: string | null;
  lastVerifiedAt: string | null;
};

export function createEmptyBackupHealthState(): BackupHealthState {
  return {
    history: [],
    latestBackupCreatedAt: null,
    latestBackupPath: null,
    latestManifestPath: null,
    lastVerifiedAt: null
  };
}

function normalizeState(input: Partial<BackupHealthState>): BackupHealthState {
  return {
    history: Array.isArray(input.history) ? input.history : [],
    latestBackupCreatedAt:
      typeof input.latestBackupCreatedAt === "string" ? input.latestBackupCreatedAt : null,
    latestBackupPath: typeof input.latestBackupPath === "string" ? input.latestBackupPath : null,
    latestManifestPath:
      typeof input.latestManifestPath === "string" ? input.latestManifestPath : null,
    lastVerifiedAt: typeof input.lastVerifiedAt === "string" ? input.lastVerifiedAt : null
  };
}

function withHistoryEntry(state: BackupHealthState, entry: BackupHealthEntry): BackupHealthState {
  const history = [...state.history, entry].slice(-200);
  return {
    ...state,
    history
  };
}

export function loadBackupHealthState(filePath: string): BackupHealthState {
  if (!fs.existsSync(filePath)) {
    return createEmptyBackupHealthState();
  }
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Partial<BackupHealthState>;
  return normalizeState(parsed);
}

export function saveBackupHealthState(filePath: string, state: BackupHealthState): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export function recordBackupCreated(
  state: BackupHealthState,
  input: { checkedAt: string; backupPath: string; manifestPath: string }
): BackupHealthState {
  const next = withHistoryEntry(state, {
    checkedAt: input.checkedAt,
    status: "backup_created",
    severity: "info",
    backupPath: input.backupPath,
    manifestPath: input.manifestPath,
    detail: null
  });
  return {
    ...next,
    latestBackupCreatedAt: input.checkedAt,
    latestBackupPath: input.backupPath,
    latestManifestPath: input.manifestPath
  };
}

export function recordBackupVerificationSuccess(
  state: BackupHealthState,
  input: { checkedAt: string; backupPath: string; manifestPath: string }
): BackupHealthState {
  const next = withHistoryEntry(state, {
    checkedAt: input.checkedAt,
    status: "verify_success",
    severity: "info",
    backupPath: input.backupPath,
    manifestPath: input.manifestPath,
    detail: null
  });
  return {
    ...next,
    lastVerifiedAt: input.checkedAt
  };
}

export function recordBackupVerificationFailure(
  state: BackupHealthState,
  input: { checkedAt: string; backupPath: string | null; manifestPath: string | null; detail: string }
): BackupHealthState {
  return withHistoryEntry(state, {
    checkedAt: input.checkedAt,
    status: "verify_failed",
    severity: "high",
    backupPath: input.backupPath,
    manifestPath: input.manifestPath,
    detail: input.detail
  });
}

export function recordStaleBackupAlert(
  state: BackupHealthState,
  input: { checkedAt: string; detail: string }
): BackupHealthState {
  return withHistoryEntry(state, {
    checkedAt: input.checkedAt,
    status: "stale_backup",
    severity: "high",
    backupPath: state.latestBackupPath,
    manifestPath: state.latestManifestPath,
    detail: input.detail
  });
}

function toDateOnly(isoLike: string): string {
  return isoLike.slice(0, 10);
}

export function evaluateBackupFreshness(
  state: BackupHealthState,
  input: { nowIso: string; staleThresholdDays: number }
): { isStale: boolean; shouldAlert: boolean; detail: string } {
  if (!state.latestBackupCreatedAt) {
    const detail = "No backup has been created yet.";
    const alreadyAlertedToday = state.history.some(
      (entry) => entry.status === "stale_backup" && toDateOnly(entry.checkedAt) === toDateOnly(input.nowIso)
    );
    return {
      isStale: true,
      shouldAlert: !alreadyAlertedToday,
      detail
    };
  }

  const now = new Date(input.nowIso);
  const latest = new Date(state.latestBackupCreatedAt);
  const elapsedMs = Math.max(0, now.getTime() - latest.getTime());
  const elapsedDays = elapsedMs / (24 * 60 * 60 * 1000);
  const isStale = elapsedDays > input.staleThresholdDays;
  const detail = `Latest backup age is ${elapsedDays.toFixed(1)} days (threshold ${input.staleThresholdDays} days).`;

  const alreadyAlertedToday = state.history.some(
    (entry) => entry.status === "stale_backup" && toDateOnly(entry.checkedAt) === toDateOnly(input.nowIso)
  );
  return {
    isStale,
    shouldAlert: isStale && !alreadyAlertedToday,
    detail
  };
}
