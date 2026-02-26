import { describe, expect, it, vi } from "vitest";

import {
  createExitHandler,
  DEFAULT_RUNTIME_SETTINGS,
  mergeRuntimeSettings,
  shouldMinimizeToTrayOnClose
} from "./lifecycle";

describe("runtime lifecycle helpers", () => {
  it("keeps app running in tray when close-to-tray is enabled", () => {
    expect(shouldMinimizeToTrayOnClose(DEFAULT_RUNTIME_SETTINGS, false)).toBe(true);
  });

  it("persists startup preference through merged settings updates", () => {
    const updated = mergeRuntimeSettings(DEFAULT_RUNTIME_SETTINGS, {
      startWithWindows: false
    });
    expect(updated.startWithWindows).toBe(false);
    expect(updated.minimizeToTray).toBe(true);
  });

  it("stops scheduler and quits app when explicit exit is requested", () => {
    const stopScheduler = vi.fn();
    const quitApp = vi.fn();

    const exit = createExitHandler(stopScheduler, quitApp);
    exit();

    expect(stopScheduler).toHaveBeenCalledTimes(1);
    expect(quitApp).toHaveBeenCalledTimes(1);
  });
});

