export type ScenarioStatus = "draft" | "reviewed" | "approved";

export type ScenarioRecord = {
  id: string;
  name: string;
  status: ScenarioStatus;
  locked: boolean;
  parentScenarioId: string | null;
  createdAt: string;
};

export type ScenarioState = {
  selectedScenarioId: string;
  scenarios: ScenarioRecord[];
};

export type ScenarioAction =
  | { type: "select"; scenarioId: string }
  | { type: "clone"; sourceScenarioId: string; createdAt?: string }
  | { type: "promote"; scenarioId: string }
  | { type: "lock"; scenarioId: string }
  | { type: "replace"; state: ScenarioState };

const SCENARIO_STORAGE_KEY = "budgetit.scenario-state.v1";

export const DEFAULT_SCENARIOS: ScenarioRecord[] = [
  {
    id: "baseline",
    name: "Baseline",
    status: "approved",
    locked: false,
    parentScenarioId: null,
    createdAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "cost-cut",
    name: "Cost Cut",
    status: "draft",
    locked: false,
    parentScenarioId: "baseline",
    createdAt: "2026-01-15T00:00:00.000Z"
  },
  {
    id: "growth",
    name: "Growth",
    status: "reviewed",
    locked: false,
    parentScenarioId: "baseline",
    createdAt: "2026-01-20T00:00:00.000Z"
  }
];

export const DEFAULT_SCENARIO_STATE: ScenarioState = {
  selectedScenarioId: "baseline",
  scenarios: DEFAULT_SCENARIOS
};

export function scenarioReducer(
  state: ScenarioState,
  action: ScenarioAction
): ScenarioState {
  if (action.type === "replace") {
    return normalizeScenarioState(action.state);
  }

  if (action.type === "select") {
    const exists = state.scenarios.some((scenario) => scenario.id === action.scenarioId);
    if (!exists) {
      return state;
    }
    return {
      ...state,
      selectedScenarioId: action.scenarioId
    };
  }

  if (action.type === "clone") {
    const source = state.scenarios.find(
      (scenario) => scenario.id === action.sourceScenarioId
    );
    if (!source) {
      return state;
    }

    const cloneNameBase = `${source.name} Copy`;
    const cloneName = nextCloneName(cloneNameBase, state.scenarios);
    const cloneId = nextScenarioId(cloneName, state.scenarios);
    const createdAt = action.createdAt ?? new Date().toISOString();

    const clone: ScenarioRecord = {
      id: cloneId,
      name: cloneName,
      status: "draft",
      locked: false,
      parentScenarioId: source.id,
      createdAt
    };

    return {
      scenarios: [...state.scenarios, clone],
      selectedScenarioId: clone.id
    };
  }

  if (action.type === "promote") {
    return {
      ...state,
      scenarios: state.scenarios.map((scenario) => {
        if (scenario.id !== action.scenarioId || scenario.locked) {
          return scenario;
        }
        if (scenario.status === "draft") {
          return { ...scenario, status: "reviewed" };
        }
        if (scenario.status === "reviewed") {
          return { ...scenario, status: "approved" };
        }
        return scenario;
      })
    };
  }

  return {
    ...state,
    scenarios: state.scenarios.map((scenario) =>
      scenario.id === action.scenarioId ? { ...scenario, locked: true } : scenario
    )
  };
}

export function normalizeScenarioState(input: ScenarioState): ScenarioState {
  const scenarios = input.scenarios.filter(isScenarioRecord);
  if (scenarios.length === 0) {
    return DEFAULT_SCENARIO_STATE;
  }
  const selectedExists = scenarios.some(
    (scenario) => scenario.id === input.selectedScenarioId
  );
  return {
    scenarios,
    selectedScenarioId: selectedExists ? input.selectedScenarioId : scenarios[0].id
  };
}

export function loadScenarioState(
  storage: Pick<Storage, "getItem"> | null | undefined = getStorage()
): ScenarioState {
  if (!storage) {
    return DEFAULT_SCENARIO_STATE;
  }
  const raw = storage.getItem(SCENARIO_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_SCENARIO_STATE;
  }

  try {
    const parsed = JSON.parse(raw) as ScenarioState;
    return normalizeScenarioState(parsed);
  } catch {
    return DEFAULT_SCENARIO_STATE;
  }
}

export function persistScenarioState(
  state: ScenarioState,
  storage: Pick<Storage, "setItem"> | null | undefined = getStorage()
): void {
  if (!storage) {
    return;
  }
  storage.setItem(SCENARIO_STORAGE_KEY, JSON.stringify(state));
}

export function getScenarioStorageKey(): string {
  return SCENARIO_STORAGE_KEY;
}

export function compareScenarioToBaseline(
  state: ScenarioState,
  scenarioId: string
): string {
  const baseline = state.scenarios.find((scenario) => scenario.id === "baseline");
  const target = state.scenarios.find((scenario) => scenario.id === scenarioId);
  if (!baseline || !target) {
    return "Comparison unavailable.";
  }

  const statusText =
    baseline.status === target.status
      ? "status matches baseline"
      : `status ${target.status} vs baseline ${baseline.status}`;
  const lockText =
    baseline.locked === target.locked
      ? "lock state matches baseline"
      : target.locked
        ? "target is locked while baseline is open"
        : "target is open while baseline is locked";

  return `${target.name}: ${statusText}; ${lockText}.`;
}

function getStorage(): Storage | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }
  return window.localStorage;
}

function nextCloneName(baseName: string, scenarios: ScenarioRecord[]): string {
  const usedNames = new Set(scenarios.map((scenario) => scenario.name));
  if (!usedNames.has(baseName)) {
    return baseName;
  }
  let index = 2;
  while (usedNames.has(`${baseName} ${index}`)) {
    index += 1;
  }
  return `${baseName} ${index}`;
}

function nextScenarioId(name: string, scenarios: ScenarioRecord[]): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const usedIds = new Set(scenarios.map((scenario) => scenario.id));
  const baseId = `scenario-${slug}`;
  if (!usedIds.has(baseId)) {
    return baseId;
  }
  let index = 2;
  while (usedIds.has(`${baseId}-${index}`)) {
    index += 1;
  }
  return `${baseId}-${index}`;
}

function isScenarioStatus(value: string): value is ScenarioStatus {
  return value === "draft" || value === "reviewed" || value === "approved";
}

function isScenarioRecord(value: unknown): value is ScenarioRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const input = value as Record<string, unknown>;
  return (
    typeof input.id === "string" &&
    typeof input.name === "string" &&
    typeof input.locked === "boolean" &&
    (input.parentScenarioId === null || typeof input.parentScenarioId === "string") &&
    typeof input.createdAt === "string" &&
    typeof input.status === "string" &&
    isScenarioStatus(input.status)
  );
}
