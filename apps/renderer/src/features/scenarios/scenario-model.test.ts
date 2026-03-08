import { describe, expect, it } from "vitest";

import {
  DEFAULT_SCENARIO_STATE,
  getScenarioFallbackSelectionAfterDelete,
  getScenarioStorageKey,
  loadScenarioState,
  persistScenarioState,
  scenarioReducer,
  type ScenarioState
} from "./scenario-model";

class MemoryStorage {
  private data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

describe("scenario model", () => {
  it("supports clone/promote/lock transitions and selection updates", () => {
    const created = scenarioReducer(DEFAULT_SCENARIO_STATE, {
      type: "create",
      name: "New Scenario",
      parentScenarioId: "baseline",
      createdAt: "2026-01-25T00:00:00.000Z"
    });
    const newScenario = created.scenarios.find((scenario) => scenario.id === "scenario-new-scenario");
    expect(newScenario).toBeDefined();
    expect(newScenario?.parentScenarioId).toBe("baseline");
    expect(created.selectedScenarioId).toBe("scenario-new-scenario");

    const cloned = scenarioReducer(DEFAULT_SCENARIO_STATE, {
      type: "clone",
      sourceScenarioId: "baseline",
      createdAt: "2026-02-01T00:00:00.000Z"
    });
    const clone = cloned.scenarios.find((scenario) => scenario.id === "scenario-baseline-copy");
    expect(clone).toBeDefined();
    expect(cloned.selectedScenarioId).toBe("scenario-baseline-copy");
    expect(clone?.parentScenarioId).toBe("baseline");
    expect(clone?.status).toBe("draft");

    const promoted = scenarioReducer(cloned, {
      type: "promote",
      scenarioId: "scenario-baseline-copy"
    });
    expect(
      promoted.scenarios.find((scenario) => scenario.id === "scenario-baseline-copy")?.status
    ).toBe("reviewed");

    const locked = scenarioReducer(promoted, {
      type: "lock",
      scenarioId: "scenario-baseline-copy"
    });
    const lockedScenario = locked.scenarios.find(
      (scenario) => scenario.id === "scenario-baseline-copy"
    );
    expect(lockedScenario?.locked).toBe(true);

    const promotedLocked = scenarioReducer(locked, {
      type: "promote",
      scenarioId: "scenario-baseline-copy"
    });
    expect(
      promotedLocked.scenarios.find((scenario) => scenario.id === "scenario-baseline-copy")
        ?.status
    ).toBe("reviewed");

    const deleted = scenarioReducer(cloned, {
      type: "delete",
      scenarioId: "scenario-baseline-copy"
    });
    expect(
      deleted.scenarios.some((scenario) => scenario.id === "scenario-baseline-copy")
    ).toBe(false);
    expect(deleted.selectedScenarioId).toBe("baseline");
  });

  it("persists and reloads selected scenario, with fallback on invalid persisted state", () => {
    const storage = new MemoryStorage();
    const state: ScenarioState = {
      scenarios: DEFAULT_SCENARIO_STATE.scenarios,
      selectedScenarioId: "growth"
    };

    persistScenarioState(state, storage);
    expect(storage.getItem(getScenarioStorageKey())).toBe(
      JSON.stringify({ selectedScenarioId: "growth" })
    );

    const loaded = loadScenarioState(storage);
    expect(loaded.selectedScenarioId).toBe("growth");

    storage.setItem(
      getScenarioStorageKey(),
      JSON.stringify({
        selectedScenarioId: "missing"
      })
    );
    const fallbackLoaded = loadScenarioState(storage);
    expect(fallbackLoaded.selectedScenarioId).toBe("baseline");
  });

  it("prefers parent or a remaining scenario when choosing fallback selection after delete", () => {
    expect(
      getScenarioFallbackSelectionAfterDelete(DEFAULT_SCENARIO_STATE.scenarios, "growth")
    ).toBe("baseline");

    const scenarios: ScenarioState["scenarios"] = [
      ...DEFAULT_SCENARIO_STATE.scenarios,
      {
        id: "scenario-a",
        name: "Scenario A",
        status: "draft",
        locked: false,
        parentScenarioId: "baseline",
        createdAt: "2026-02-01T00:00:00.000Z"
      }
    ];

    expect(getScenarioFallbackSelectionAfterDelete(scenarios, "cost-cut")).toBe("baseline");
  });
});
