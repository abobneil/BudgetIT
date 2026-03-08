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
  createScenario as createScenarioIpc,
  deleteScenario as deleteScenarioIpc,
  isIpcAvailable,
  listScenarios as listScenariosIpc,
  lockScenario as lockScenarioIpc
} from "../../lib/ipcClient";

import {
  DEFAULT_SCENARIO_STATE,
  getScenarioFallbackSelectionAfterDelete,
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
  createScenario: (name: string, parentScenarioId?: string | null) => Promise<void>;
  cloneScenario: (sourceScenarioId: string) => Promise<void>;
  deleteScenario: (scenarioId: string) => Promise<void>;
  promoteScenario: (scenarioId: string) => Promise<void>;
  lockScenario: (scenarioId: string) => Promise<void>;
};

const FALLBACK_VALUE: ScenarioContextValue = {
  scenarios: DEFAULT_SCENARIO_STATE.scenarios,
  selectedScenarioId: DEFAULT_SCENARIO_STATE.selectedScenarioId,
  selectedScenario:
    DEFAULT_SCENARIO_STATE.scenarios.find(
      (scenario) => scenario.id === DEFAULT_SCENARIO_STATE.selectedScenarioId
    ) ?? null,
  selectScenario: () => undefined,
  createScenario: async () => undefined,
  cloneScenario: async () => undefined,
  deleteScenario: async () => undefined,
  promoteScenario: async () => undefined,
  lockScenario: async () => undefined
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
      createScenario: async (name, parentScenarioId) => {
        if (hasIpc) {
          const created = await createScenarioIpc({
            name,
            parentScenarioId: parentScenarioId ?? null
          });
          await reloadFromIpc(created?.id ?? state.selectedScenarioId);
          return;
        }
        dispatch({ type: "create", name, parentScenarioId });
      },
      cloneScenario: async (sourceScenarioId) => {
        if (hasIpc) {
          const source = state.scenarios.find((entry) => entry.id === sourceScenarioId);
          const suggestedName = source ? `${source.name} Copy` : "Scenario Copy";
          const created = await cloneScenarioIpc({
            sourceScenarioId,
            newScenarioName: suggestedName
          });
          await reloadFromIpc(created?.id ?? sourceScenarioId);
          return;
        }
        dispatch({ type: "clone", sourceScenarioId });
      },
      deleteScenario: async (scenarioId) => {
        if (hasIpc) {
          const fallbackScenarioId = getScenarioFallbackSelectionAfterDelete(
            state.scenarios,
            scenarioId
          );
          await deleteScenarioIpc({ scenarioId });
          await reloadFromIpc(fallbackScenarioId);
          return;
        }
        dispatch({ type: "delete", scenarioId });
      },
      promoteScenario: async (scenarioId) => {
        if (hasIpc) {
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
          return;
        }
        dispatch({ type: "promote", scenarioId });
      },
      lockScenario: async (scenarioId) => {
        if (hasIpc) {
          await lockScenarioIpc({ scenarioId });
          await reloadFromIpc(scenarioId);
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
