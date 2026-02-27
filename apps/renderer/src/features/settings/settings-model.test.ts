import { describe, expect, it } from "vitest";

import {
  computeSettingsSectionDirtyState,
  hasDirtySections,
  validateSettingsDraft
} from "./settings-model";

describe("settings model", () => {
  it("validates Teams webhook and restore path requirements", () => {
    const validation = validateSettingsDraft(
      {
        startWithWindows: true,
        minimizeToTray: true,
        teamsEnabled: true,
        teamsWebhookUrl: "example-workflow"
      },
      {
        backupPath: "C:\\backups\\budgetit.db",
        manifestPath: ""
      }
    );

    expect(validation.notifications).toEqual([
      "Webhook URL must start with http:// or https://."
    ]);
    expect(validation.backupRestore).toEqual([
      "Provide both backup and manifest paths before restoring."
    ]);
  });

  it("tracks section dirty state by runtime and notifications groups", () => {
    const baseline = {
      startWithWindows: true,
      minimizeToTray: true,
      teamsEnabled: false,
      teamsWebhookUrl: ""
    };

    const runtimeChanged = computeSettingsSectionDirtyState(baseline, {
      ...baseline,
      startWithWindows: false
    });
    expect(runtimeChanged).toEqual({
      runtime: true,
      notifications: false
    });
    expect(hasDirtySections(runtimeChanged)).toBe(true);

    const notificationsChanged = computeSettingsSectionDirtyState(baseline, {
      ...baseline,
      teamsEnabled: true,
      teamsWebhookUrl: "https://contoso.example/webhook"
    });
    expect(notificationsChanged).toEqual({
      runtime: false,
      notifications: true
    });
  });
});
