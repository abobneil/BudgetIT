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
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createExpenseFromUnmatchedActual,
  createOwner,
  createService,
  type ContractRecord,
  type ExpenseLineRecord,
  exportReport,
  exportShowbackStatement,
  generateShowbackStatement,
  getOwnerUsage,
  isIpcAvailable,
  listAlerts,
  listContracts,
  listExpenses,
  listOwners,
  listServices,
  listUnmatchedActuals,
  listVendors,
  onAlertNavigate,
  openHelpWindow,
  type OwnerOptionRecord,
  pickDirectoryPath,
  previewReport,
  queryReport,
  retireOwner,
  reviewUnmatchedActual,
  type ServiceRecord,
  updateContract,
  type VendorRecord,
  updateService
} from "../../lib/ipcClient";
import { AppShell } from "../../app/AppShell";
import { AppRoutes } from "../../app/routes";
import { budgetItLightTheme } from "../../ui/theme";

vi.mock("../../lib/ipcClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/ipcClient")>();
  return {
    ...actual,
    createExpenseFromUnmatchedActual: vi.fn(),
    createOwner: vi.fn(),
    createService: vi.fn(),
    exportReport: vi.fn(),
    exportShowbackStatement: vi.fn(),
    generateShowbackStatement: vi.fn(),
    getOwnerUsage: vi.fn(),
    isIpcAvailable: vi.fn(),
    listAlerts: vi.fn(),
    listContracts: vi.fn(),
    listExpenses: vi.fn(),
    listOwners: vi.fn(),
    listServices: vi.fn(),
    listUnmatchedActuals: vi.fn(),
    listVendors: vi.fn(),
    onAlertNavigate: vi.fn(),
    openHelpWindow: vi.fn(),
    pickDirectoryPath: vi.fn(),
    previewReport: vi.fn(),
    queryReport: vi.fn(),
    retireOwner: vi.fn(),
    reviewUnmatchedActual: vi.fn(),
    updateContract: vi.fn(),
    updateService: vi.fn()
  };
});

const createExpenseFromUnmatchedActualMock = vi.mocked(createExpenseFromUnmatchedActual);
const createOwnerMock = vi.mocked(createOwner);
const createServiceMock = vi.mocked(createService);
const exportReportMock = vi.mocked(exportReport);
const exportShowbackStatementMock = vi.mocked(exportShowbackStatement);
const generateShowbackStatementMock = vi.mocked(generateShowbackStatement);
const getOwnerUsageMock = vi.mocked(getOwnerUsage);
const isIpcAvailableMock = vi.mocked(isIpcAvailable);
const listAlertsMock = vi.mocked(listAlerts);
const listContractsMock = vi.mocked(listContracts);
const listExpensesMock = vi.mocked(listExpenses);
const listOwnersMock = vi.mocked(listOwners);
const listServicesMock = vi.mocked(listServices);
const listUnmatchedActualsMock = vi.mocked(listUnmatchedActuals);
const listVendorsMock = vi.mocked(listVendors);
const onAlertNavigateMock = vi.mocked(onAlertNavigate);
const openHelpWindowMock = vi.mocked(openHelpWindow);
const pickDirectoryPathMock = vi.mocked(pickDirectoryPath);
const previewReportMock = vi.mocked(previewReport);
const queryReportMock = vi.mocked(queryReport);
const retireOwnerMock = vi.mocked(retireOwner);
const reviewUnmatchedActualMock = vi.mocked(reviewUnmatchedActual);
const updateContractMock = vi.mocked(updateContract);
const updateServiceMock = vi.mocked(updateService);

