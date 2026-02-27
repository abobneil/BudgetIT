import { describe, expect, it } from "vitest";

import {
  DEFAULT_SCENARIO_STATE,
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
  });

  it("persists and reloads selected scenario, with fallback on invalid persisted state", () => {
    const storage = new MemoryStorage();
    const state: ScenarioState = {
      scenarios: DEFAULT_SCENARIO_STATE.scenarios,
      selectedScenarioId: "growth"
    };

    persistScenarioState(state, storage);
    expect(storage.getItem(getScenarioStorageKey())).toContain("\"selectedScenarioId\":\"growth\"");

    const loaded = loadScenarioState(storage);
    expect(loaded.selectedScenarioId).toBe("growth");

    storage.setItem(
      getScenarioStorageKey(),
      JSON.stringify({
        scenarios: DEFAULT_SCENARIO_STATE.scenarios,
        selectedScenarioId: "missing"
      })
    );
    const fallbackLoaded = loadScenarioState(storage);
    expect(fallbackLoaded.selectedScenarioId).toBe("baseline");
  });
});
