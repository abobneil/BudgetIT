import { describe, expect, it } from "vitest";

import {
  readStoredJson,
  resolveBrowserStorage,
  writeStoredJson
} from "./browserStorage";

class MemoryStorage {
  private data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

describe("browserStorage", () => {
  it("reads and writes JSON values through storage adapters", () => {
    const storage = new MemoryStorage();

    writeStoredJson(storage, "budgetit.test", {
      enabled: true,
      count: 2
    });

    expect(storage.getItem("budgetit.test")).toBe(JSON.stringify({ enabled: true, count: 2 }));
    expect(readStoredJson<{ enabled: boolean; count: number }>(storage, "budgetit.test")).toEqual(
      {
        enabled: true,
        count: 2
      }
    );
  });

  it("returns null for missing or invalid JSON values", () => {
    const storage = new MemoryStorage();

    expect(readStoredJson(storage, "budgetit.missing")).toBeNull();

    storage.setItem("budgetit.invalid", "{broken-json");
    expect(readStoredJson(storage, "budgetit.invalid")).toBeNull();
  });

  it("prefers an injected storage adapter when provided", () => {
    const storage = new MemoryStorage();

    expect(resolveBrowserStorage(storage)).toBe(storage);
  });
});