const BASE_VENDORS: VendorRecord[] = [
  {
    id: "vend-aws",
    name: "AWS",
    website: null,
    notes: null,
    ownerId: "owner-platform-engineering",
    owner: "Platform Engineering",
    annualSpendMinor: 5240000,
    status: "active" as const,
    risk: "medium" as const,
    createdAt: "2026-03-08T00:00:00.000Z",
    updatedAt: "2026-03-08T00:00:00.000Z",
    deletedAt: null
  },
  {
    id: "vend-okta",
    name: "Okta",
    website: null,
    notes: null,
    ownerId: "owner-it-operations",
    owner: "IT Operations",
    annualSpendMinor: 1820000,
    status: "active" as const,
    risk: "high" as const,
    createdAt: "2026-03-08T00:00:00.000Z",
    updatedAt: "2026-03-08T00:00:00.000Z",
    deletedAt: null
  }
];

function createBaseServices(): ServiceRecord[] {
  return [
    {
      id: "svc-cloud-platform",
      vendorId: "vend-aws",
      name: "Cloud Platform",
      status: "active" as const,
      ownerId: "owner-platform-engineering",
      ownerTeam: "Platform Engineering",
      annualSpendMinor: 240000,
      risk: "medium" as const,
      replacementStatus: "candidate-review" as const,
      createdAt: "2026-03-08T00:00:00.000Z",
      updatedAt: "2026-03-08T00:00:00.000Z",
      deletedAt: null
    },
    {
      id: "svc-identity-sso",
      vendorId: "vend-okta",
      name: "Identity SSO",
      status: "active" as const,
      ownerId: "owner-it-operations",
      ownerTeam: "IT Operations",
      annualSpendMinor: 99000,
      risk: "high" as const,
      replacementStatus: "not-started" as const,
      createdAt: "2026-03-08T00:00:00.000Z",
      updatedAt: "2026-03-08T00:00:00.000Z",
      deletedAt: null
    }
  ];
}

function createBaseContracts(): ContractRecord[] {
  return [
    {
      id: "ctr-cloud-ops",
      serviceId: "svc-cloud-platform",
      contractNumber: "CTR-CLOUD-OPS-07",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      renewalType: "manual" as const,
      renewalDate: "2026-12-31",
      noticePeriodDays: 30,
      ownerId: "owner-platform-engineering",
      owner: "Platform Engineering",
      lifecycleStatus: "active" as const,
      renewalAction: "manual-review" as const,
      createdAt: "2026-03-08T00:00:00.000Z",
      updatedAt: "2026-03-08T00:00:00.000Z",
      deletedAt: null
    },
    {
      id: "ctr-sso-main",
      serviceId: "svc-identity-sso",
      contractNumber: "CTR-SSO-001",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      renewalType: "manual" as const,
      renewalDate: "2026-12-31",
      noticePeriodDays: 30,
      ownerId: "owner-it-operations",
      owner: "IT Operations",
      lifecycleStatus: "active" as const,
      renewalAction: "manual-review" as const,
      createdAt: "2026-03-08T00:00:00.000Z",
      updatedAt: "2026-03-08T00:00:00.000Z",
      deletedAt: null
    },
    {
      id: "ctr-sso-burst",
      serviceId: "svc-identity-sso",
      contractNumber: "CTR-SSO-002",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      renewalType: "manual" as const,
      renewalDate: "2026-12-31",
      noticePeriodDays: 30,
      ownerId: "owner-it-operations",
      owner: "IT Operations",
      lifecycleStatus: "active" as const,
      renewalAction: "manual-review" as const,
      createdAt: "2026-03-08T00:00:00.000Z",
      updatedAt: "2026-03-08T00:00:00.000Z",
      deletedAt: null
    }
  ];
}

