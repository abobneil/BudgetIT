import { describe, expect, it } from "vitest";

import type { AlertRecord } from "../../lib/ipcClient";
import {
  deriveAlertSeverity,
  filterAlertsByTab,
  groupAlertsByTimeBucket
} from "./alerts-model";

const fixtureAlerts: AlertRecord[] = [
  {
    id: "alert-1",
    entityType: "contract",
    entityId: "contract-1",
    fireAt: "2026-03-02",
    status: "pending",
    snoozedUntil: null,
    message: "Renewal due in 5 days"
  },
  {
    id: "alert-2",
    entityType: "contract",
    entityId: "contract-2",
    fireAt: "2026-03-20",
    status: "snoozed",
    snoozedUntil: "2026-03-10",
    message: "Notice window opens soon"
  },
  {
    id: "alert-3",
    entityType: "service",
    entityId: "service-3",
    fireAt: "2026-05-10",
    status: "acked",
    snoozedUntil: null,
    message: "[HIGH] Deadline reached for cancellation"
  }
];

describe("alerts model", () => {
  it("groups alerts into expected date buckets for triage", () => {
    const groups = groupAlertsByTimeBucket(
      fixtureAlerts,
      new Date("2026-03-01T00:00:00.000Z")
    );

    expect(groups.map((group) => group.bucket)).toEqual([
      "thisWeek",
      "next30Days",
      "later"
    ]);
    expect(groups[0].alerts.map((alert) => alert.id)).toEqual(["alert-1"]);
    expect(groups[1].alerts.map((alert) => alert.id)).toEqual(["alert-2"]);
    expect(groups[2].alerts.map((alert) => alert.id)).toEqual(["alert-3"]);
  });

  it("filters by tab status and maps severity consistently", () => {
    expect(filterAlertsByTab(fixtureAlerts, "dueSoon").map((alert) => alert.id)).toEqual([
      "alert-1"
    ]);
    expect(filterAlertsByTab(fixtureAlerts, "snoozed").map((alert) => alert.id)).toEqual([
      "alert-2"
    ]);
    expect(filterAlertsByTab(fixtureAlerts, "acked").map((alert) => alert.id)).toEqual([
      "alert-3"
    ]);
    expect(deriveAlertSeverity(fixtureAlerts[0])).toBe("medium");
    expect(deriveAlertSeverity(fixtureAlerts[2])).toBe("high");
  });
});
