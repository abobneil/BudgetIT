import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createEmptyBackupHealthState,
  evaluateBackupFreshness,
  loadBackupHealthState,
  recordBackupCreated,
  recordBackupVerificationFailure,
  recordBackupVerificationSuccess
} from "./backup-health";

function createTempFilePath(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "budgetit-backup-health-"));
  tempRoots.push(root);
  return path.join(root, "backup-health.json");
}

const tempRoots: string[] = [];

describe("backup health monitoring", () => {
  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("triggers stale backup alert when age exceeds threshold", () => {
    const withBackup = recordBackupCreated(createEmptyBackupHealthState(), {
      checkedAt: "2026-03-01T00:00:00.000Z",
      backupPath: "C:/backups/one.db",
      manifestPath: "C:/backups/one.manifest.json"
    });

    const freshness = evaluateBackupFreshness(withBackup, {
      nowIso: "2026-03-20T00:00:00.000Z",
      staleThresholdDays: 7
    });

    expect(freshness.isStale).toBe(true);
    expect(freshness.shouldAlert).toBe(true);
  });

  it("records failed test-restore with high severity", () => {
    const failed = recordBackupVerificationFailure(createEmptyBackupHealthState(), {
      checkedAt: "2026-03-20T10:00:00.000Z",
      backupPath: "C:/backups/one.db",
      manifestPath: "C:/backups/one.manifest.json",
      detail: "integrity mismatch"
    });

    const latest = failed.history.at(-1);
    expect(latest?.status).toBe("verify_failed");
    expect(latest?.severity).toBe("high");
    expect(latest?.detail).toContain("integrity mismatch");
  });

  it("updates last_verified_at on successful verification", () => {
    const verified = recordBackupVerificationSuccess(createEmptyBackupHealthState(), {
      checkedAt: "2026-03-20T12:34:56.000Z",
      backupPath: "C:/backups/one.db",
      manifestPath: "C:/backups/one.manifest.json"
    });

    expect(verified.lastVerifiedAt).toBe("2026-03-20T12:34:56.000Z");
  });

  it("falls back to empty state when persisted JSON is corrupted", () => {
    const statePath = createTempFilePath();
    fs.writeFileSync(statePath, "{", "utf8");

    expect(loadBackupHealthState(statePath)).toEqual(createEmptyBackupHealthState());
  });
});
