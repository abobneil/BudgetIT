/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { FluentProvider } from "@fluentui/react-components";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getSettings,
  isIpcAvailable,
  listContracts,
  listExpenses,
  listScenarios,
  listServices,
  listVendors,
  openHelpWindow,
  type ContractRecord as IpcContractRecord,
  type ExpenseLineRecord as IpcExpenseLineRecord,
  type ScenarioRecord as IpcScenarioRecord,
  type ServiceRecord as IpcServiceRecord,
  type VendorRecord as IpcVendorRecord
} from "../lib/ipcClient";
import { ScenarioProvider } from "../features/scenarios/ScenarioContext";
import { FeedbackProvider } from "../ui/feedback";
import { budgetItLightTheme } from "../ui/theme";
import { AppShell } from "./AppShell";
import {
  buildContractRoute,
  buildExpenseRoute,
  buildServiceRoute,
  buildVendorRoute
} from "./entity-routes";
import { AppRoutes } from "./routes";

vi.mock("../lib/ipcClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/ipcClient")>();
  return {
    ...actual,
    getSettings: vi.fn(),
    isIpcAvailable: vi.fn(),
    listContracts: vi.fn(),
    listExpenses: vi.fn(),
    listScenarios: vi.fn(),
    listServices: vi.fn(),
    listVendors: vi.fn(),
    openHelpWindow: vi.fn()
  };
});

const isIpcAvailableMock = vi.mocked(isIpcAvailable);
const getSettingsMock = vi.mocked(getSettings);
const listVendorsMock = vi.mocked(listVendors);
const listServicesMock = vi.mocked(listServices);
const listContractsMock = vi.mocked(listContracts);
const listExpensesMock = vi.mocked(listExpenses);
const listScenariosMock = vi.mocked(listScenarios);
const openHelpWindowMock = vi.mocked(openHelpWindow);

const IPC_SCENARIOS: IpcScenarioRecord[] = [
  {
    id: "baseline",
    name: "Baseline",
    parentScenarioId: null,
    approvalStatus: "approved",
    isLocked: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "growth",
    name: "Growth",
    parentScenarioId: "baseline",
    approvalStatus: "reviewed",
    isLocked: false,
    createdAt: "2026-01-20T00:00:00.000Z",
    updatedAt: "2026-01-20T00:00:00.000Z"
  }
];

const LIVE_VENDORS: IpcVendorRecord[] = [
  {
    id: "vend-live",
    name: "Acme Platform",
    website: null,
    notes: null,
    owner: "FinOps",
    annualSpendMinor: 780000,
    status: "active",
    risk: "medium",
    createdAt: "2026-01-10T00:00:00.000Z",
    updatedAt: "2026-01-10T00:00:00.000Z",
    deletedAt: null
  }
];

const LIVE_SERVICES: IpcServiceRecord[] = [
  {
    id: "svc-live",
    vendorId: "vend-live",
    name: "Spend Insights",
    status: "active",
    ownerTeam: "FinOps",
    annualSpendMinor: 780000,
    risk: "low",
    replacementStatus: "not-started",
    createdAt: "2026-01-10T00:00:00.000Z",
    updatedAt: "2026-01-10T00:00:00.000Z",
    deletedAt: null
  }
];

const LIVE_CONTRACTS: IpcContractRecord[] = [
  {
    id: "ctr-live",
    serviceId: "svc-live",
    contractNumber: "CTR-LIVE-001",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    renewalType: "manual",
    renewalDate: "2026-12-31",
    noticePeriodDays: 45,
    owner: "FinOps",
    lifecycleStatus: "active",
    renewalAction: "manual-review",
    createdAt: "2026-01-10T00:00:00.000Z",
    updatedAt: "2026-01-10T00:00:00.000Z",
    deletedAt: null
  }
];

const BASELINE_EXPENSES: IpcExpenseLineRecord[] = [
  {
    id: "exp-live-baseline",
    scenarioId: "baseline",
    serviceId: "svc-live",
    contractId: "ctr-live",
    name: "Baseline Platform Spend",
    expenseType: "recurring",
    status: "approved",
    amountMinor: 120000,
    currency: "USD",
    capexOpex: "opex",
    glAccountCode: null,
    costCenterCode: null,
    fundingSource: null,
    startDate: "2026-01-01",
    endDate: null,
    createdAt: "2026-01-10T00:00:00.000Z",
    updatedAt: "2026-01-10T00:00:00.000Z",
    deletedAt: null
  }
];

const GROWTH_EXPENSES: IpcExpenseLineRecord[] = [
  {
    id: "exp-live-growth",
    scenarioId: "growth",
    serviceId: "svc-live",
    contractId: "ctr-live",
    name: "Growth Expansion Spend",
    expenseType: "recurring",
    status: "planned",
    amountMinor: 240000,
    currency: "USD",
    capexOpex: "opex",
    glAccountCode: null,
    costCenterCode: null,
    fundingSource: null,
    startDate: "2026-02-01",
    endDate: null,
    createdAt: "2026-01-22T00:00:00.000Z",
    updatedAt: "2026-01-22T00:00:00.000Z",
    deletedAt: null
  }
];

