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
    localStorage.clear();
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

  it("shows stale warning and routes maintenance action to settings", async () => {
    renderDashboardPage();

    await screen.findByTestId("stale-forecast-banner");
    fireEvent.click(screen.getByRole("button", { name: "Open Settings" }));

    await waitFor(() => {
      expect(queryReportMock).toHaveBeenCalledTimes(1);
    });
  });

  it("applies 1m/3m/12m/60m range chips to visible dashboard data", async () => {
    queryReportMock.mockResolvedValue({
      ...datasetFixture,
      staleForecast: false,
      spendTrend: [
        { month: "2026-01", forecastMinor: 1000, actualMinor: 900 },
        { month: "2026-02", forecastMinor: 2000, actualMinor: 2100 },
        { month: "2026-03", forecastMinor: 3000, actualMinor: 3100 },
        { month: "2026-04", forecastMinor: 4000, actualMinor: 3900 }
      ],
      variance: [
        {
          month: "2026-01",
          forecastMinor: 1000,
          actualMinor: 900,
          varianceMinor: -100,
          unmatchedActualMinor: 0,
          unmatchedCount: 0
        },
        {
          month: "2026-02",
          forecastMinor: 2000,
          actualMinor: 2100,
          varianceMinor: 100,
          unmatchedActualMinor: 0,
          unmatchedCount: 0
        },
        {
          month: "2026-03",
          forecastMinor: 3000,
          actualMinor: 3100,
          varianceMinor: 100,
          unmatchedActualMinor: 0,
          unmatchedCount: 0
        },
        {
          month: "2026-04",
          forecastMinor: 4000,
          actualMinor: 3900,
          varianceMinor: -100,
          unmatchedActualMinor: 0,
          unmatchedCount: 0
        }
      ],
      renewals: [
        { month: "2026-01", count: 1 },
        { month: "2026-02", count: 1 },
        { month: "2026-03", count: 1 },
        { month: "2026-04", count: 1 }
      ],
      growth: [
        { month: "2026-01", forecastMinor: 1000, growthPct: null },
        { month: "2026-02", forecastMinor: 2000, growthPct: 100 },
        { month: "2026-03", forecastMinor: 3000, growthPct: 50 },
        { month: "2026-04", forecastMinor: 4000, growthPct: 33.3 }
      ]
    });

    renderDashboardPage();

    await screen.findByText("Showing last 12 months.");
    expect(screen.getAllByText("2026-01").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "1M" }));
    await screen.findByText("Showing last 1 month.");
    expect(screen.queryAllByText("2026-01")).toHaveLength(0);
    expect(screen.getAllByText("2026-04").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "3M" }));
    await screen.findByText("Showing last 3 months.");
    expect(screen.queryAllByText("2026-01")).toHaveLength(0);
    expect(screen.getAllByText("2026-02").length).toBeGreaterThan(0);
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
        reportType: "dashboard.summary",
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
        reportType: "dashboard.summary",
        scenarioId: "baseline",
        formats: ["html"]
      });
    });
    expect(await screen.findByText(/C:\\exports\\dashboard\.html/i)).toBeInTheDocument();
  });

  it("supports editing dashboard cards, visibility toggles, and section grouping", async () => {
    renderDashboardPage();

    await screen.findByText("Forecast");
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit Layout" }));
    expect(screen.getByTestId("dashboard-layout-editor")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Toggle Forecast card" }));
    await waitFor(() => {
      expect(screen.queryByTestId("dashboard-card-kpi-forecast")).not.toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("New dashboard section name"), {
      target: { value: "Reliability" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Section" }));

    fireEvent.change(screen.getByLabelText("Section for Renewals Timeline"), {
      target: { value: "section-reliability" }
    });

    expect(
      await screen.findByTestId("dashboard-section-section-reliability")
    ).toBeInTheDocument();
  });
});
