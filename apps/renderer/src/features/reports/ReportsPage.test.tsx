/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { FluentProvider } from "@fluentui/react-components";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DashboardDataset } from "../../reporting";
import {
  exportReport,
  isIpcAvailable,
  listUnmatchedActuals,
  pickDirectoryPath,
  previewReport,
  queryReport
} from "../../lib/ipcClient";
import { budgetItLightTheme } from "../../ui/theme";
import { ReportsPage } from "./ReportsPage";

vi.mock("../../lib/ipcClient", () => ({
  isIpcAvailable: vi.fn(),
  queryReport: vi.fn(),
  exportReport: vi.fn(),
  pickDirectoryPath: vi.fn(),
  previewReport: vi.fn(),
  listUnmatchedActuals: vi.fn(),
  reviewUnmatchedActual: vi.fn(),
  createExpenseFromUnmatchedActual: vi.fn(),
  generateShowbackStatement: vi.fn(),
  exportShowbackStatement: vi.fn()
}));

const isIpcAvailableMock = vi.mocked(isIpcAvailable);
const listUnmatchedActualsMock = vi.mocked(listUnmatchedActuals);
const queryReportMock = vi.mocked(queryReport);
const exportReportMock = vi.mocked(exportReport);
const pickDirectoryPathMock = vi.mocked(pickDirectoryPath);
const previewReportMock = vi.mocked(previewReport);

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
  const scrollIntoViewMock = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    scrollIntoViewMock.mockReset();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoViewMock
    });
    isIpcAvailableMock.mockReset();
    listUnmatchedActualsMock.mockReset();
    queryReportMock.mockReset();
    exportReportMock.mockReset();
    pickDirectoryPathMock.mockReset();
    previewReportMock.mockReset();
    isIpcAvailableMock.mockReturnValue(false);
    listUnmatchedActualsMock.mockResolvedValue({
      scenarioId: "baseline",
      items: [],
      total: 0
    });
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
    previewReportMock.mockResolvedValue({
      html: "<!doctype html><html><body><h1>Preview</h1></body></html>",
      scenarioId: "baseline",
      reportType: "dashboard.summary"
    });
    pickDirectoryPathMock.mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
  });

  it("refreshes dataset when filters change and preserves visualization toggle state", async () => {
    renderReportsPage();
    expect(screen.getByRole("button", { name: "Reports Help" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import/Match Help" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Jump to Export" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Jump to Narrative" })).toBeInTheDocument();
    expect(screen.getByTestId("reports-definitions-card")).toBeInTheDocument();

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

    const chartToggle = screen.getByLabelText("Show Chart Block") as HTMLInputElement;
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

    fireEvent.click(screen.getByRole("button", { name: "Jump to Export" }));
    fireEvent.click(screen.getByRole("button", { name: "Jump to Narrative" }));
    expect(scrollIntoViewMock).toHaveBeenCalled();
    expect((screen.getByLabelText("Show Chart Block") as HTMLInputElement).checked).toBe(false);
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
    fireEvent.click(screen.getByRole("button", { name: "Confirm Destination" }));

    fireEvent.change(screen.getByLabelText("Export format"), {
      target: { value: "csv" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Queue Export" }));
    await waitFor(() => {
      expect(exportReportMock).toHaveBeenCalledWith(
        expect.objectContaining({
          scenarioId: "baseline",
          reportType: "spend.byVendor",
          outputDir: "C:\\exports\\reports",
          formats: ["csv"]
        })
      );
    });

    fireEvent.change(screen.getByLabelText("Export format"), {
      target: { value: "pdf" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Queue Export" }));
    await waitFor(() => {
      expect(exportReportMock).toHaveBeenCalledWith(
        expect.objectContaining({
          scenarioId: "baseline",
          reportType: "spend.byVendor",
          outputDir: "C:\\exports\\reports",
          formats: ["pdf"]
        })
      );
    });

    expect(await screen.findByText(/C:\\exports\\report\.csv/i)).toBeInTheDocument();
    expect(await screen.findByText(/C:\\exports\\report\.pdf/i)).toBeInTheDocument();
    expect(screen.getAllByText("succeeded").length).toBeGreaterThanOrEqual(2);
  });

  it("browses export and showback directories and populates both inputs", async () => {
    isIpcAvailableMock.mockReturnValue(true);
    pickDirectoryPathMock
      .mockResolvedValueOnce("C:\\exports\\reports")
      .mockResolvedValueOnce("C:\\exports\\showback");

    renderReportsPage();
    await screen.findByText("Report Gallery");

    const exportStep = screen
      .getByLabelText("Export destination")
      .closest(".reports-export-controls__step") as HTMLElement | null;
    if (!exportStep) {
      throw new Error("Expected export destination step to be rendered.");
    }
    fireEvent.click(within(exportStep).getByRole("button", { name: "Browse…" }));

    const showbackFilters = screen
      .getByLabelText("Showback output directory")
      .closest(".reports-filters") as HTMLElement | null;
    if (!showbackFilters) {
      throw new Error("Expected showback filters to be rendered.");
    }
    fireEvent.click(within(showbackFilters).getByRole("button", { name: "Browse…" }));

    await waitFor(() => {
      expect(pickDirectoryPathMock).toHaveBeenCalledTimes(2);
    });
    expect(pickDirectoryPathMock).toHaveBeenNthCalledWith(1, {
      title: "Choose export destination",
      defaultPath: undefined
    });
    expect(pickDirectoryPathMock).toHaveBeenNthCalledWith(2, {
      title: "Choose showback output directory",
      defaultPath: undefined
    });
    expect(screen.getByLabelText("Export destination")).toHaveValue("C:\\exports\\reports");
    expect(screen.getByLabelText("Showback output directory")).toHaveValue(
      "C:\\exports\\showback"
    );
  });

  it("generates an export preview before queueing report export", async () => {
    renderReportsPage();
    await screen.findByText("Report Gallery");

    fireEvent.click(screen.getByRole("button", { name: "Open Spend by Tag" }));
    fireEvent.change(screen.getByLabelText("Filter tag"), {
      target: { value: "security" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Preview Report" }));

    await waitFor(() => {
      expect(previewReportMock).toHaveBeenCalledWith({
        scenarioId: "baseline",
        reportType: "spend.byTag",
        filters: {
          dateFrom: "2026-01-01",
          dateTo: "2026-12-31",
          tag: "security"
        }
      });
    });

    const frame = await screen.findByTitle("Report export preview");
    expect(frame).toHaveAttribute("srcdoc", expect.stringContaining("<h1>Preview</h1>"));
  });
});
