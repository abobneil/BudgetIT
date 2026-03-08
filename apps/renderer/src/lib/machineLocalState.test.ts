import { describe, expect, it } from "vitest";

import {
  DASHBOARD_LAYOUT_STORAGE_KEY,
  MACHINE_LOCAL_STATE_DECISION_SUMMARY,
  MACHINE_LOCAL_STATE_POLICY,
  MACHINE_LOCAL_STATE_SUMMARY,
  QUICK_START_CHECKLIST_STORAGE_KEY,
  SAVED_REPORT_PRESETS_STORAGE_KEY,
  clearMachineLocalState,
  getNlqHistoryStorageKey,
  reconcileMachineLocalStateAfterRestore
} from "./machineLocalState";

class MemoryStorage {
  private data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null;
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }
}

describe("machine-local state reconciliation", () => {
  it("describes the machine-local state covered by restore reconciliation", () => {
    expect(MACHINE_LOCAL_STATE_SUMMARY).toBe(
      "dashboard layout, saved report presets, NLQ history, and quick-start checklist progress"
    );
    expect(MACHINE_LOCAL_STATE_DECISION_SUMMARY).toBe(
      "dashboard layout, saved report presets, NLQ history, and quick-start checklist progress are intentionally kept as machine-local UI state. They are excluded from encrypted backup coverage and cleared after restore to avoid stale UI state."
    );
  });

  it("captures the long-term machine-local policy for each reconciled state bucket", () => {
    expect(
      MACHINE_LOCAL_STATE_POLICY.map((entry) => ({
        id: entry.id,
        label: entry.label,
        scope: entry.scope,
        backupCoverage: entry.backupCoverage,
        restoreBehavior: entry.restoreBehavior
      }))
    ).toEqual([
      {
        id: "dashboard-layout",
        label: "dashboard layout",
        scope: "device",
        backupCoverage: "excluded",
        restoreBehavior: "clear-after-restore"
      },
      {
        id: "saved-report-presets",
        label: "saved report presets",
        scope: "device",
        backupCoverage: "excluded",
        restoreBehavior: "clear-after-restore"
      },
      {
        id: "nlq-history",
        label: "NLQ history",
        scope: "profile",
        backupCoverage: "excluded",
        restoreBehavior: "clear-after-restore"
      },
      {
        id: "quick-start-checklist",
        label: "quick-start checklist progress",
        scope: "device",
        backupCoverage: "excluded",
        restoreBehavior: "clear-after-restore"
      }
    ]);
    expect(MACHINE_LOCAL_STATE_POLICY.every((entry) => entry.rationale.length > 0)).toBe(true);
  });

  it("clears known machine-local state keys and prefixes", () => {
    const storage = new MemoryStorage();
    const nlqHistoryKey = getNlqHistoryStorageKey("default-profile");
    storage.setItem(DASHBOARD_LAYOUT_STORAGE_KEY, "layout");
    storage.setItem(SAVED_REPORT_PRESETS_STORAGE_KEY, "presets");
    storage.setItem(nlqHistoryKey, "history");
    storage.setItem(QUICK_START_CHECKLIST_STORAGE_KEY, "checklist");
    storage.setItem("budgetit.scenario-state.v1", "selected-scenario");

    const clearedKeys = clearMachineLocalState(storage);

    expect(clearedKeys.sort()).toEqual(
      [
        DASHBOARD_LAYOUT_STORAGE_KEY,
        QUICK_START_CHECKLIST_STORAGE_KEY,
        SAVED_REPORT_PRESETS_STORAGE_KEY,
        nlqHistoryKey
      ].sort()
    );
    expect(storage.getItem("budgetit.scenario-state.v1")).toBe("selected-scenario");
    expect(storage.getItem(DASHBOARD_LAYOUT_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(SAVED_REPORT_PRESETS_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(nlqHistoryKey)).toBeNull();
    expect(storage.getItem(QUICK_START_CHECKLIST_STORAGE_KEY)).toBeNull();
  });

  it("clears machine-local state once per restore token", () => {
    const storage = new MemoryStorage();
    const summary = {
      restoredAt: "2026-03-05T22:10:00.000Z",
      sourceLastMutationAt: "2026-03-05T21:55:00.000Z",
      schemaVersion: 9
    };
    storage.setItem(DASHBOARD_LAYOUT_STORAGE_KEY, "layout");

    const firstClearedKeys = reconcileMachineLocalStateAfterRestore(summary, storage);
    storage.setItem(DASHBOARD_LAYOUT_STORAGE_KEY, "layout-again");
    const secondClearedKeys = reconcileMachineLocalStateAfterRestore(summary, storage);
    const nextRestoreClearedKeys = reconcileMachineLocalStateAfterRestore(
      {
        ...summary,
        restoredAt: "2026-03-05T22:20:00.000Z"
      },
      storage
    );

    expect(firstClearedKeys).toEqual([DASHBOARD_LAYOUT_STORAGE_KEY]);
    expect(secondClearedKeys).toEqual([]);
    expect(nextRestoreClearedKeys).toEqual([DASHBOARD_LAYOUT_STORAGE_KEY]);
  });
});
