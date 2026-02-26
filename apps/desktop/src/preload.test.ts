import { describe, expect, it } from "vitest";

import { createBudgetItBridge } from "./preload";

describe("preload IPC bridge", () => {
  it("allows approved channels and rejects unknown channels", async () => {
    const bridge = createBudgetItBridge(async () => "ok");

    await expect(bridge.invoke("settings.get")).resolves.toBe("ok");
    await expect(bridge.invoke("settings.deleteEverything")).rejects.toThrow(
      "Unauthorized IPC channel: settings.deleteEverything"
    );
  });
});

