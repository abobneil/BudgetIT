import { describe, expect, it } from "vitest";

import { assertAllowedInvokeChannel, isAllowedInvokeChannel } from "./ipc";

describe("IPC channel allowlist", () => {
  it("accepts configured channels", () => {
    expect(isAllowedInvokeChannel("settings.get")).toBe(true);
    expect(() => assertAllowedInvokeChannel("settings.get")).not.toThrow();
  });

  it("rejects unauthorized channels", () => {
    expect(isAllowedInvokeChannel("settings.deleteEverything")).toBe(false);
    expect(() => assertAllowedInvokeChannel("settings.deleteEverything")).toThrow(
      "Unauthorized IPC channel: settings.deleteEverything"
    );
  });
});

