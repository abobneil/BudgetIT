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
  createOwner,
  createVendor,
  deleteVendor,
  getOwnerUsage,
  isIpcAvailable,
  type ContractRecord,
  type ExpenseLineRecord,
  listContracts,
  listDimensions,
  listExpenses,
  listOwners,
  listRecurrences,
  listScenarios,
  listServices,
  listTags,
  listTechCatalogEntries,
  listVendors,
  openHelpWindow,
  type OwnerOptionRecord,
  retireOwner,
  type ServiceRecord,
  updateVendor,
  type VendorRecord
} from "../../lib/ipcClient";
import { AppShell } from "../../app/AppShell";
import { AppRoutes } from "../../app/routes";
import { ScenarioProvider } from "../scenarios/ScenarioContext";
import { budgetItLightTheme } from "../../ui/theme";
import { VendorsPage } from "./VendorsPage";
import { INITIAL_VENDOR_RECORDS } from "./vendor-data";

vi.mock("../../lib/ipcClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/ipcClient")>();
  return {
    ...actual,
    createOwner: vi.fn(),
    createVendor: vi.fn(),
    deleteVendor: vi.fn(),
    getOwnerUsage: vi.fn(),
    isIpcAvailable: vi.fn(),
    listContracts: vi.fn(),
    listDimensions: vi.fn(),
    listExpenses: vi.fn(),
    listOwners: vi.fn(),
    listRecurrences: vi.fn(),
    listScenarios: vi.fn(),
    listServices: vi.fn(),
    listTags: vi.fn(),
    listTechCatalogEntries: vi.fn(),
    listVendors: vi.fn(),
    openHelpWindow: vi.fn(),
    retireOwner: vi.fn(),
    updateVendor: vi.fn()
  };
});

const createOwnerMock = vi.mocked(createOwner);
const createVendorMock = vi.mocked(createVendor);
const deleteVendorMock = vi.mocked(deleteVendor);
const getOwnerUsageMock = vi.mocked(getOwnerUsage);
const isIpcAvailableMock = vi.mocked(isIpcAvailable);
const listContractsMock = vi.mocked(listContracts);
const listDimensionsMock = vi.mocked(listDimensions);
const listExpensesMock = vi.mocked(listExpenses);
const listOwnersMock = vi.mocked(listOwners);
const listRecurrencesMock = vi.mocked(listRecurrences);
const listScenariosMock = vi.mocked(listScenarios);
const listServicesMock = vi.mocked(listServices);
const listTagsMock = vi.mocked(listTags);
const listTechCatalogEntriesMock = vi.mocked(listTechCatalogEntries);
const listVendorsMock = vi.mocked(listVendors);
const openHelpWindowMock = vi.mocked(openHelpWindow);
const retireOwnerMock = vi.mocked(retireOwner);
const updateVendorMock = vi.mocked(updateVendor);

const BASE_SCENARIOS = [
  {
    id: "baseline",
    name: "Baseline",
    approvalStatus: "draft" as const,
    isLocked: false,
    parentScenarioId: null,
    createdAt: "2026-03-08T00:00:00.000Z",
    updatedAt: "2026-03-08T00:00:00.000Z"
  }
];

const BASE_SERVICES: ServiceRecord[] = [
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
    id: "svc-defender",
    vendorId: "vend-msft",
    name: "Defender",
    status: "active" as const,
    ownerId: "owner-security-team",
    ownerTeam: "Security Team",
    annualSpendMinor: 84000,
    risk: "high" as const,
    replacementStatus: "not-started" as const,
    createdAt: "2026-03-08T00:00:00.000Z",
    updatedAt: "2026-03-08T00:00:00.000Z",
    deletedAt: null
  }
];

const BASE_CONTRACTS: ContractRecord[] = [
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
  }
];

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
    id: "exp-endpoint",
    scenarioId: "baseline",
    serviceId: "svc-defender",
    contractId: null,
    name: "Endpoint Security",
    expenseType: "recurring" as const,
    status: "committed" as const,
    amountMinor: 84000,
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