const BASE_EXPENSES: ExpenseLineRecord[] = [
  {
    id: "exp-cloud",
    scenarioId: "baseline",
    serviceId: "svc-cloud-platform",
    contractId: "ctr-cloud-ops",
    name: "Cloud Compute",
    expenseType: "recurring" as const,
    status: "approved" as const,
    amountMinor: 240000,
    currency: "USD",
    capexOpex: "opex" as const,
    glAccountCode: null,
    costCenterCode: null,
    fundingSource: null,
    startDate: "2026-01-01",
    endDate: null,
    createdAt: "2026-03-08T00:00:00.000Z",
    updatedAt: "2026-03-08T00:00:00.000Z",
    deletedAt: null
  },
  {
    id: "exp-sso",
    scenarioId: "baseline",
    serviceId: "svc-identity-sso",
    contractId: "ctr-sso-main",
    name: "Identity Seats",
    expenseType: "recurring" as const,
    status: "approved" as const,
    amountMinor: 99000,
    currency: "USD",
    capexOpex: "opex" as const,
    glAccountCode: null,
    costCenterCode: null,
    fundingSource: null,
    startDate: "2026-01-01",
    endDate: null,
    createdAt: "2026-03-08T00:00:00.000Z",
    updatedAt: "2026-03-08T00:00:00.000Z",
    deletedAt: null
  }
];

function createBaseOwners(): OwnerOptionRecord[] {
  return [
    {
      id: "owner-platform-engineering",
      name: "Platform Engineering",
      archivedAt: null,
      createdAt: "2026-03-08T00:00:00.000Z",
      updatedAt: "2026-03-08T00:00:00.000Z",
      vendorCount: 1,
      serviceCount: 1,
      contractCount: 1
    },
    {
      id: "owner-it-operations",
      name: "IT Operations",
      archivedAt: null,
      createdAt: "2026-03-08T00:00:00.000Z",
      updatedAt: "2026-03-08T00:00:00.000Z",
      vendorCount: 1,
      serviceCount: 1,
      contractCount: 2
    },
    {
      id: "owner-security-team",
      name: "Security Team",
      archivedAt: null,
      createdAt: "2026-03-08T00:00:00.000Z",
      updatedAt: "2026-03-08T00:00:00.000Z",
      vendorCount: 0,
      serviceCount: 0,
      contractCount: 0
    }
  ];
}

function renderWorkspace(initialPath: string) {
  return render(
    <FluentProvider theme={budgetItLightTheme}>
      <MemoryRouter initialEntries={[initialPath]}>
        <AppShell>
          <>
            <LocationProbe />
            <AppRoutes />
          </>
        </AppShell>
      </MemoryRouter>
    </FluentProvider>
  );
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="current-location">{`${location.pathname}${location.search}`}</div>;
}

async function addOwnerFromField(label: string, ownerName: string): Promise<void> {
  const input = screen.getByLabelText(label);
  fireEvent.focus(input);
  fireEvent.change(input, {
    target: { value: ownerName }
  });
  fireEvent.mouseDown(screen.getByRole("button", { name: `Add "${ownerName}"` }));
  await waitFor(() => {
    expect(input).toHaveValue(ownerName);
  });
}

