import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type PropsWithChildren
} from "react";
import {
  approveScenario as approveScenarioIpc,
  cloneScenario as cloneScenarioIpc,
  isIpcAvailable,
  listScenarios as listScenariosIpc,
  lockScenario as lockScenarioIpc
} from "../../lib/ipcClient";

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
  const hasIpc = isIpcAvailable();

  const reloadFromIpc = useCallback(async (preferredScenarioId?: string) => {
    if (!hasIpc) {
      return;
    }
    const scenarios = await listScenariosIpc();
    const mappedState = {
      selectedScenarioId:
        preferredScenarioId && scenarios.some((entry) => entry.id === preferredScenarioId)
          ? preferredScenarioId
          : scenarios[0]?.id ?? DEFAULT_SCENARIO_STATE.selectedScenarioId,
      scenarios: scenarios.map((entry) => ({
        id: entry.id,
        name: entry.name,
        status: entry.approvalStatus,
        locked: entry.isLocked,
        parentScenarioId: entry.parentScenarioId,
        createdAt: entry.createdAt
      }))
    };
    dispatch({ type: "replace", state: mappedState });
  }, [hasIpc]);

  useEffect(() => {
    if (!hasIpc) {
      return;
    }
    void reloadFromIpc(state.selectedScenarioId);
  }, [hasIpc, reloadFromIpc, state.selectedScenarioId]);

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
        if (hasIpc) {
          const source = state.scenarios.find((entry) => entry.id === sourceScenarioId);
          const suggestedName = source ? `${source.name} Copy` : "Scenario Copy";
          void (async () => {
            const created = await cloneScenarioIpc({
              sourceScenarioId,
              newScenarioName: suggestedName
            });
            await reloadFromIpc(created?.id ?? sourceScenarioId);
          })();
          return;
        }
        dispatch({ type: "clone", sourceScenarioId });
      },
      promoteScenario: (scenarioId) => {
        if (hasIpc) {
          void (async () => {
            const current = state.scenarios.find((entry) => entry.id === scenarioId);
            if (!current || current.locked) {
              return;
            }
            const nextStatus =
              current.status === "draft"
                ? "reviewed"
                : current.status === "reviewed"
                  ? "approved"
                  : "approved";
            await approveScenarioIpc({ scenarioId, nextStatus });
            await reloadFromIpc(scenarioId);
          })();
          return;
        }
        dispatch({ type: "promote", scenarioId });
      },
      lockScenario: (scenarioId) => {
        if (hasIpc) {
          void (async () => {
            await lockScenarioIpc({ scenarioId });
            await reloadFromIpc(scenarioId);
          })();
          return;
        }
        dispatch({ type: "lock", scenarioId });
      }
    };
  }, [hasIpc, reloadFromIpc, state]);

  return <ScenarioContext.Provider value={value}>{children}</ScenarioContext.Provider>;
}

export function useScenarioContext(): ScenarioContextValue {
  return useContext(ScenarioContext) ?? FALLBACK_VALUE;
}
