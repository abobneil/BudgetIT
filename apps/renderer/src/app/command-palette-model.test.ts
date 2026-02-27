import { describe, expect, it } from "vitest";

import {
  COMMAND_REGISTRY,
  KEYBOARD_SHORTCUT_MAP,
  resolvePaletteCommands
} from "./command-palette-model";

describe("command palette model", () => {
  it("resolves commands by label and keyword relevance", () => {
    const backupMatches = resolvePaletteCommands("backup");
    expect(backupMatches[0]?.id).toBe("action-backup-now");

    const vendorMatches = resolvePaletteCommands("vendors");
    expect(vendorMatches.some((entry) => entry.id === "route-vendors")).toBe(true);
  });

  it("covers required action commands and keyboard shortcut map", () => {
    const actionIds = COMMAND_REGISTRY
      .map((entry) => (entry.intent.kind === "action" ? entry.intent.actionId : null))
      .filter((actionId): actionId is NonNullable<typeof actionId> => actionId !== null);
    expect(actionIds).toEqual(
      expect.arrayContaining([
        "new-expense",
        "run-import",
        "open-alerts",
        "backup-now"
      ])
    );
    expect(KEYBOARD_SHORTCUT_MAP.openPalette).toBe("Ctrl+K");
    expect(KEYBOARD_SHORTCUT_MAP.focusGlobalSearch).toBe("Ctrl+Shift+F");
  });
});
