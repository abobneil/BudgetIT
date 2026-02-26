import { describe, expect, it } from "vitest";

import { bootstrapDesktop } from "./main";

describe("desktop bootstrap", () => {
  it("runs app boot smoke behavior and creates initial window", async () => {
    let activateCallback: (() => void) | undefined;
    let windowsOpen = 0;
    let createWindowCalls = 0;

    await bootstrapDesktop({
      whenReady: async () => undefined,
      createWindow: () => {
        windowsOpen += 1;
        createWindowCalls += 1;
      },
      onActivate: (callback) => {
        activateCallback = callback;
      },
      onAllWindowsClosed: () => undefined,
      hasOpenWindows: () => windowsOpen > 0,
      quit: () => undefined,
      platform: "win32"
    });

    expect(createWindowCalls).toBe(1);
    expect(activateCallback).toBeTypeOf("function");

    if (activateCallback) {
      activateCallback();
      expect(createWindowCalls).toBe(1);

      windowsOpen = 0;
      activateCallback();
      expect(createWindowCalls).toBe(2);
    }
  });

  it("quits app when all windows are closed on non-macOS platforms", async () => {
    let allWindowsClosedCallback: (() => void) | undefined;
    let quitCalls = 0;

    await bootstrapDesktop({
      whenReady: async () => undefined,
      createWindow: () => undefined,
      onActivate: () => undefined,
      onAllWindowsClosed: (callback) => {
        allWindowsClosedCallback = callback;
      },
      hasOpenWindows: () => false,
      quit: () => {
        quitCalls += 1;
      },
      platform: "win32"
    });

    expect(allWindowsClosedCallback).toBeTypeOf("function");
    if (allWindowsClosedCallback) {
      allWindowsClosedCallback();
    }

    expect(quitCalls).toBe(1);
  });
});