function mapVendors(): VendorRecord[] {
  return INITIAL_VENDOR_RECORDS.map((vendor) => ({
    id: vendor.id,
    name: vendor.name,
    website: null,
    notes: null,
    ownerId: vendor.ownerId,
    owner: vendor.owner,
    annualSpendMinor: vendor.annualSpendMinor,
    status: vendor.status,
    risk: vendor.risk,
    createdAt: "2026-03-08T00:00:00.000Z",
    updatedAt: "2026-03-08T00:00:00.000Z",
    deletedAt: null
  }));
}

function mapOwners(): OwnerOptionRecord[] {
  return Array.from(
    new Map(
      mapVendors().map((vendor) => [
        vendor.ownerId,
        {
          id: vendor.ownerId ?? "",
          name: vendor.owner ?? "",
          archivedAt: null,
          createdAt: "2026-03-08T00:00:00.000Z",
          updatedAt: "2026-03-08T00:00:00.000Z",
          vendorCount: mapVendors().filter((entry) => entry.ownerId === vendor.ownerId).length,
          serviceCount: BASE_SERVICES.filter((entry) => entry.ownerId === vendor.ownerId).length,
          contractCount: BASE_CONTRACTS.filter((entry) => entry.ownerId === vendor.ownerId).length
        }
      ])
    ).values()
  );
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

function renderVendorsPage() {
  return render(
    <FluentProvider theme={budgetItLightTheme}>
      <MemoryRouter initialEntries={["/vendors"]}>
        <ScenarioProvider>
          <VendorsPage />
        </ScenarioProvider>
      </MemoryRouter>
    </FluentProvider>
  );
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

describe("VendorsPage", () => {
  let vendors: VendorRecord[] = mapVendors();
  let owners: OwnerOptionRecord[] = mapOwners();

  beforeEach(() => {
    vendors = mapVendors();
    owners = mapOwners();

    isIpcAvailableMock.mockReturnValue(true);
    openHelpWindowMock.mockReset();
    openHelpWindowMock.mockResolvedValue({ ok: true });

    listScenariosMock.mockResolvedValue(BASE_SCENARIOS);
    listVendorsMock.mockImplementation(async () => vendors);
    listServicesMock.mockResolvedValue(BASE_SERVICES);
    listContractsMock.mockResolvedValue(BASE_CONTRACTS);
    listExpensesMock.mockResolvedValue(BASE_EXPENSES);
    listOwnersMock.mockImplementation(async () => owners);
    listTechCatalogEntriesMock.mockResolvedValue([]);
    listDimensionsMock.mockResolvedValue([]);
    listTagsMock.mockResolvedValue({ tags: [], assignments: [] });
    listRecurrencesMock.mockResolvedValue([]);

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
        vendors: vendors
          .filter((entry) => entry.ownerId === id)
          .map((entry) => ({ id: entry.id, name: entry.name })),
        services: BASE_SERVICES
          .filter((entry) => entry.ownerId === id)
          .map((entry) => ({ id: entry.id, name: entry.name })),
        contracts: BASE_CONTRACTS
          .filter((entry) => entry.ownerId === id)
          .map((entry) => ({ id: entry.id, contractNumber: entry.contractNumber }))
      };
    });

    retireOwnerMock.mockResolvedValue({
      owner: owners[0],
      vendors: [],
      services: [],
      contracts: []
    });

    createVendorMock.mockImplementation(async (payload) => {
      const created = {
        id: `vend-${payload.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        name: payload.name,
        website: payload.website ?? null,
        notes: payload.notes ?? null,
        ownerId: payload.ownerId ?? null,
        owner: payload.owner ?? null,
        annualSpendMinor: payload.annualSpendMinor ?? 0,
        status: payload.status ?? "active",
        risk: payload.risk ?? "low",
        createdAt: "2026-03-08T00:00:00.000Z",
        updatedAt: "2026-03-08T00:00:00.000Z",
        deletedAt: null
      };
      vendors = [...vendors, created].sort((left, right) => left.name.localeCompare(right.name));
      return created;
    });

    updateVendorMock.mockImplementation(async (payload) => {
      const current = vendors.find((entry) => entry.id === payload.id);
      if (!current) {
        return null;
      }
      const updated = {
        ...current,
        name: payload.name,
        ownerId: payload.ownerId ?? null,
        owner: payload.owner ?? null,
        annualSpendMinor: payload.annualSpendMinor ?? current.annualSpendMinor,
        status: payload.status ?? current.status,
        risk: payload.risk ?? current.risk,
        updatedAt: "2026-03-08T01:00:00.000Z"
      };
      vendors = vendors.map((entry) => (entry.id === payload.id ? updated : entry));
      return updated;
    });

    deleteVendorMock.mockImplementation(async (id) => {
      vendors = vendors.filter((entry) => entry.id !== id);
      return { ok: true, id };
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("shows linked counts and applies vendor filters across services and expenses pages", async () => {
    renderWorkspace("/vendors");

    await waitFor(() => {
      expect(screen.getByTestId("page-title")).toHaveTextContent("Vendors");
    });
    expect(screen.getByTestId("vendor-service-count-vend-aws")).toHaveTextContent("1");
    expect(screen.getByTestId("vendor-contract-count-vend-aws")).toHaveTextContent("1");

    const awsRow = screen.getByTestId("vendor-service-count-vend-aws").closest("tr");
    if (!awsRow) {
      throw new Error("Expected AWS vendor row.");
    }

    fireEvent.click(within(awsRow).getByRole("button", { name: "Open Services" }));
    await waitFor(() => {
      expect(screen.getByTestId("page-title")).toHaveTextContent("Services");
    });
    const servicesTable = screen.getByRole("table", { name: "Services table" });
    expect(within(servicesTable).getByText("Cloud Platform")).toBeInTheDocument();
    expect(within(servicesTable).queryByText("Defender")).not.toBeInTheDocument();

    cleanup();
    renderWorkspace("/vendors");
    await waitFor(() => {
      expect(screen.getByTestId("page-title")).toHaveTextContent("Vendors");
    });

    const awsRowAgain = screen.getByTestId("vendor-service-count-vend-aws").closest("tr");
    if (!awsRowAgain) {
      throw new Error("Expected AWS vendor row after returning to vendors.");
    }
    fireEvent.click(within(awsRowAgain).getByRole("button", { name: "Open Expenses" }));
    await waitFor(() => {
      expect(screen.getByTestId("page-title")).toHaveTextContent("Expenses");
    });
    const expensesTable = screen.getByRole("table", { name: "Expenses table" });
    expect(within(expensesTable).getByText("Cloud Compute")).toBeInTheDocument();
    expect(within(expensesTable).queryByText("Endpoint Security")).not.toBeInTheDocument();
  });

  it(
    "supports vendor creation and still blocks unsafe delete while allowing archive",
    async () => {
      renderWorkspace("/vendors");

      await screen.findByText("Vendors Workspace");
      fireEvent.click(screen.getByRole("button", { name: "Create Vendor" }));

      fireEvent.change(screen.getByLabelText("Vendor name"), {
        target: { value: "Acme Security" }
      });
      await addOwnerFromField("Vendor owner", "Security Operations");
      fireEvent.change(screen.getByLabelText("Vendor annual spend"), {
        target: { value: "500.00" }
      });

      const createButtons = screen.getAllByRole("button", { name: "Create" });
      fireEvent.click(createButtons[createButtons.length - 1]);
      expect(await screen.findByText("Vendor Acme Security created.")).toBeInTheDocument();
      expect(
        screen.getByTestId("vendor-service-count-vend-acme-security")
      ).toHaveTextContent("0");

      const awsRow = screen.getByTestId("vendor-service-count-vend-aws").closest("tr");
      if (!awsRow) {
        throw new Error("Expected AWS vendor row.");
      }

      fireEvent.click(within(awsRow).getByRole("button", { name: "Delete" }));
      expect(
        await screen.findByText(
          "Cannot delete vendor while linked services or contracts exist."
        )
      ).toBeInTheDocument();

      fireEvent.click(within(awsRow).getByRole("button", { name: "Archive" }));
      const archiveDialog = await screen.findByRole("dialog");
      fireEvent.click(
        within(archiveDialog).getByRole("button", { name: "Archive", hidden: true })
      );

      expect(await screen.findByText("Vendor AWS archived.")).toBeInTheDocument();

      const refreshedAwsRow = screen.getByTestId("vendor-service-count-vend-aws").closest("tr");
      if (!refreshedAwsRow) {
        throw new Error("Expected AWS vendor row after archive.");
      }
      fireEvent.click(within(refreshedAwsRow).getByRole("button", { name: "Open Services" }));
      await waitFor(() => {
        expect(screen.getByTestId("page-title")).toHaveTextContent("Services");
      });
      const servicesTable = screen.getByRole("table", { name: "Services table" });
      expect(within(servicesTable).getByText("Cloud Platform")).toBeInTheDocument();
    },
    15000
  );

  it(
    "opens the vendor form guide from the drawer",
    async () => {
      renderWorkspace("/vendors");

      await screen.findByText("Vendors Workspace");
      fireEvent.click(screen.getByRole("button", { name: "Create Vendor" }));
      fireEvent.click(screen.getByRole("button", { name: "Vendor Form Guide" }));

      await waitFor(() => {
        expect(openHelpWindowMock).toHaveBeenCalledWith({
          topic: "vendors-form",
          anchor: "createedit-vendor-form",
          q: "vendor form",
          context: "vendors:form"
        });
      });
      expect(screen.getByRole("button", { name: "Vendor Form Guide" })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Help Center" })).not.toBeInTheDocument();
      expect(screen.getByTestId("current-location")).not.toHaveTextContent("/help");
    },
    15000
  );

  it("shows vendor catalog suggestions in a scrollable list capped to 4 visible rows", async () => {
    listTechCatalogEntriesMock.mockResolvedValue(
      Array.from({ length: 12 }, (_, index) => ({
        id: `catalog-vendor-${index + 1}`,
        name: `Catalog Vendor ${String(index + 1).padStart(2, "0")}`,
        categories: ["software_vendor" as const],
        website: null,
        aliases: [],
        notes: null
      }))
    );

    renderVendorsPage();

    fireEvent.click(await screen.findByRole("button", { name: "Create Vendor" }));

    const vendorNameInput = screen.getByLabelText("Vendor name");
    fireEvent.focus(vendorNameInput);
    fireEvent.change(vendorNameInput, { target: { value: "Catalog Vendor" } });

    const listbox = await screen.findByRole("listbox", { name: "Vendor suggestions" });
    expect(listbox).toHaveAttribute("data-visible-limit", "4");
    expect(within(listbox).getAllByRole("option")).toHaveLength(12);

    fireEvent.mouseDown(within(listbox).getByRole("button", { name: "Catalog Vendor 01" }));
    expect(vendorNameInput).toHaveValue("Catalog Vendor 01");
    await waitFor(() => {
      expect(
        screen.queryByRole("listbox", { name: "Vendor suggestions" })
      ).not.toBeInTheDocument();
    });
  });

  it("filters vendors by shared owner directory options", async () => {
    renderVendorsPage();

    await screen.findByText("Vendors Workspace");
    fireEvent.change(screen.getByLabelText("Filter vendors by owner"), {
      target: { value: INITIAL_VENDOR_RECORDS[0].ownerId }
    });

    const vendorsTable = screen.getByRole("table", { name: "Vendors table" });
    expect(within(vendorsTable).getByText("Okta")).toBeInTheDocument();
    expect(within(vendorsTable).queryByText("AWS")).not.toBeInTheDocument();
  });
});
