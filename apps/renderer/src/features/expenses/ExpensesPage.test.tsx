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
  assignTag,
  createExpense,
  createRecurrence,
  deleteExpense,
  deleteRecurrence,
  type ContractRecord,
  type DimensionRecord,
  type ExpenseLineRecord,
  isIpcAvailable,
  listContracts,
  listDimensions,
  listExpenses,
  listRecurrences,
  listServices,
  listTags,
  listVendors,
  openHelpWindow,
  type RecurrenceRuleRecord,
  type ServiceRecord,
  type TagAssignmentRecord,
  type TagRecord,
  unassignTag,
  updateExpense,
  updateRecurrence,
  type VendorRecord
} from "../../lib/ipcClient";
import { AppShell } from "../../app/AppShell";
import { AppRoutes } from "../../app/routes";
import { budgetItLightTheme } from "../../ui/theme";
import { ExpensesPage } from "./ExpensesPage";

vi.mock("../../lib/ipcClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/ipcClient")>();
  return {
    ...actual,
    assignTag: vi.fn(),
    createExpense: vi.fn(),
    createRecurrence: vi.fn(),
    deleteExpense: vi.fn(),
    deleteRecurrence: vi.fn(),
    isIpcAvailable: vi.fn(),
    listContracts: vi.fn(),
    listDimensions: vi.fn(),
    listExpenses: vi.fn(),
    listRecurrences: vi.fn(),
    listServices: vi.fn(),
    listTags: vi.fn(),
    listVendors: vi.fn(),
    openHelpWindow: vi.fn(),
    unassignTag: vi.fn(),
    updateExpense: vi.fn(),
    updateRecurrence: vi.fn()
  };
});

const assignTagMock = vi.mocked(assignTag);
const createExpenseMock = vi.mocked(createExpense);
const createRecurrenceMock = vi.mocked(createRecurrence);
const deleteExpenseMock = vi.mocked(deleteExpense);
const deleteRecurrenceMock = vi.mocked(deleteRecurrence);
const isIpcAvailableMock = vi.mocked(isIpcAvailable);
const listContractsMock = vi.mocked(listContracts);
const listDimensionsMock = vi.mocked(listDimensions);
const listExpensesMock = vi.mocked(listExpenses);
const listRecurrencesMock = vi.mocked(listRecurrences);
const listServicesMock = vi.mocked(listServices);
const listTagsMock = vi.mocked(listTags);
const listVendorsMock = vi.mocked(listVendors);
const openHelpWindowMock = vi.mocked(openHelpWindow);
const unassignTagMock = vi.mocked(unassignTag);
const updateExpenseMock = vi.mocked(updateExpense);
const updateRecurrenceMock = vi.mocked(updateRecurrence);

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
    id: "vend-msft",
    name: "Microsoft",
    website: null,
    notes: null,
    ownerId: "owner-security-team",
    owner: "Security Team",
    annualSpendMinor: 1310000,
    status: "watch" as const,
    risk: "high" as const,
    createdAt: "2026-03-08T00:00:00.000Z",
    updatedAt: "2026-03-08T00:00:00.000Z",
    deletedAt: null
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
  },
  {
    id: "ctr-ms-sec",
    serviceId: "svc-defender",
    contractNumber: "MS-SEC-2026",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    renewalType: "manual" as const,
    renewalDate: "2026-12-31",
    noticePeriodDays: 30,
    ownerId: "owner-security-team",
    owner: "Security Team",
    lifecycleStatus: "active" as const,
    renewalAction: "manual-review" as const,
    createdAt: "2026-03-08T00:00:00.000Z",
    updatedAt: "2026-03-08T00:00:00.000Z",
    deletedAt: null
  }
];

const BASE_DIMENSIONS: DimensionRecord[] = [
  {
    id: "dim-cost-center",
    name: "Cost Center",
    mode: "single_select" as const,
    required: true,
    createdAt: "2026-03-08T00:00:00.000Z",
    updatedAt: "2026-03-08T00:00:00.000Z"
  }
];

const BASE_TAGS: TagRecord[] = [
  {
    id: "tag-engineering",
    dimensionId: "dim-cost-center",
    name: "Engineering",
    parentTagId: null,
    createdAt: "2026-03-08T00:00:00.000Z",
    updatedAt: "2026-03-08T00:00:00.000Z",
    archivedAt: null
  },
  {
    id: "tag-security",
    dimensionId: "dim-cost-center",
    name: "Security",
    parentTagId: null,
    createdAt: "2026-03-08T00:00:00.000Z",
    updatedAt: "2026-03-08T00:00:00.000Z",
    archivedAt: null
  }
];

