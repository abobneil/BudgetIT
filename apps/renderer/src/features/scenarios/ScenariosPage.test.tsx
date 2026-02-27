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
    renderWorkspace("/dashboard");

    await waitFor(() => {
      expect(queryReportMock).toHaveBeenCalledWith({
        query: "dashboard.summary",
        scenarioId: "baseline"
      });
    });

    fireEvent.change(screen.getByLabelText("Scenario selector"), {
      target: { value: "growth" }
    });

    await waitFor(() => {
      expect(queryReportMock).toHaveBeenCalledWith({
        query: "dashboard.summary",
        scenarioId: "growth"
      });
    });

    const callsAfterDashboardUpdate = queryReportMock.mock.calls.length;
    fireEvent.click(screen.getByRole("link", { name: "Reports" }));

    await waitFor(() => {
      expect(queryReportMock.mock.calls.length).toBeGreaterThan(callsAfterDashboardUpdate);
    });
    expect(queryReportMock.mock.calls.at(-1)?.[0]).toMatchObject({
      scenarioId: "growth"
    });
    expect(screen.getByTestId("reports-scenario-context")).toHaveTextContent("Growth");
  });

  it("supports clone/promote/lock workflow and applies selected scenario context to dashboard", async () => {
    renderWorkspace("/scenarios");

    await screen.findByText("Scenarios Workspace");
    const baselineRow = await screen.findByTestId("scenario-row-baseline");

    fireEvent.click(within(baselineRow).getByRole("button", { name: "Clone" }));
    const cloneRow = await screen.findByTestId("scenario-row-scenario-baseline-copy");

    fireEvent.click(within(cloneRow).getByRole("button", { name: "Promote" }));
    expect(within(cloneRow).getByText("REVIEWED")).toBeInTheDocument();

    fireEvent.click(within(cloneRow).getByRole("button", { name: "Lock" }));
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
});
