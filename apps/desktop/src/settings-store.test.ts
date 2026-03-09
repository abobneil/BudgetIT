import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { FileSecretVault, type SecretCipher } from "./key-vault";
import {
  hasPlaintextRuntimeSettingsSecrets,
  readRuntimeSettings,
  writeRuntimeSettings
} from "./settings-store";

const tempRoots: string[] = [];

function makeTempSettingsPath(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "budgetit-settings-"));
  tempRoots.push(root);
  return path.join(root, "runtime-settings.json");
}

function createFakeCipher(): SecretCipher {
  return {
    isAvailable: () => true,
    encrypt: (value) => Buffer.from(`enc:${value}`, "utf8"),
    decrypt: (value) => value.toString("utf8").replace(/^enc:/, "")
  };
}

function createWebhookVault(settingsPath: string): FileSecretVault {
  return new FileSecretVault(path.join(path.dirname(settingsPath), "teams-webhook-url.json"), createFakeCipher());
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

  it("falls back to defaults when settings JSON is corrupted", () => {
    const settingsPath = makeTempSettingsPath();
    fs.writeFileSync(settingsPath, "{not valid json", "utf8");

    const settings = readRuntimeSettings(settingsPath);
    expect(settings).toEqual({
      startWithWindows: true,
      minimizeToTray: true,
      teamsEnabled: false,
      teamsWebhookUrl: ""
    });
  });

  it("stores teams webhook URLs in secure storage instead of the settings JSON", () => {
    const settingsPath = makeTempSettingsPath();
    const webhookVault = createWebhookVault(settingsPath);

    writeRuntimeSettings(
      settingsPath,
      {
        startWithWindows: false,
        minimizeToTray: true,
        teamsEnabled: true,
        teamsWebhookUrl: " https://example.invalid/webhook "
      },
      webhookVault
    );

    const persisted = JSON.parse(fs.readFileSync(settingsPath, "utf8")) as {
      teamsWebhookUrl: string;
    };
    expect(persisted.teamsWebhookUrl).toBe("");
    expect(webhookVault.readSecret()).toBe("https://example.invalid/webhook");

    const restored = readRuntimeSettings(settingsPath, webhookVault);
    expect(restored.teamsWebhookUrl).toBe("https://example.invalid/webhook");
  });

  it("migrates legacy plaintext webhook settings into secure storage", () => {
    const settingsPath = makeTempSettingsPath();
    const webhookVault = createWebhookVault(settingsPath);
    fs.writeFileSync(
      settingsPath,
      JSON.stringify(
        {
          startWithWindows: true,
          minimizeToTray: true,
          teamsEnabled: true,
          teamsWebhookUrl: "https://example.invalid/webhook"
        },
        null,
        2
      ),
      "utf8"
    );

    expect(hasPlaintextRuntimeSettingsSecrets(settingsPath)).toBe(true);
    const restored = readRuntimeSettings(settingsPath, webhookVault);
    writeRuntimeSettings(settingsPath, restored, webhookVault);

    expect(hasPlaintextRuntimeSettingsSecrets(settingsPath)).toBe(false);
    expect(webhookVault.readSecret()).toBe("https://example.invalid/webhook");
  });

  it("deletes stored teams webhook secrets when the URL is cleared", () => {
    const settingsPath = makeTempSettingsPath();
    const webhookVault = createWebhookVault(settingsPath);
    writeRuntimeSettings(
      settingsPath,
      {
        startWithWindows: true,
        minimizeToTray: true,
        teamsEnabled: true,
        teamsWebhookUrl: "https://example.invalid/webhook"
      },
      webhookVault
    );

    writeRuntimeSettings(
      settingsPath,
      {
        startWithWindows: true,
        minimizeToTray: true,
        teamsEnabled: false,
        teamsWebhookUrl: ""
      },
      webhookVault
    );

    expect(webhookVault.readSecret()).toBeNull();
    expect(readRuntimeSettings(settingsPath, webhookVault).teamsWebhookUrl).toBe("");
  });
});

