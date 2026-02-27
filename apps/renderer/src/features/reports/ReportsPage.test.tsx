/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { FluentProvider } from "@fluentui/react-components";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DashboardDataset } from "../../reporting";
import { exportReport, queryReport } from "../../lib/ipcClient";
import { budgetItLightTheme } from "../../ui/theme";
import { ReportsPage } from "./ReportsPage";

vi.mock("../../lib/ipcClient", () => ({
  queryReport: vi.fn(),
  exportReport: vi.fn()
}));

const queryReportMock = vi.mocked(queryReport);
const exportReportMock = vi.mocked(exportReport);

const datasetFixture: DashboardDataset = {
  scenarioId: "baseline",
  staleForecast: false,
  spendTrend: [
    { month: "2026-01", forecastMinor: 12000, actualMinor: 11000 },
    { month: "2026-02", forecastMinor: 13500, actualMinor: 14000 }
  ],
  variance: [
    {
      month: "2026-01",
      forecastMinor: 12000,
      actualMinor: 11000,
      varianceMinor: -1000,
      unmatchedActualMinor: 0,
      unmatchedCount: 0
    }
  ],
  renewals: [{ month: "2026-06", count: 2 }],
  growth: [{ month: "2026-01", forecastMinor: 12000, growthPct: null }],
  taggingCompleteness: {
    totalExpenseLines: 10,
    taggedExpenseLines: 8,
    completenessRatio: 0.8
  },
  replacementStatus: {
    totalPlans: 3,
    replacementRequiredOpen: 1,
    byStatus: [{ status: "draft", count: 3 }]
  },
  narrativeBlocks: [{ id: "summary", title: "Summary", body: "Report narrative." }]
};

function renderReportsPage() {
  return render(
    <FluentProvider theme={budgetItLightTheme}>
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    </FluentProvider>
  );
}

describe("ReportsPage", () => {
  beforeEach(() => {
    localStorage.clear();
    queryReportMock.mockReset();
    exportReportMock.mockReset();
    queryReportMock.mockResolvedValue(datasetFixture);
    exportReportMock.mockImplementation(async (payload) => {
      const input = payload as { formats: Array<"html" | "pdf" | "excel" | "csv" | "png"> };
      const format = input.formats[0];
      return {
        files: {
          [format]: `C:\\exports\\report.${format}`
        }
      };
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("refreshes dataset when filters change and preserves visualization toggle state", async () => {
    renderReportsPage();

    await waitFor(() => {
      expect(queryReportMock).toHaveBeenCalledWith({
        query: "dashboard.summary",
        scenarioId: "baseline",
        filters: {
          dateFrom: "2026-01-01",
          dateTo: "2026-12-31",
          tag: "all"
        }
      });
    });

    const chartToggle = screen.getByLabelText("Show chart block") as HTMLInputElement;
    fireEvent.click(chartToggle);
    expect(chartToggle.checked).toBe(false);

    fireEvent.change(screen.getByLabelText("Filter start date"), {
      target: { value: "2026-03-01" }
    });
    fireEvent.change(screen.getByLabelText("Filter tag"), {
      target: { value: "security" }
    });

    await waitFor(() => {
      expect(queryReportMock).toHaveBeenCalledWith({
        query: "dashboard.summary",
        scenarioId: "baseline",
        filters: {
          dateFrom: "2026-03-01",
          dateTo: "2026-12-31",
          tag: "security"
        }
      });
    });
    expect((screen.getByLabelText("Show chart block") as HTMLInputElement).checked).toBe(false);
  });

  it("opens gallery report, updates filters, exports two formats, and shows job results", async () => {
    renderReportsPage();
    await screen.findByText("Report Gallery");

    fireEvent.click(screen.getByRole("button", { name: "Open Spend by Vendor" }));
    fireEvent.change(screen.getByLabelText("Filter tag"), {
      target: { value: "finance" }
    });
    fireEvent.change(screen.getByLabelText("Export destination"), {
      target: { value: "C:\\exports\\reports" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm destination" }));

    fireEvent.change(screen.getByLabelText("Export format"), {
      target: { value: "csv" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Queue export" }));
    await waitFor(() => {
      expect(exportReportMock).toHaveBeenCalledWith(
        expect.objectContaining({
          scenarioId: "baseline",
          reportType: "spend.byVendor",
          formats: ["csv"]
        })
      );
    });

    fireEvent.change(screen.getByLabelText("Export format"), {
      target: { value: "pdf" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Queue export" }));
    await waitFor(() => {
      expect(exportReportMock).toHaveBeenCalledWith(
        expect.objectContaining({
          scenarioId: "baseline",
          reportType: "spend.byVendor",
          formats: ["pdf"]
        })
      );
    });

    expect(await screen.findByText(/C:\\exports\\report\.csv/i)).toBeInTheDocument();
    expect(await screen.findByText(/C:\\exports\\report\.pdf/i)).toBeInTheDocument();
    expect(screen.getAllByText("succeeded").length).toBeGreaterThanOrEqual(2);
  });
});
