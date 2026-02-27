import { describe, expect, it } from "vitest";

import {
  createEmptyBackupHealthState,
  evaluateBackupFreshness,
  recordBackupCreated,
  recordBackupVerificationFailure,
  recordBackupVerificationSuccess
} from "./backup-health";

describe("backup health monitoring", () => {
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
});
