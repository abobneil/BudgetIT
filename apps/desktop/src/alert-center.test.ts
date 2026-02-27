import { describe, expect, it } from "vitest";

import { processAlertNotifications, type AlertStore } from "./alert-center";

const sampleEvent = {
  id: "event-1",
  scenarioId: "baseline",
  alertRuleId: "rule-1",
  entityType: "contract",
  entityId: "contract-99",
  fireAt: "2026-03-01",
  firedAt: null,
  status: "pending" as const,
  snoozedUntil: null,
  dedupeKey: "rule-1|notice_window|contract|contract-99|2026-03-01",
  message: "Contract notice deadline approaching",
  createdAt: "2026-02-01T00:00:00.000Z",
  updatedAt: "2026-02-01T00:00:00.000Z"
};

function createFakeStore() {
  const marked: Array<{ id: string; when: string }> = [];
  const store: AlertStore = {
    runSchedulerTick: () => undefined,
    list: () => [sampleEvent],
    acknowledge: () => sampleEvent,
    snooze: () => ({ ...sampleEvent, status: "snoozed", snoozedUntil: "2026-03-10" }),
    unsnooze: () => sampleEvent,
    listActionableForNotification: () => [sampleEvent],
    markNotified: (alertEventId, firedAtIsoDate) => {
      marked.push({ id: alertEventId, when: firedAtIsoDate });
    }
  };
  return { store, marked };
}

describe("alert notification processor", () => {
  it("marks actionable alerts as notified after dispatch", () => {
    const { store, marked } = createFakeStore();

    const published = processAlertNotifications(
      store,
      "2026-03-01",
      () => undefined,
      () => undefined
    );

    expect(published).toBe(1);
    expect(marked).toEqual([{ id: "event-1", when: "2026-03-01" }]);
  });

  it("uses notification click to deep-link to the target entity", () => {
    const { store } = createFakeStore();
    let navigatePayload: { alertEventId: string; entityType: string; entityId: string } | null =
      null;

    processAlertNotifications(
      store,
      "2026-03-01",
      (_event, onClick) => {
        onClick();
      },
      (payload) => {
        navigatePayload = payload;
      }
    );

    expect(navigatePayload).toEqual({
      alertEventId: "event-1",
      entityType: "contract",
      entityId: "contract-99"
    });
  });
});
