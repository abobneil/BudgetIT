import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { readRuntimeSettings, writeRuntimeSettings } from "./settings-store";

const tempRoots: string[] = [];

function makeTempSettingsPath(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "budgetit-settings-"));
  tempRoots.push(root);
  return path.join(root, "runtime-settings.json");
}

describe("runtime settings persistence", () => {
  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("reads default settings when no settings file exists", () => {
    const settingsPath = makeTempSettingsPath();
    const settings = readRuntimeSettings(settingsPath);

    expect(settings.startWithWindows).toBe(true);
    expect(settings.minimizeToTray).toBe(true);
    expect(settings.teamsEnabled).toBe(false);
    expect(settings.teamsWebhookUrl).toBe("");
  });

  it("writes and reads updated startup settings", () => {
    const settingsPath = makeTempSettingsPath();
    writeRuntimeSettings(settingsPath, {
      startWithWindows: false,
      minimizeToTray: true,
      teamsEnabled: true,
      teamsWebhookUrl: "https://example.invalid/webhook"
    });

    const settings = readRuntimeSettings(settingsPath);
    expect(settings.startWithWindows).toBe(false);
    expect(settings.minimizeToTray).toBe(true);
    expect(settings.teamsEnabled).toBe(true);
    expect(settings.teamsWebhookUrl).toBe("https://example.invalid/webhook");
  });
});

