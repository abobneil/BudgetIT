/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { FluentProvider } from "@fluentui/react-components";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DashboardDataset } from "../../reporting";
import { AppShell } from "../../app/AppShell";
import { AppRoutes } from "../../app/routes";
import { exportReport, queryReport } from "../../lib/ipcClient";
import { budgetItLightTheme } from "../../ui/theme";
import { ScenarioProvider } from "./ScenarioContext";

vi.mock("../../lib/ipcClient", () => ({
  isIpcAvailable: vi.fn(() => false),
  listScenarios: vi.fn(),
  createScenario: vi.fn(),
  cloneScenario: vi.fn(),
  deleteScenario: vi.fn(),
  approveScenario: vi.fn(),
  lockScenario: vi.fn(),
  queryReport: vi.fn(),
  exportReport: vi.fn()
}));

const datasetFixture: DashboardDataset = {
  scenarioId: "baseline",
  staleForecast: false,
  spendTrend: [{ month: "2026-01", forecastMinor: 10000, actualMinor: 9800 }],
  variance: [
    {
      month: "2026-01",
      forecastMinor: 10000,
      actualMinor: 9800,
      varianceMinor: -200,
      unmatchedActualMinor: 0,
      unmatchedCount: 0
    }
  ],
  renewals: [{ month: "2026-06", count: 1 }],
  growth: [{ month: "2026-01", forecastMinor: 10000, growthPct: null }],
  taggingCompleteness: {
    totalExpenseLines: 10,
    taggedExpenseLines: 9,
    completenessRatio: 0.9
  },
  replacementStatus: {
    totalPlans: 2,
    replacementRequiredOpen: 1,
    byStatus: [{ status: "draft", count: 2 }]
  },
  narrativeBlocks: [{ id: "summary", title: "Summary", body: "Context fixture" }]
};

const queryReportMock = vi.mocked(queryReport);
const exportReportMock = vi.mocked(exportReport);

function renderWorkspace(initialPath: string) {
  return render(
    <ScenarioProvider>
      <FluentProvider theme={budgetItLightTheme}>
        <MemoryRouter initialEntries={[initialPath]}>
          <AppShell>
            <AppRoutes />
          </AppShell>
        </MemoryRouter>
      </FluentProvider>
    </ScenarioProvider>
  );
}

describe("Scenarios and global scenario context", () => {
  beforeEach(() => {
    localStorage.clear();
    queryReportMock.mockReset();
    exportReportMock.mockReset();
    queryReportMock.mockImplementation(async (payload) => {
      const input = payload as { scenarioId?: string };
      return {
        ...datasetFixture,
        scenarioId: input.scenarioId ?? "baseline"
      };
    });
    exportReportMock.mockResolvedValue({ files: {} });
  });

  afterEach(() => {
    cleanup();
  });

  it("updates dashboard and reports queries when the global scenario selector changes", async () => {
    renderWorkspace("/scenarios");

    await screen.findByText("Scenarios Workspace");
    fireEvent.change(screen.getByLabelText("New scenario name"), {
      target: { value: "Growth" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Scenario" }));
    await screen.findByTestId("scenario-row-scenario-growth");

    fireEvent.click(screen.getByRole("link", { name: "Dashboard" }));

    fireEvent.change(screen.getByLabelText("Scenario selector"), {
      target: { value: "baseline" }
    });

    await waitFor(() => {
      expect(queryReportMock).toHaveBeenCalledWith({
        query: "dashboard.summary",
        scenarioId: "baseline"
      });
    });

    fireEvent.change(screen.getByLabelText("Scenario selector"), {
      target: { value: "scenario-growth" }
    });

    await waitFor(() => {
      expect(queryReportMock).toHaveBeenCalledWith({
        query: "dashboard.summary",
        scenarioId: "scenario-growth"
      });
    });

    const callsAfterDashboardUpdate = queryReportMock.mock.calls.length;
    fireEvent.click(screen.getByRole("link", { name: "Reports" }));

    await waitFor(() => {
      expect(queryReportMock.mock.calls.length).toBeGreaterThan(callsAfterDashboardUpdate);
    });
    expect(queryReportMock.mock.calls.at(-1)?.[0]).toMatchObject({
      scenarioId: "scenario-growth"
    });
    expect(screen.getByTestId("reports-scenario-context")).toHaveTextContent("Growth");
  });

  it("supports clone/promote/lock workflow and applies selected scenario context to dashboard", async () => {
    renderWorkspace("/scenarios");

    await screen.findByText("Scenarios Workspace");
    const baselineRow = await screen.findByTestId("scenario-row-baseline");

    fireEvent.click(within(baselineRow).getByRole("button", { name: "More" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Clone" }));
    const cloneRow = await screen.findByTestId("scenario-row-scenario-baseline-copy");

    fireEvent.click(within(cloneRow).getByRole("button", { name: "More" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Promote" }));
    expect(within(cloneRow).getByText("Reviewed")).toBeInTheDocument();

    fireEvent.click(within(cloneRow).getByRole("button", { name: "More" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Lock" }));
    expect(within(cloneRow).getByText("Locked")).toBeInTheDocument();

    fireEvent.click(within(cloneRow).getByRole("button", { name: "Select" }));
    expect(screen.getByTestId("selected-scenario-summary")).toHaveTextContent("Baseline Copy");

    const selector = screen.getByLabelText("Scenario selector") as HTMLSelectElement;
    expect(selector.value).toBe("scenario-baseline-copy");

    fireEvent.click(screen.getByRole("link", { name: "Dashboard" }));
    await waitFor(() => {
      expect(queryReportMock).toHaveBeenCalledWith({
        query: "dashboard.summary",
        scenarioId: "scenario-baseline-copy"
      });
    });
    expect(screen.getByTestId("dashboard-scenario-context")).toHaveTextContent(
      "Scenario: Baseline Copy"
    );
  });

  it("supports creating and deleting scenarios from the workspace", async () => {
    renderWorkspace("/scenarios");

    await screen.findByText("Scenarios Workspace");

    fireEvent.change(screen.getByLabelText("New scenario name"), {
      target: { value: "FY27 Replan" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Scenario" }));

    const createdRow = await screen.findByTestId("scenario-row-scenario-fy27-replan");
    expect(createdRow).toBeInTheDocument();
    expect(screen.getByTestId("selected-scenario-summary")).toHaveTextContent("FY27 Replan");

    fireEvent.click(within(createdRow).getByRole("button", { name: "More" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);

    await waitFor(() => {
      expect(screen.queryByTestId("scenario-row-scenario-fy27-replan")).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("selected-scenario-summary")).toHaveTextContent("Baseline");
  });
});
