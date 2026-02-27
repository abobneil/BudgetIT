import { describe, expect, it } from "vitest";

import {
  DEFAULT_REPORT_PRESETS,
  deserializeReportPreset,
  loadSavedReportPresets,
  saveReportPreset,
  serializeReportPreset,
  type ReportPreset
} from "./reports-config-model";

class MemoryStorage {
  private data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

describe("reports config model", () => {
  it("serializes and deserializes report presets and keeps defaults complete", () => {
    expect(DEFAULT_REPORT_PRESETS.length).toBeGreaterThanOrEqual(5);
    const serialized = serializeReportPreset(DEFAULT_REPORT_PRESETS[0]);
    const deserialized = deserializeReportPreset(serialized);
    expect(deserialized).toEqual(DEFAULT_REPORT_PRESETS[0]);
  });

  it("saves and reloads presets from storage with replace-on-id behavior", () => {
    const storage = new MemoryStorage();
    const preset: ReportPreset = {
      id: "custom-vendor",
      title: "Custom Vendor",
      description: "Custom saved preset",
      query: "spend.byVendor",
      visualizations: {
        table: true,
        chart: true,
        gauge: false,
        narrative: false
      }
    };
    saveReportPreset(preset, storage);

    const updatedPreset: ReportPreset = {
      ...preset,
      title: "Custom Vendor Updated",
      visualizations: {
        table: true,
        chart: false,
        gauge: true,
        narrative: false
      }
    };
    saveReportPreset(updatedPreset, storage);

    const loaded = loadSavedReportPresets(storage);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toEqual(updatedPreset);
  });
});