function renderAt(path: string) {
  return render(
    <FluentProvider theme={budgetItLightTheme}>
      <MemoryRouter initialEntries={[path]}>
        <AppShell>
          <AppRoutes />
        </AppShell>
      </MemoryRouter>
    </FluentProvider>
  );
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="current-location">{`${location.pathname}${location.search}`}</div>;
}

function renderSearchShell(initialPath = "/dashboard") {
  return render(
    <ScenarioProvider>
      <FluentProvider theme={budgetItLightTheme}>
        <FeedbackProvider>
          <MemoryRouter initialEntries={[initialPath]}>
            <AppShell>
              <LocationProbe />
            </AppShell>
          </MemoryRouter>
        </FeedbackProvider>
      </FluentProvider>
    </ScenarioProvider>
  );
}

function getGlobalSearchOptionValues(): string[] {
  return Array.from(document.querySelectorAll("#global-search-options option")).map(
    (option) => option.getAttribute("value") ?? ""
  );
}

describe("AppShell", () => {
  beforeEach(() => {
    window.localStorage.clear();

    isIpcAvailableMock.mockReset();
    getSettingsMock.mockReset();
    listVendorsMock.mockReset();
    listServicesMock.mockReset();
    listContractsMock.mockReset();
    listExpensesMock.mockReset();
    listScenariosMock.mockReset();
    openHelpWindowMock.mockReset();

    isIpcAvailableMock.mockReturnValue(false);
    getSettingsMock.mockResolvedValue({
      startWithWindows: true,
      minimizeToTray: true,
      teamsEnabled: false,
      teamsWebhookUrl: "",
      lastRestoreSummary: null
    });
    listScenariosMock.mockResolvedValue(IPC_SCENARIOS);
    listVendorsMock.mockResolvedValue(LIVE_VENDORS);
    listServicesMock.mockResolvedValue(LIVE_SERVICES);
    listContractsMock.mockResolvedValue(LIVE_CONTRACTS);
    listExpensesMock.mockImplementation(async (payload) =>
      payload?.scenarioId === "growth" ? GROWTH_EXPENSES : BASELINE_EXPENSES
    );
    openHelpWindowMock.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("renders primary nav and route outlet", () => {
    renderAt("/dashboard");

    expect(screen.getByLabelText("Primary navigation")).toBeInTheDocument();
    expect(screen.getByTestId("page-title")).toHaveTextContent("Dashboard");
    expect(screen.getByTestId("topbar-search-region")).toBeInTheDocument();
    expect(screen.getByTestId("topbar-actions-region")).toBeInTheDocument();
    expect(screen.getByLabelText("Global search")).toBeInTheDocument();
    expect(screen.getByLabelText("Scenario selector")).toBeInTheDocument();
    expect(screen.getByTestId("scenario-select-wrap")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Help" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Command Palette" })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^\(\?\)$/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/help for/i)).not.toBeInTheDocument();
    expect(screen.getByText("Loading dashboard...")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Alerts" })).toBeInTheDocument();
  });

  it("updates page title when route changes", () => {
    renderAt("/dashboard");
    expect(screen.getByTestId("page-title")).toHaveTextContent("Dashboard");
    cleanup();
    renderAt("/alerts");

    expect(screen.getByTestId("page-title")).toHaveTextContent("Alerts");
    expect(
      screen.getByText("Actionable inbox for due, snoozed, and acknowledged alerts.")
    ).toBeInTheDocument();
  });

  it("hides navigation and topbar controls on the help route", async () => {
    renderAt("/help");

    expect(screen.queryByLabelText("Primary navigation")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Global search")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Command Palette" })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^\(\?\)$/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/help for/i)).not.toBeInTheDocument();
    expect(await screen.findByText("Help Center")).toBeInTheDocument();
  });

  it.each([
    ["/dashboard", { topic: "dashboard-overview", anchor: "variance-kpi" }],
    ["/expenses", { topic: "expenses-workspace", anchor: "overview" }],
    ["/services", { topic: "services-workspace", anchor: "overview" }],
    ["/contracts", { topic: "contracts-workspace", anchor: "overview" }],
    ["/vendors", { topic: "vendors-workspace", anchor: "overview" }],
    ["/tags", { topic: "tags-workspace", anchor: "overview" }],
    ["/scenarios", { topic: "scenarios-workspace", anchor: "overview" }],
    ["/alerts", { topic: "alerts-inbox", anchor: "overview" }],
    ["/import", { topic: "import-wizard", anchor: "5-steps" }],
    ["/reports", { topic: "reports-workspace", anchor: "export-orchestration" }],
    ["/nlq", { topic: "nlq-workspace", anchor: "overview" }],
    ["/settings", { topic: "settings-center", anchor: "runtime" }],
    ["/developer", { topic: "developer-tools", anchor: "overview" }]
  ])("opens the correct contextual help target for %s", async (path, expectedPayload) => {
    renderAt(path);

    fireEvent.click(screen.getByRole("button", { name: "Help" }));

    await waitFor(() => {
      expect(openHelpWindowMock).toHaveBeenCalledWith(expectedPayload);
    });
  });

  it("uses fallback search entries when IPC is unavailable", async () => {
    renderSearchShell();

    expect(listVendorsMock).not.toHaveBeenCalled();
    expect(getGlobalSearchOptionValues()).toContain("Vendor: Okta");
    expect(getGlobalSearchOptionValues()).not.toContain("Vendor: Acme Platform");

    const globalSearch = screen.getByLabelText("Global search");
    fireEvent.change(globalSearch, {
      target: { value: "Endpoint Security" }
    });

    await waitFor(() => {
      expect(getGlobalSearchOptionValues()).toContain("Expense: Endpoint Security");
    });

    fireEvent.change(globalSearch, {
      target: { value: "Expense: Endpoint Security" }
    });
    fireEvent.keyDown(globalSearch, { key: "Enter" });

    await waitFor(() => {
      expect(screen.getByTestId("current-location")).toHaveTextContent(
        buildExpenseRoute("exp-2", "baseline")
      );
      expect(screen.getByTestId("page-title")).toHaveTextContent("Expenses");
    });
  });

  it("loads live IPC-backed search entries and uses canonical vendor/service/contract routes", async () => {
    isIpcAvailableMock.mockReturnValue(true);

    renderSearchShell();

    await waitFor(() => {
      expect(getSettingsMock).toHaveBeenCalledTimes(1);
      expect(listScenariosMock).toHaveBeenCalledTimes(1);
      expect(listVendorsMock).toHaveBeenCalledTimes(1);
      expect(listServicesMock).toHaveBeenCalledTimes(1);
      expect(listContractsMock).toHaveBeenCalledTimes(1);
      expect(listExpensesMock).toHaveBeenCalledWith({ scenarioId: "baseline" });
      expect(getGlobalSearchOptionValues()).toContain("Vendor: Acme Platform");
      expect(getGlobalSearchOptionValues()).toContain("Service: Spend Insights");
      expect(getGlobalSearchOptionValues()).toContain("Contract: CTR-LIVE-001");
      expect(getGlobalSearchOptionValues()).toContain("Expense: Baseline Platform Spend");
    });

    const globalSearch = screen.getByLabelText("Global search");
    const cases = [
      {
        label: "Vendor: Acme Platform",
        route: buildVendorRoute("vend-live"),
        title: "Vendors"
      },
      {
        label: "Service: Spend Insights",
        route: buildServiceRoute("svc-live"),
        title: "Services"
      },
      {
        label: "Contract: CTR-LIVE-001",
        route: buildContractRoute("ctr-live"),
        title: "Contracts"
      }
    ];

    for (const testCase of cases) {
      fireEvent.change(globalSearch, { target: { value: testCase.label } });
      fireEvent.keyDown(globalSearch, { key: "Enter" });

      await waitFor(() => {
        expect(screen.getByTestId("current-location")).toHaveTextContent(testCase.route);
        expect(screen.getByTestId("page-title")).toHaveTextContent(testCase.title);
      });
    }
  });

  it("navigates to a scenario-aware expense route from live global search", async () => {
    isIpcAvailableMock.mockReturnValue(true);

    renderSearchShell();

    await waitFor(() => {
      expect(listExpensesMock).toHaveBeenCalledWith({ scenarioId: "baseline" });
      expect(getGlobalSearchOptionValues()).toContain("Expense: Baseline Platform Spend");
    });

    fireEvent.change(screen.getByLabelText("Scenario selector"), {
      target: { value: "growth" }
    });

    await waitFor(() => {
      expect(listExpensesMock).toHaveBeenCalledWith({ scenarioId: "growth" });
      expect(getGlobalSearchOptionValues()).toContain("Expense: Growth Expansion Spend");
    });

    const globalSearch = screen.getByLabelText("Global search");
    fireEvent.change(globalSearch, {
      target: { value: "Expense: Growth Expansion Spend" }
    });
    fireEvent.keyDown(globalSearch, { key: "Enter" });

    await waitFor(() => {
      expect(screen.getByTestId("current-location")).toHaveTextContent(
        buildExpenseRoute("exp-live-growth", "growth")
      );
      expect(screen.getByTestId("page-title")).toHaveTextContent("Expenses");
    });
  });
});