function createBaseExpenses(): ExpenseLineRecord[] {
  return [
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
      contractId: "ctr-ms-sec",
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
    },
    {
      id: "exp-analytics",
      scenarioId: "baseline",
      serviceId: "svc-cloud-platform",
      contractId: null,
      name: "Analytics Suite",
      expenseType: "recurring" as const,
      status: "planned" as const,
      amountMinor: 150000,
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
}

function createBaseRecurrences(): RecurrenceRuleRecord[] {
  return [
    {
      id: "rec-cloud",
      expenseLineId: "exp-cloud",
      frequency: "monthly" as const,
      interval: 1,
      dayOfMonth: 1,
      monthOfYear: null,
      anchorDate: "2026-01-01",
      createdAt: "2026-03-08T00:00:00.000Z",
      updatedAt: "2026-03-08T00:00:00.000Z"
    },
    {
      id: "rec-endpoint",
      expenseLineId: "exp-endpoint",
      frequency: "monthly" as const,
      interval: 1,
      dayOfMonth: 1,
      monthOfYear: null,
      anchorDate: "2026-01-01",
      createdAt: "2026-03-08T00:00:00.000Z",
      updatedAt: "2026-03-08T00:00:00.000Z"
    },
    {
      id: "rec-analytics",
      expenseLineId: "exp-analytics",
      frequency: "monthly" as const,
      interval: 1,
      dayOfMonth: 1,
      monthOfYear: null,
      anchorDate: "2026-01-01",
      createdAt: "2026-03-08T00:00:00.000Z",
      updatedAt: "2026-03-08T00:00:00.000Z"
    }
  ];
}

function createBaseAssignments(): TagAssignmentRecord[] {
  return [];
}

function renderExpensesPage() {
  return render(
    <FluentProvider theme={budgetItLightTheme}>
      <MemoryRouter>
        <ExpensesPage />
      </MemoryRouter>
    </FluentProvider>
  );
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="current-location">{`${location.pathname}${location.search}`}</div>;
}

function renderExpensesWorkspace(initialPath = "/expenses") {
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

function getDataRows() {
  const rows = screen.getAllByRole("row");
  return rows.slice(1);
}

describe("ExpensesPage", () => {
  let expenses: ExpenseLineRecord[] = createBaseExpenses();
  let recurrences: RecurrenceRuleRecord[] = createBaseRecurrences();
  let assignments: TagAssignmentRecord[] = createBaseAssignments();

  beforeEach(() => {
    expenses = createBaseExpenses();
    recurrences = createBaseRecurrences();
    assignments = createBaseAssignments();

    isIpcAvailableMock.mockReturnValue(true);
    openHelpWindowMock.mockReset();
    openHelpWindowMock.mockResolvedValue({ ok: true });

    listVendorsMock.mockResolvedValue(BASE_VENDORS);
    listServicesMock.mockResolvedValue(BASE_SERVICES);
    listContractsMock.mockResolvedValue(BASE_CONTRACTS);
    listDimensionsMock.mockResolvedValue(BASE_DIMENSIONS);
    listExpensesMock.mockImplementation(async () => expenses);
    listRecurrencesMock.mockImplementation(async () => recurrences);
    listTagsMock.mockImplementation(async () => ({
      tags: BASE_TAGS,
      assignments
    }));

    createExpenseMock.mockImplementation(async (payload) => {
      const created = {
        id: `exp-${payload.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        scenarioId: payload.scenarioId,
        serviceId: payload.serviceId,
        contractId: payload.contractId ?? null,
        name: payload.name,
        expenseType: payload.expenseType,
        status: payload.status,
        amountMinor: payload.amountMinor,
        currency: payload.currency ?? "USD",
        capexOpex: payload.capexOpex ?? "opex",
        glAccountCode: payload.glAccountCode ?? null,
        costCenterCode: payload.costCenterCode ?? null,
        fundingSource: payload.fundingSource ?? null,
        startDate: payload.startDate ?? "2026-01-01",
        endDate: payload.endDate ?? null,
        createdAt: "2026-03-08T00:00:00.000Z",
        updatedAt: "2026-03-08T00:00:00.000Z",
        deletedAt: null
      };
      expenses = [...expenses, created];
      if (payload.recurrence) {
        recurrences = [
          ...recurrences,
          {
            id: `rec-${created.id}`,
            expenseLineId: created.id,
            frequency: payload.recurrence.frequency,
            interval: payload.recurrence.interval,
            dayOfMonth: payload.recurrence.dayOfMonth,
            monthOfYear: payload.recurrence.monthOfYear ?? null,
            anchorDate: payload.recurrence.anchorDate ?? "2026-01-01",
            createdAt: "2026-03-08T00:00:00.000Z",
            updatedAt: "2026-03-08T00:00:00.000Z"
          }
        ];
      }
      return created;
    });

    updateExpenseMock.mockImplementation(async (payload) => {
      const current = expenses.find((expense) => expense.id === payload.id);
      if (!current) {
        return null;
      }
      const updated = {
        ...current,
        serviceId: payload.serviceId,
        contractId: payload.contractId ?? null,
        name: payload.name,
        status: payload.status,
        amountMinor: payload.amountMinor,
        updatedAt: "2026-03-08T01:00:00.000Z"
      };
      expenses = expenses.map((expense) => (expense.id === payload.id ? updated : expense));
      return updated;
    });

    deleteExpenseMock.mockImplementation(async (id) => {
      expenses = expenses.filter((expense) => expense.id !== id);
      return { ok: true, id };
    });

    createRecurrenceMock.mockImplementation(async (payload) => {
      const created = {
        id: `rec-${payload.expenseLineId}`,
        expenseLineId: payload.expenseLineId,
        frequency: payload.frequency,
        interval: payload.interval,
        dayOfMonth: payload.dayOfMonth,
        monthOfYear: payload.monthOfYear ?? null,
        anchorDate: payload.anchorDate ?? "2026-01-01",
        createdAt: "2026-03-08T00:00:00.000Z",
        updatedAt: "2026-03-08T00:00:00.000Z"
      };
      recurrences = [...recurrences.filter((entry) => entry.id !== created.id), created];
      return created;
    });

    updateRecurrenceMock.mockImplementation(async (payload) => {
      const current = recurrences.find((entry) => entry.id === payload.id);
      if (!current) {
        return null;
      }
      const updated = {
        ...current,
        frequency: payload.frequency,
        interval: payload.interval,
        dayOfMonth: payload.dayOfMonth,
        monthOfYear: payload.monthOfYear ?? null,
        anchorDate: payload.anchorDate ?? "2026-01-01",
        updatedAt: "2026-03-08T01:00:00.000Z"
      };
      recurrences = recurrences.map((entry) => (entry.id === payload.id ? updated : entry));
      return updated;
    });

    deleteRecurrenceMock.mockImplementation(async (id) => {
      recurrences = recurrences.filter((entry) => entry.id !== id);
      return { ok: true, id };
    });

    assignTagMock.mockImplementation(async (payload) => {
      assignments = [
        ...assignments.filter(
          (entry) =>
            !(
              entry.entityId === payload.entityId &&
              entry.dimensionId === payload.dimensionId
            )
        ),
        {
          id: `assign-${payload.entityId}-${payload.dimensionId}`,
          entityType: payload.entityType,
          entityId: payload.entityId,
          dimensionId: payload.dimensionId,
          tagId: payload.tagId,
          createdAt: "2026-03-08T00:00:00.000Z"
        }
      ];
      return assignments[assignments.length - 1];
    });

    unassignTagMock.mockImplementation(async (payload) => {
      assignments = assignments.filter(
        (entry) =>
          !(
            entry.entityId === payload.entityId &&
            entry.dimensionId === payload.dimensionId &&
            entry.tagId === payload.tagId
          )
      );
      return { ok: true };
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("applies search/filter and sort behavior to table rows", async () => {
    renderExpensesPage();
    const table = await screen.findByRole("table", { name: "Expenses table" });

    fireEvent.change(screen.getByLabelText("Search expenses"), {
      target: { value: "cloud" }
    });
    expect(within(table).getByText("Cloud Compute")).toBeInTheDocument();
    expect(within(table).queryByText("Endpoint Security")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search expenses"), {
      target: { value: "" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Amount" }));

    await waitFor(() => {
      const firstDataRow = getDataRows()[0];
      expect(within(firstDataRow).getByText("Endpoint Security")).toBeInTheDocument();
    });
  });

  it(
    "completes create/edit/delete via form and confirm dialogs without prompt()",
    async () => {
      const promptSpy = vi.spyOn(window, "prompt").mockImplementation(() => null);

      renderExpensesPage();
      const table = await screen.findByRole("table", { name: "Expenses table" });
      fireEvent.click(screen.getByRole("button", { name: "Create Expense" }));

      fireEvent.change(screen.getByLabelText("Expense name"), {
        target: { value: "Support Plan" }
      });
      fireEvent.change(screen.getByLabelText("Expense amount"), {
        target: { value: "50.00" }
      });
      fireEvent.change(screen.getByLabelText("Expense service"), {
        target: { value: "Cloud Platform" }
      });

      fireEvent.click(screen.getByRole("button", { name: "Create" }));
      await waitFor(() => {
        expect(within(table).getByText("Support Plan")).toBeInTheDocument();
      });

      const createdRow = getDataRows().find((row) => within(row).queryByText("Support Plan"));
      expect(createdRow).toBeDefined();
      fireEvent.click(within(createdRow as HTMLElement).getByRole("button", { name: "Edit" }));

      const nameInputs = screen.getAllByLabelText("Expense name");
      fireEvent.change(nameInputs[nameInputs.length - 1], {
        target: { value: "Support Plan Plus" }
      });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => {
        expect(within(table).getByText("Support Plan Plus")).toBeInTheDocument();
      });

      const editedRow = getDataRows().find((row) =>
        within(row).queryByText("Support Plan Plus")
      );
      expect(editedRow).toBeDefined();
      fireEvent.click(within(editedRow as HTMLElement).getByRole("button", { name: "Delete" }));

      const confirmButtons = screen.getAllByRole("button", { name: "Delete" });
      fireEvent.click(confirmButtons[confirmButtons.length - 1]);

      await waitFor(() => {
        expect(within(table).queryByText("Support Plan Plus")).not.toBeInTheDocument();
      });
      expect(promptSpy).not.toHaveBeenCalled();
      promptSpy.mockRestore();
    },
    15000
  );

  it("offers predictive suggestions for expense names and linked records", async () => {
    renderExpensesPage();

    await screen.findByRole("table", { name: "Expenses table" });
    fireEvent.click(screen.getByRole("button", { name: "Create Expense" }));

    const nameInput = screen.getByLabelText("Expense name");
    const serviceInput = screen.getByLabelText("Expense service");
    const contractInput = screen.getByLabelText("Expense contract");

    const nameListId = nameInput.getAttribute("list");
    const serviceListId = serviceInput.getAttribute("list");
    const contractListId = contractInput.getAttribute("list");

    expect(nameListId).toBeTruthy();
    expect(serviceListId).toBeTruthy();
    expect(contractListId).toBeTruthy();

    const getSuggestionValues = (listId: string | null) =>
      Array.from(document.querySelectorAll(`#${listId} option`)).map((option) =>
        option.getAttribute("value")
      );

    expect(getSuggestionValues(nameListId)).toEqual(
      expect.arrayContaining(["Cloud Compute", "Endpoint Security", "Analytics Suite"])
    );

    fireEvent.change(screen.getByLabelText("Expense vendor"), {
      target: { value: "vend-msft" }
    });

    expect(getSuggestionValues(serviceListId)).toEqual(["Defender"]);
    expect(getSuggestionValues(contractListId)).toEqual(["MS-SEC-2026"]);
  });

  it("applies bulk tag assignment and refreshes detail chips for selected rows", async () => {
    renderExpensesPage();

    await screen.findByRole("table", { name: "Expenses table" });
    const cloudRow = getDataRows().find((row) => within(row).queryByText("Cloud Compute"));
    const endpointRow = getDataRows().find((row) =>
      within(row).queryByText("Endpoint Security")
    );
    expect(cloudRow).toBeDefined();
    expect(endpointRow).toBeDefined();

    fireEvent.click(within(cloudRow as HTMLElement).getByRole("checkbox"));
    fireEvent.click(within(endpointRow as HTMLElement).getByRole("checkbox"));

    fireEvent.change(screen.getByLabelText("Bulk tag dimension"), {
      target: { value: "dim-cost-center" }
    });
    fireEvent.change(screen.getByLabelText("Bulk tag value"), {
      target: { value: "tag-security" }
    });
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Bulk Tag Entry" }));

    expect(
      await screen.findByText("Applied Security in Cost Center to 2 expense(s).")
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Security/i }).length).toBeGreaterThan(0);

    const refreshedRows = getDataRows();
    const refreshedEndpointRow = refreshedRows.find((row) =>
      within(row).queryByText("Endpoint Security")
    );
    expect(refreshedEndpointRow).toBeDefined();
    fireEvent.click(
      within(refreshedEndpointRow as HTMLElement).getByText("Endpoint Security")
    );
    expect(screen.getByText("Vendor: Microsoft")).toBeInTheDocument();
    expect(within(refreshedEndpointRow as HTMLElement).getByText(/^Security$/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Security/i }).length).toBeGreaterThan(0);
  });

  it("opens the expense form guide from the drawer", async () => {
    renderExpensesWorkspace("/expenses");

    await screen.findByRole("table", { name: "Expenses table" });
    fireEvent.click(screen.getByRole("button", { name: "Create Expense" }));
    fireEvent.click(screen.getByRole("button", { name: "Expense Form Guide" }));

    await waitFor(() => {
      expect(openHelpWindowMock).toHaveBeenCalledWith({
        topic: "expenses-form",
        anchor: "createedit-expense-form",
        q: "expense form",
        context: "expenses:form"
      });
    });
    expect(screen.getByRole("button", { name: "Expense Form Guide" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Help Center" })).not.toBeInTheDocument();
    expect(screen.getByTestId("current-location")).not.toHaveTextContent("/help");
  });
});
