/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { FluentProvider } from "@fluentui/react-components";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { AppRoutes } from "./routes";
import { AppShell } from "./AppShell";
import { ScenarioProvider } from "../features/scenarios/ScenarioContext";
import { FeedbackProvider } from "../ui/feedback";
import { budgetItLightTheme } from "../ui/theme";
import {
  getDatabaseSecurityStatus,
  getSettings,
  listAlerts,
  onAlertNavigate,
  queryReport
} from "../lib/ipcClient";

vi.mock("../lib/ipcClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/ipcClient")>();
  return {
    ...actual,
    listAlerts: vi.fn(),
    onAlertNavigate: vi.fn(),
    queryReport: vi.fn(),
    getSettings: vi.fn(),
    getDatabaseSecurityStatus: vi.fn()
  };
});

const listAlertsMock = vi.mocked(listAlerts);
const onAlertNavigateMock = vi.mocked(onAlertNavigate);
const queryReportMock = vi.mocked(queryReport);
const getSettingsMock = vi.mocked(getSettings);
const getDatabaseSecurityStatusMock = vi.mocked(getDatabaseSecurityStatus);

const datasetFixture = {
  scenarioId: "baseline",
  staleForecast: false,
  spendTrend: [{ month: "2026-01", forecastMinor: 12000, actualMinor: 10000 }],
  variance: [
    {
      month: "2026-01",
      forecastMinor: 12000,
      actualMinor: 10000,
      varianceMinor: -2000,
      unmatchedActualMinor: 0,
      unmatchedCount: 0
    }
  ],
  renewals: [{ month: "2026-06", count: 2 }],
  growth: [{ month: "2026-01", forecastMinor: 12000, growthPct: null }],
  taggingCompleteness: {
    totalExpenseLines: 4,
    taggedExpenseLines: 3,
    completenessRatio: 0.75
  },
  replacementStatus: {
    totalPlans: 2,
    replacementRequiredOpen: 1,
    byStatus: [{ status: "draft", count: 2 }]
  },
  narrativeBlocks: [{ id: "summary", title: "Summary", body: "Narrative text." }]
};

function renderWorkspace(initialPath: string) {
  return render(
    <ScenarioProvider>
      <FluentProvider theme={budgetItLightTheme}>
        <FeedbackProvider>
          <MemoryRouter initialEntries={[initialPath]}>
            <AppShell>
              <AppRoutes />
            </AppShell>
          </MemoryRouter>
        </FeedbackProvider>
      </FluentProvider>
    </ScenarioProvider>
  );
}

async function waitForTitle(title: string): Promise<void> {
  await waitFor(() => {
    expect(screen.getByTestId("page-title")).toHaveTextContent(title);
  });
}

describe("accessibility and keyboard reachability", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      null as unknown as CanvasRenderingContext2D
    );

    listAlertsMock.mockReset();
    onAlertNavigateMock.mockReset();
    queryReportMock.mockReset();
    getSettingsMock.mockReset();
    getDatabaseSecurityStatusMock.mockReset();

    listAlertsMock.mockResolvedValue([
      {
        id: "alert-1",
        entityType: "contract",
        entityId: "ctr-1",
        fireAt: "2026-06-20",
        status: "pending",
        snoozedUntil: null,
        message: "Renewal due in 45 days"
      }
    ]);
    onAlertNavigateMock.mockReturnValue(undefined);
    queryReportMock.mockResolvedValue(datasetFixture);
    getSettingsMock.mockResolvedValue({
      startWithWindows: true,
      minimizeToTray: true,
      teamsEnabled: false,
      teamsWebhookUrl: "",
      lastRestoreSummary: null
    });
    getDatabaseSecurityStatusMock.mockResolvedValue({
      databasePath: "C:\\BudgetIT\\budgetit.db",
      keyPresent: true,
      safeStorageAvailable: true
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("passes axe checks for major routes", async () => {
    const routes: Array<{ path: string; title: string }> = [
      { path: "/dashboard", title: "Dashboard" },
      { path: "/alerts", title: "Alerts" },
      { path: "/reports", title: "Reports" },
      { path: "/settings", title: "Settings" }
    ];

    for (const route of routes) {
      const view = renderWorkspace(route.path);
      await waitForTitle(route.title);
      const result = await axe(view.container);
      const severeViolations = result.violations.filter((entry) =>
        entry.impact === "serious" || entry.impact === "critical"
      );
      expect(severeViolations).toHaveLength(0);
      view.unmount();
    }
  }, 30000);

  it("supports keyboard tab flow across shell controls", async () => {
    renderWorkspace("/dashboard");
    await waitForTitle("Dashboard");

    const user = userEvent.setup();
    const scenarioSelector = screen.getByLabelText("Scenario selector");
    const globalSearch = screen.getByLabelText("Global search");
    const commandPaletteButton = screen.getByRole("button", { name: "Command Palette" });

    scenarioSelector.focus();
    expect(document.activeElement).toBe(scenarioSelector);
    await user.tab();
    expect(document.activeElement).toBe(globalSearch);
    await user.tab();
    expect(document.activeElement).toBe(commandPaletteButton);

    await user.keyboard("{Enter}");
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("completes a smoke navigation flow without uncaught renderer errors", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    renderWorkspace("/dashboard");
    await waitForTitle("Dashboard");

    await user.click(screen.getByRole("link", { name: "Import" }));
    await waitForTitle("Import");

    await user.click(screen.getByRole("link", { name: "Alerts" }));
    await waitForTitle("Alerts");

    await user.click(screen.getByRole("link", { name: "Reports" }));
    await waitForTitle("Reports");

    await user.click(screen.getByRole("link", { name: "Settings" }));
    await waitForTitle("Settings");

    const errors = consoleErrorSpy.mock.calls
      .flatMap((call) => call.map((entry) => String(entry)))
      .join("\n");
    expect(errors).not.toMatch(/uncaught|unhandled/i);

    consoleErrorSpy.mockRestore();
  });
});
