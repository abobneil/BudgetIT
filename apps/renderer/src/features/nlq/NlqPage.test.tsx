/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { FluentProvider } from "@fluentui/react-components";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DashboardDataset } from "../../reporting";
import { AppShell } from "../../app/AppShell";
import { AppRoutes } from "../../app/routes";
import {
  exportReport,
  parseNlq,
  pickDirectoryPath,
  queryReport
} from "../../lib/ipcClient";
import { budgetItLightTheme } from "../../ui/theme";
import { ScenarioProvider } from "../scenarios/ScenarioContext";
import { NlqPage } from "./NlqPage";

vi.mock("../../lib/ipcClient", () => ({
  isIpcAvailable: vi.fn(() => false),
  listScenarios: vi.fn(),
  cloneScenario: vi.fn(),
  approveScenario: vi.fn(),
  lockScenario: vi.fn(),
  parseNlq: vi.fn(),
  exportReport: vi.fn(),
  pickDirectoryPath: vi.fn(),
  queryReport: vi.fn()
}));

const parseNlqMock = vi.mocked(parseNlq);
const exportReportMock = vi.mocked(exportReport);
const pickDirectoryPathMock = vi.mocked(pickDirectoryPath);
const queryReportMock = vi.mocked(queryReport);

const reportDataset: DashboardDataset = {
  scenarioId: "baseline",
  staleForecast: false,
  spendTrend: [{ month: "2026-01", forecastMinor: 10000, actualMinor: 9900 }],
  variance: [
    {
      month: "2026-01",
      forecastMinor: 10000,
      actualMinor: 9900,
      varianceMinor: -100,
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
  narrativeBlocks: [{ id: "summary", title: "Summary", body: "Narrative" }]
};

function renderNlqStandalone() {
  return render(
    <FluentProvider theme={budgetItLightTheme}>
      <MemoryRouter>
        <NlqPage />
      </MemoryRouter>
    </FluentProvider>
  );
}

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

describe("NlqPage", () => {
  beforeEach(() => {
    localStorage.clear();
    parseNlqMock.mockReset();
    exportReportMock.mockReset();
    pickDirectoryPathMock.mockReset();
    queryReportMock.mockReset();
    parseNlqMock.mockResolvedValue({
      filterSpec: {
        dateWindow: "next_90_days",
        vendor: "Microsoft",
        amount: { op: ">", value: 50000 }
      },
      explanation: "Parsed filters: vendor Microsoft, amount > 50000, next 90 days.",
      rows: [
        { id: "exp-1", name: "Endpoint Security", amount_minor: 84000 },
        { id: "exp-2", name: "Cloud Compute", amount_minor: 240000 }
      ]
    });
    exportReportMock.mockResolvedValue({
      files: { csv: "C:\\exports\\nlq-results.csv", excel: "C:\\exports\\nlq-results.xlsx" }
    });
    pickDirectoryPathMock.mockResolvedValue(null);
    queryReportMock.mockResolvedValue(reportDataset);
  });

  afterEach(() => {
    cleanup();
  });

  it("maps nlq.parse response into filter preview and result table", async () => {
    renderNlqStandalone();

    fireEvent.change(screen.getByLabelText("NLQ prompt input"), {
      target: { value: "show microsoft spend over 50000 in next 90 days" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Run Query" }));

    await waitFor(() => {
      expect(parseNlqMock).toHaveBeenCalledWith({
        query: "show microsoft spend over 50000 in next 90 days"
      });
    });

    expect(
      await screen.findByText(
        "Parsed filters: vendor Microsoft, amount > 50000, next 90 days."
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/"vendor": "Microsoft"/i)).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "NLQ results table" })).toBeInTheDocument();
    expect(screen.getByText("Endpoint Security")).toBeInTheDocument();
    expect(screen.getByText("Cloud Compute")).toBeInTheDocument();
  });

  it("runs prompt, saves as report, and reopens saved preset in report gallery", async () => {
    renderWorkspace("/nlq");

    fireEvent.change(screen.getByLabelText("NLQ prompt input"), {
      target: { value: "security variance this quarter" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Run Query" }));
    await screen.findByText(/Parsed filters:/i);

    fireEvent.change(screen.getByLabelText("Save report name"), {
      target: { value: "Security Variance Report" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save As Report" }));
    expect(await screen.findByText("Saved report preset: Security Variance Report.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Reports" }));
    await waitFor(() => {
      expect(screen.getByTestId("page-title")).toHaveTextContent("Reports");
    });
    expect(
      screen.getByRole("button", { name: "Open Security Variance Report" })
    ).toBeInTheDocument();
  });

  it("browses an NLQ export directory and populates the output path", async () => {
    pickDirectoryPathMock.mockResolvedValueOnce("C:\\exports\\nlq");

    renderNlqStandalone();

    fireEvent.change(screen.getByLabelText("NLQ prompt input"), {
      target: { value: "show microsoft spend over 50000 in next 90 days" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Run Query" }));
    await screen.findByText(/Parsed filters:/i);

    fireEvent.click(screen.getByRole("button", { name: "Browse…" }));

    await waitFor(() => {
      expect(pickDirectoryPathMock).toHaveBeenCalledWith({
        title: "Choose NLQ export directory",
        defaultPath: undefined
      });
    });
    expect(screen.getByLabelText("NLQ export path")).toHaveValue("C:\\exports\\nlq");
  });

  it("exports NLQ results with canonical payload keys", async () => {
    renderNlqStandalone();

    fireEvent.change(screen.getByLabelText("NLQ prompt input"), {
      target: { value: "show microsoft spend over 50000 in next 90 days" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Run Query" }));
    await screen.findByText(/Parsed filters:/i);

    fireEvent.change(screen.getByLabelText("NLQ export format"), {
      target: { value: "excel" }
    });
    fireEvent.change(screen.getByLabelText("NLQ export path"), {
      target: { value: "C:\\exports\\nlq" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Export Results" }));

    await waitFor(() => {
      expect(exportReportMock).toHaveBeenCalledWith({
        scenarioId: "baseline",
        reportType: "nlq.results",
        outputDir: "C:\\exports\\nlq",
        formats: ["excel"],
        filterSpec: {
          dateWindow: "next_90_days",
          vendor: "Microsoft",
          amount: { op: ">", value: 50000 }
        }
      });
    });
    expect(await screen.findByText(/Exported to C:\\exports\\nlq-results\.xlsx/i)).toBeInTheDocument();
  });

  it("surfaces NLQ export format restriction errors from backend", async () => {
    exportReportMock.mockRejectedValueOnce(
      new Error("NLQ export supports only csv and excel formats.")
    );
    renderNlqStandalone();

    fireEvent.change(screen.getByLabelText("NLQ prompt input"), {
      target: { value: "show microsoft spend over 50000 in next 90 days" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Run Query" }));
    await screen.findByText(/Parsed filters:/i);

    fireEvent.click(screen.getByRole("button", { name: "Export Results" }));

    expect(
      await screen.findByText(/Export failed: NLQ export supports only csv and excel formats\./i)
    ).toBeInTheDocument();
  });
});
