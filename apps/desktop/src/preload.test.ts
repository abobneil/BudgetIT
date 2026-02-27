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

  it("forwards alert navigation events and supports unsubscribe", () => {
    let emitAlertNavigate: (payload: { alertEventId: string; entityType: string; entityId: string }) => void =
      () => undefined;
    let unsubscribeCalls = 0;

    const bridge = createBudgetItBridge(
      async () => "ok",
      (listener) => {
        emitAlertNavigate = listener;
        return () => {
          unsubscribeCalls += 1;
          emitAlertNavigate = () => undefined;
        };
      }
    );

    const seen: Array<{ alertEventId: string; entityType: string; entityId: string }> = [];
    const unsubscribe = bridge.onAlertNavigate((payload) => {
      seen.push(payload);
    });

    emitAlertNavigate({
      alertEventId: "event-1",
      entityType: "contract",
      entityId: "contract-4"
    });
    expect(seen).toEqual([
      {
        alertEventId: "event-1",
        entityType: "contract",
        entityId: "contract-4"
      }
    ]);

    unsubscribe();
    expect(unsubscribeCalls).toBe(1);
  });
});

