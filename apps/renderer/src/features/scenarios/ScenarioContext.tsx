import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type PropsWithChildren
} from "react";

import {
  DEFAULT_SCENARIO_STATE,
  loadScenarioState,
  persistScenarioState,
  scenarioReducer,
  type ScenarioRecord
} from "./scenario-model";

type ScenarioContextValue = {
  scenarios: ScenarioRecord[];
  selectedScenarioId: string;
  selectedScenario: ScenarioRecord | null;
  selectScenario: (scenarioId: string) => void;
  cloneScenario: (sourceScenarioId: string) => void;
  promoteScenario: (scenarioId: string) => void;
  lockScenario: (scenarioId: string) => void;
};

const FALLBACK_VALUE: ScenarioContextValue = {
  scenarios: DEFAULT_SCENARIO_STATE.scenarios,
  selectedScenarioId: DEFAULT_SCENARIO_STATE.selectedScenarioId,
  selectedScenario:
    DEFAULT_SCENARIO_STATE.scenarios.find(
      (scenario) => scenario.id === DEFAULT_SCENARIO_STATE.selectedScenarioId
    ) ?? null,
  selectScenario: () => undefined,
  cloneScenario: () => undefined,
  promoteScenario: () => undefined,
  lockScenario: () => undefined
};

const ScenarioContext = createContext<ScenarioContextValue | null>(null);

export function ScenarioProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(scenarioReducer, undefined, () =>
    loadScenarioState()
  );

  useEffect(() => {
    persistScenarioState(state);
  }, [state]);

  const value = useMemo<ScenarioContextValue>(() => {
    const selectedScenario =
      state.scenarios.find((scenario) => scenario.id === state.selectedScenarioId) ?? null;

    return {
      scenarios: state.scenarios,
      selectedScenarioId: state.selectedScenarioId,
      selectedScenario,
      selectScenario: (scenarioId) => {
        dispatch({ type: "select", scenarioId });
      },
      cloneScenario: (sourceScenarioId) => {
        dispatch({ type: "clone", sourceScenarioId });
      },
      promoteScenario: (scenarioId) => {
        dispatch({ type: "promote", scenarioId });
      },
      lockScenario: (scenarioId) => {
        dispatch({ type: "lock", scenarioId });
      }
    };
  }, [state]);

  return <ScenarioContext.Provider value={value}>{children}</ScenarioContext.Provider>;
}

export function useScenarioContext(): ScenarioContextValue {
  return useContext(ScenarioContext) ?? FALLBACK_VALUE;
}
