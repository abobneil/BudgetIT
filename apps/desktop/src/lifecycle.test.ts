import { describe, expect, it, vi } from "vitest";

import {
  buildLoginItemSettings,
  createExitHandler,
  DEFAULT_RUNTIME_SETTINGS,
  mergeRuntimeSettings,
  shouldMinimizeToTrayOnClose,
  shouldStartHiddenToTray,
  WINDOWS_STARTUP_MARKER_ARG
} from "./lifecycle";

describe("runtime lifecycle helpers", () => {
  it("keeps app running in tray when close-to-tray is enabled", () => {
    expect(shouldMinimizeToTrayOnClose(DEFAULT_RUNTIME_SETTINGS, false)).toBe(true);
  });

  it("persists startup preference through merged settings updates", () => {
    const updated = mergeRuntimeSettings(DEFAULT_RUNTIME_SETTINGS, {
      startWithWindows: false,
      teamsEnabled: true,
      teamsWebhookUrl: "https://example.invalid/webhook"
    });
    expect(updated.startWithWindows).toBe(false);
    expect(updated.minimizeToTray).toBe(true);
    expect(updated.teamsEnabled).toBe(true);
    expect(updated.teamsWebhookUrl).toBe("https://example.invalid/webhook");
  });

  it("stops scheduler and quits app when explicit exit is requested", () => {
    const stopScheduler = vi.fn();
    const quitApp = vi.fn();

    const exit = createExitHandler(stopScheduler, quitApp);
    exit();

    expect(stopScheduler).toHaveBeenCalledTimes(1);
    expect(quitApp).toHaveBeenCalledTimes(1);
  });

  it("builds Windows login item settings with startup marker arguments", () => {
    expect(buildLoginItemSettings(true, "win32")).toEqual({
      openAtLogin: true,
      args: [WINDOWS_STARTUP_MARKER_ARG]
    });
    expect(buildLoginItemSettings(false, "win32")).toEqual({
      openAtLogin: false,
      args: []
    });
  });

  it("builds non-Windows login item settings without startup marker arguments", () => {
    expect(buildLoginItemSettings(true, "linux")).toEqual({
      openAtLogin: true
    });
    expect(buildLoginItemSettings(false, "darwin")).toEqual({
      openAtLogin: false
    });
  });

  it("starts hidden to tray only for Windows auto-start marker launches", () => {
    const startupArgs = ["BudgetIT.exe", WINDOWS_STARTUP_MARKER_ARG];
    expect(
      shouldStartHiddenToTray(DEFAULT_RUNTIME_SETTINGS, "win32", startupArgs)
    ).toBe(true);
    expect(
      shouldStartHiddenToTray(DEFAULT_RUNTIME_SETTINGS, "linux", startupArgs)
    ).toBe(false);
    expect(
      shouldStartHiddenToTray(
        { ...DEFAULT_RUNTIME_SETTINGS, startWithWindows: false },
        "win32",
        startupArgs
      )
    ).toBe(false);
    expect(
      shouldStartHiddenToTray(DEFAULT_RUNTIME_SETTINGS, "win32", ["BudgetIT.exe"])
    ).toBe(false);
  });
});