describe("service and contract workspaces", () => {
  let services: ServiceRecord[] = createBaseServices();
  let contracts: ContractRecord[] = createBaseContracts();
  let owners: OwnerOptionRecord[] = createBaseOwners();

  beforeEach(() => {
    services = createBaseServices();
    contracts = createBaseContracts();
    owners = createBaseOwners();

    isIpcAvailableMock.mockReturnValue(true);
    openHelpWindowMock.mockReset();
    openHelpWindowMock.mockResolvedValue({ ok: true });

    listVendorsMock.mockResolvedValue(BASE_VENDORS);
    listServicesMock.mockImplementation(async () => services);
    listContractsMock.mockImplementation(async () => contracts);
    listExpensesMock.mockResolvedValue(BASE_EXPENSES);
    listOwnersMock.mockImplementation(async () => owners);
    listAlertsMock.mockResolvedValue([]);
    onAlertNavigateMock.mockReturnValue(() => undefined);
    listUnmatchedActualsMock.mockResolvedValue({
      scenarioId: "baseline",
      total: 0,
      items: []
    });
    queryReportMock.mockImplementation(async ({ query, scenarioId }) => {
      if (query === "actuals.unmatched.summary") {
        return {
          scenarioId,
          unmatchedCount: 0,
          unmatchedAmountMinor: 0,
          drivers: []
        };
      }
      if (query === "showback.summary") {
        return {
          statements: []
        };
      }
      if (query === "dataQuality.summary") {
        return {
          scenarioId,
          expenseCount: 0,
          missingCostCenterCount: 0,
          missingGlAccountCount: 0,
          missingCapexOpexCount: 0,
          missingRequiredTagCount: 0
        };
      }
      return {
        scenarioId,
        currency: "USD",
        staleForecast: false,
        spendTrend: [],
        variance: [],
        renewals: [],
        growth: [],
        taggingCompleteness: {
          totalExpenseLines: 0,
          taggedExpenseLines: 0,
          completenessRatio: 1
        },
        replacementStatus: {
          totalPlans: 0,
          replacementRequiredOpen: 0,
          byStatus: []
        },
        narrativeBlocks: []
      };
    });
    previewReportMock.mockResolvedValue({
      html: "<p>Preview</p>",
      scenarioId: "baseline",
      reportType: "dashboard.summary"
    });
    exportReportMock.mockResolvedValue({ files: {} });
    pickDirectoryPathMock.mockResolvedValue(null);
    generateShowbackStatementMock.mockResolvedValue({
      id: "showback-1",
      scenarioId: "baseline",
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
      groupBy: "cost_center",
      generatedAt: "2026-03-08T00:00:00.000Z",
      generatedBy: "tester",
      totalMinor: 0,
      currency: "USD"
    });
    exportShowbackStatementMock.mockResolvedValue({
      statement: {
        id: "showback-1",
        scenarioId: "baseline",
        periodStart: "2026-01-01",
        periodEnd: "2026-01-31",
        groupBy: "cost_center",
        generatedAt: "2026-03-08T00:00:00.000Z",
        generatedBy: "tester",
        totalMinor: 0,
        currency: "USD"
      },
      files: {}
    });
    reviewUnmatchedActualMock.mockResolvedValue({
      ok: true,
      transactionId: "txn-1",
      disposition: "matched"
    });
    createExpenseFromUnmatchedActualMock.mockResolvedValue({
      ok: true,
      transactionId: "txn-1",
      expenseLineId: "exp-1"
    });

    createOwnerMock.mockImplementation(async ({ name }) => {
      const created = {
        id: `owner-${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        name,
        archivedAt: null,
        createdAt: "2026-03-08T00:00:00.000Z",
        updatedAt: "2026-03-08T00:00:00.000Z",
        vendorCount: 0,
        serviceCount: 0,
        contractCount: 0
      };
      owners = [...owners, created].sort((left, right) => left.name.localeCompare(right.name));
      return created;
    });

    getOwnerUsageMock.mockImplementation(async (id) => {
      const owner = owners.find((entry) => entry.id === id);
      if (!owner) {
        throw new Error(`Owner not found: ${id}`);
      }
      return {
        owner,
        vendors: BASE_VENDORS.filter((entry) => entry.ownerId === id).map((entry) => ({
          id: entry.id,
          name: entry.name
        })),
        services: services.filter((entry) => entry.ownerId === id).map((entry) => ({
          id: entry.id,
          name: entry.name
        })),
        contracts: contracts.filter((entry) => entry.ownerId === id).map((entry) => ({
          id: entry.id,
          contractNumber: entry.contractNumber
        }))
      };
    });

    retireOwnerMock.mockResolvedValue({
      owner: owners[0],
      vendors: [],
      services: [],
      contracts: []
    });

    createServiceMock.mockImplementation(async (payload) => {
      const created = {
        id: `svc-${payload.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        vendorId: payload.vendorId,
        name: payload.name,
        status: payload.status ?? "active",
        ownerId: payload.ownerId ?? null,
        ownerTeam: payload.ownerTeam ?? null,
        annualSpendMinor: payload.annualSpendMinor ?? 0,
        risk: payload.risk ?? "low",
        replacementStatus: payload.replacementStatus ?? "not-started",
        createdAt: "2026-03-08T00:00:00.000Z",
        updatedAt: "2026-03-08T00:00:00.000Z",
        deletedAt: null
      };
      services = [...services, created];
      return created;
    });

    updateServiceMock.mockImplementation(async (payload) => {
      const current = services.find((entry) => entry.id === payload.id);
      if (!current) {
        return null;
      }
      const updated = {
        ...current,
        vendorId: payload.vendorId,
        name: payload.name,
        status: payload.status ?? current.status,
        ownerId: payload.ownerId ?? current.ownerId,
        ownerTeam: payload.ownerTeam ?? current.ownerTeam,
        annualSpendMinor: payload.annualSpendMinor ?? current.annualSpendMinor,
        risk: payload.risk ?? current.risk,
        replacementStatus: payload.replacementStatus ?? current.replacementStatus,
        updatedAt: "2026-03-08T01:00:00.000Z"
      };
      services = services.map((entry) => (entry.id === payload.id ? updated : entry));
      return updated;
    });

    updateContractMock.mockImplementation(async (payload) => {
      const current = contracts.find((entry) => entry.id === payload.id);
      if (!current) {
        return null;
      }
      const updated = {
        ...current,
        serviceId: payload.serviceId,
        contractNumber: payload.contractNumber ?? current.contractNumber,
        ownerId: payload.ownerId ?? current.ownerId,
        owner: payload.owner ?? current.owner,
        lifecycleStatus: payload.lifecycleStatus ?? current.lifecycleStatus,
        renewalAction: payload.renewalAction ?? current.renewalAction,
        updatedAt: "2026-03-08T01:00:00.000Z"
      };
      contracts = contracts.map((entry) => (entry.id === payload.id ? updated : entry));
      return updated;
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("keeps service-contract linkage counts consistent and opens linked contract", async () => {
    renderWorkspace("/services");

    await screen.findByText("Services Workspace");
    expect(
      screen.getByTestId("service-linked-count-svc-identity-sso")
    ).toHaveTextContent("2");

    const serviceRow = screen
      .getByTestId("service-linked-count-svc-identity-sso")
      .closest("tr");
    if (!serviceRow) {
      throw new Error("Expected Identity SSO table row.");
    }

    fireEvent.click(serviceRow);
    fireEvent.click(screen.getByRole("tab", { name: "Contracts" }));
    fireEvent.click(screen.getByRole("button", { name: "Open Contract CTR-SSO-001" }));

    await waitFor(() => {
      expect(screen.getByTestId("page-title")).toHaveTextContent("Contracts");
    });
    expect(screen.getByText("Contract Detail")).toBeInTheDocument();
    expect(screen.getAllByText("CTR-SSO-001").length).toBeGreaterThan(0);
    expect(
      screen.getByTestId("contract-linked-count-ctr-sso-main")
    ).toHaveTextContent("1");
  });

  it("supports service to contract to related alert navigation path", async () => {
    renderWorkspace("/services?service=svc-cloud-platform&tab=contracts");

    await screen.findByRole("button", { name: "Open Contract CTR-CLOUD-OPS-07" });
    fireEvent.click(
      screen.getByRole("button", { name: "Open Contract CTR-CLOUD-OPS-07" })
    );

    await waitFor(() => {
      expect(screen.getByTestId("page-title")).toHaveTextContent("Contracts");
    });

    fireEvent.click(screen.getByRole("button", { name: "Open Related Alert" }));

    await waitFor(() => {
      expect(screen.getByTestId("page-title")).toHaveTextContent("Alerts");
    });
    expect(screen.getByText("Alerts Inbox")).toBeInTheDocument();
  });

  it("opens replacement path from contracts workspace", async () => {
    renderWorkspace("/contracts?contract=ctr-cloud-ops");

    await screen.findByText("Contract Detail");
    fireEvent.click(screen.getByRole("button", { name: "Open Replacement Workspace" }));

    await waitFor(() => {
      expect(screen.getByTestId("page-title")).toHaveTextContent("Reports");
    });
    expect(screen.getByTestId("reports-scenario-context")).toHaveTextContent("Baseline");
  });

  it("opens the service form guide from the drawer", async () => {
    renderWorkspace("/services");

    await screen.findByText("Services Workspace");
    fireEvent.click(screen.getByRole("button", { name: "Create Service" }));
    fireEvent.click(screen.getByRole("button", { name: "Service Form Guide" }));

    await waitFor(() => {
      expect(openHelpWindowMock).toHaveBeenCalledWith({
        topic: "services-form",
        anchor: "createedit-service-form",
        q: "service form",
        context: "services:form"
      });
    });
    expect(screen.getByRole("button", { name: "Service Form Guide" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Help Center" })).not.toBeInTheDocument();
    expect(screen.getByTestId("current-location")).not.toHaveTextContent("/help");
  });

  it("accepts decimal annual spend values in the service form", async () => {
    renderWorkspace("/services");

    await screen.findByText("Services Workspace");
    fireEvent.click(screen.getByRole("button", { name: "Create Service" }));

    fireEvent.change(screen.getByLabelText("Service name"), {
      target: { value: "Acme Monitoring" }
    });
    await addOwnerFromField("Service owner", "Platform Ops");
    fireEvent.change(screen.getByLabelText("Service annual spend"), {
      target: { value: "500.00" }
    });
    fireEvent.change(screen.getByLabelText("Service vendor"), {
      target: { value: "vend-aws" }
    });

    const createButtons = screen.getAllByRole("button", { name: "Create" });
    fireEvent.click(createButtons[createButtons.length - 1]);

    expect(await screen.findByText("Service Acme Monitoring created.")).toBeInTheDocument();
    expect(screen.getAllByText("Acme Monitoring").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$500.00").length).toBeGreaterThan(0);
  });

  it("opens the contract form guide from the drawer", async () => {
    renderWorkspace("/contracts");

    await screen.findByText("Contracts Workspace");
    fireEvent.click(screen.getByRole("button", { name: "Create Contract" }));
    fireEvent.click(screen.getByRole("button", { name: "Contract Form Guide" }));

    await waitFor(() => {
      expect(openHelpWindowMock).toHaveBeenCalledWith({
        topic: "contracts-form",
        anchor: "createedit-contract-form",
        q: "contract form",
        context: "contracts:form"
      });
    });
    expect(screen.getByRole("button", { name: "Contract Form Guide" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Help Center" })).not.toBeInTheDocument();
    expect(screen.getByTestId("current-location")).not.toHaveTextContent("/help");
  });

  it("defaults contract owner from the selected service until manually changed", async () => {
    renderWorkspace("/contracts");

    await screen.findByText("Contracts Workspace");
    fireEvent.click(screen.getByRole("button", { name: "Create Contract" }));

    const ownerInput = screen.getByLabelText("Contract owner");
    await waitFor(() => {
      expect(ownerInput).toHaveValue("Platform Engineering");
    });

    fireEvent.change(screen.getByLabelText("Contract linked service"), {
      target: { value: "svc-identity-sso" }
    });
    await waitFor(() => {
      expect(ownerInput).toHaveValue("IT Operations");
    });

    fireEvent.focus(ownerInput);
    fireEvent.change(ownerInput, {
      target: { value: "Security Team" }
    });
    fireEvent.mouseDown(
      within(screen.getByRole("listbox", { name: "Owner options" })).getByRole("button", {
        name: /Security Team/i
      })
    );
    await waitFor(() => {
      expect(ownerInput).toHaveValue("Security Team");
    });

    fireEvent.change(screen.getByLabelText("Contract linked service"), {
      target: { value: "svc-cloud-platform" }
    });
    expect(ownerInput).toHaveValue("Security Team");
  });
});
