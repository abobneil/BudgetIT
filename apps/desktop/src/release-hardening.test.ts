import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_RUNTIME_SETTINGS } from "./lifecycle";
import { readRuntimeSettings, writeRuntimeSettings } from "./settings-store";

const tempRoots: string[] = [];

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "budgetit-release-hardening-"));
  tempRoots.push(dir);
  return dir;
}

describe("release hardening runtime defaults", () => {
  afterEach(() => {
    for (const dir of tempRoots.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("uses startup and tray defaults in packaged runtime settings", () => {
    expect(DEFAULT_RUNTIME_SETTINGS.startWithWindows).toBe(true);
    expect(DEFAULT_RUNTIME_SETTINGS.minimizeToTray).toBe(true);
  });

  it("persists startup and tray overrides across restarts", () => {
    const dir = createTempDir();
    const settingsPath = path.join(dir, "runtime-settings.json");
    writeRuntimeSettings(settingsPath, {
      startWithWindows: false,
      minimizeToTray: false,
      teamsEnabled: true,
      teamsWebhookUrl: "https://example.test/webhook"
    });

    const restored = readRuntimeSettings(settingsPath);
    expect(restored.startWithWindows).toBe(false);
    expect(restored.minimizeToTray).toBe(false);
    expect(restored.teamsEnabled).toBe(true);
    expect(restored.teamsWebhookUrl).toBe("https://example.test/webhook");
  });
});
