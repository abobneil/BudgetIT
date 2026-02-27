/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { FluentProvider } from "@fluentui/react-components";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DashboardDataset } from "../../reporting";
import { AppShell } from "../../app/AppShell";
import { AppRoutes } from "../../app/routes";
import { exportReport, queryReport } from "../../lib/ipcClient";
import { budgetItLightTheme } from "../../ui/theme";
import { DashboardPage } from "./DashboardPage";

vi.mock("../../lib/ipcClient", () => ({
  queryReport: vi.fn(),
  exportReport: vi.fn()
}));

const datasetFixture: DashboardDataset = {
  scenarioId: "baseline",
  staleForecast: true,
  spendTrend: [
    { month: "2026-01", forecastMinor: 12000, actualMinor: 10000 },
    { month: "2026-02", forecastMinor: 14000, actualMinor: 15000 }
  ],
  variance: [
    {
      month: "2026-01",
      forecastMinor: 12000,
      actualMinor: 10000,
      varianceMinor: -2000,
      unmatchedActualMinor: 0,
      unmatchedCount: 0
    },
    {
      month: "2026-02",
      forecastMinor: 14000,
      actualMinor: 15000,
      varianceMinor: 1000,
      unmatchedActualMinor: 1000,
      unmatchedCount: 1
    }
  ],
  renewals: [{ month: "2026-06", count: 2 }],
  growth: [
    { month: "2026-01", forecastMinor: 12000, growthPct: null },
    { month: "2026-02", forecastMinor: 14000, growthPct: 16.7 }
  ],
  taggingCompleteness: {
    totalExpenseLines: 4,
    taggedExpenseLines: 3,
    completenessRatio: 0.75
  },
  replacementStatus: {
    totalPlans: 3,
    replacementRequiredOpen: 1,
    byStatus: [{ status: "draft", count: 3 }]
  },
  narrativeBlocks: [{ id: "summary", title: "Summary", body: "Narrative text" }]
};

const queryReportMock = vi.mocked(queryReport);
const exportReportMock = vi.mocked(exportReport);

function renderDashboardPage() {
  return render(
    <FluentProvider theme={budgetItLightTheme}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </FluentProvider>
  );
}

describe("DashboardPage", () => {
  beforeEach(() => {
    queryReportMock.mockReset();
    exportReportMock.mockReset();
    queryReportMock.mockResolvedValue(datasetFixture);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders KPI cards and chart sections from dashboard dataset", async () => {
    renderDashboardPage();

    await screen.findByText("Forecast");
    expect(queryReportMock).toHaveBeenCalledWith({
      query: "dashboard.summary",
      scenarioId: "baseline"
    });

    expect(screen.getByText("Spend Trend")).toBeInTheDocument();
    expect(screen.getAllByText("Variance").length).toBeGreaterThan(0);
    expect(screen.getByText("Renewals Timeline")).toBeInTheDocument();
    expect(screen.getByText("Tagging Completeness")).toBeInTheDocument();
  });

  it("shows stale warning and allows re-materialize refresh entry point", async () => {
    renderDashboardPage();

    await screen.findByTestId("stale-forecast-banner");
    fireEvent.click(screen.getByRole("button", { name: "Re-materialize" }));

    await waitFor(() => {
      expect(queryReportMock).toHaveBeenCalledTimes(2);
    });
  });

  it("exports selected format and displays output path", async () => {
    exportReportMock.mockResolvedValue({
      files: { csv: "C:\\exports\\dashboard.csv" }
    });

    renderDashboardPage();
    await screen.findByText("Forecast");

    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Export CSV" }));

    await waitFor(() => {
      expect(exportReportMock).toHaveBeenCalledWith({
        scenarioId: "baseline",
        formats: ["csv"]
      });
    });
    expect(await screen.findByText(/C:\\exports\\dashboard\.csv/i)).toBeInTheDocument();
  });

  it("renders dashboard as default app route and completes one export flow", async () => {
    exportReportMock.mockResolvedValue({
      files: { html: "C:\\exports\\dashboard.html" }
    });

    render(
      <FluentProvider theme={budgetItLightTheme}>
        <MemoryRouter initialEntries={["/"]}>
          <AppShell>
            <AppRoutes />
          </AppShell>
        </MemoryRouter>
      </FluentProvider>
    );

    await screen.findByText("Forecast");
    expect(screen.getByTestId("page-title")).toHaveTextContent("Dashboard");

    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Export HTML" }));

    await waitFor(() => {
      expect(exportReportMock).toHaveBeenCalledWith({
        scenarioId: "baseline",
        formats: ["html"]
      });
    });
    expect(await screen.findByText(/C:\\exports\\dashboard\.html/i)).toBeInTheDocument();
  });
});
