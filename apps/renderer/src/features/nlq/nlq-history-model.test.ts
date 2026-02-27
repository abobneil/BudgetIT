import { describe, expect, it } from "vitest";

import {
  addNlqHistoryEntry,
  loadNlqHistory,
  persistNlqHistory,
  type NlqHistoryEntry
} from "./nlq-history-model";

class MemoryStorage {
  private data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

describe("nlq history model", () => {
  it("collapses duplicate queries and increments run counts", () => {
    const first = addNlqHistoryEntry([], "Spend by vendor", "2026-02-27T10:00:00.000Z");
    const second = addNlqHistoryEntry(
      first,
      "spend by vendor",
      "2026-02-27T10:05:00.000Z"
    );
    expect(second).toHaveLength(1);
    expect(second[0].runCount).toBe(2);
    expect(second[0].lastRunAt).toBe("2026-02-27T10:05:00.000Z");
  });

  it("persists and reloads history by profile id", () => {
    const storage = new MemoryStorage();
    const history: NlqHistoryEntry[] = [
      {
        query: "renewals in next 90 days",
        lastRunAt: "2026-02-27T10:10:00.000Z",
        runCount: 1
      }
    ];

    persistNlqHistory("default-profile", history, storage);
    expect(loadNlqHistory("default-profile", storage)).toEqual(history);
  });
});
