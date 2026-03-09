import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Input,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  Title3
} from "@fluentui/react-components";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, GridApi, GridReadyEvent, RowClickedEvent } from "ag-grid-community";
import { useSearchParams } from "react-router-dom";

import {
  ConfirmDialog,
  EmptyState,
  FormDrawer,
  InlineError,
  PageHeader,
  StatusChip
} from "../../ui/primitives";
import { toTitleCaseLabel } from "../../ui/text/labelCase";
import { isAgGridAvailable } from "../../lib/agGrid";
import {
  buildSuggestionList,
  normalizeSuggestionValue
} from "../../lib/autocomplete";
import {
  buildCurrencyInputExample,
  formatCurrencyInputMinor,
  formatCurrencyMinor,
  parseCurrencyInputToMinor,
  useScenarioCurrency
} from "../../lib/currency";
import {
  assignTag as assignTagIpc,
  createExpense as createExpenseIpc,
  createRecurrence as createRecurrenceIpc,
  deleteExpense as deleteExpenseIpc,
  deleteRecurrence as deleteRecurrenceIpc,
  isIpcAvailable,
  listContracts as listContractsIpc,
  listDimensions as listDimensionsIpc,
  listExpenses as listExpensesIpc,
  listRecurrences as listRecurrencesIpc,
  listServices as listServicesIpc,
  listTags as listTagsIpc,
  listVendors as listVendorsIpc,
  openHelpWindow,
  unassignTag as unassignTagIpc,
  updateExpense as updateExpenseIpc,
  updateRecurrence as updateRecurrenceIpc,
  type ContractRecord as IpcContractRecord,
  type DimensionRecord as IpcDimensionRecord,
  type RecurrenceRuleRecord as IpcRecurrenceRuleRecord,
  type ServiceRecord as IpcServiceRecord,
  type TagRecord as IpcTagRecord,
  type VendorRecord as IpcVendorRecord
} from "../../lib/ipcClient";
import { useScenarioContext } from "../scenarios/ScenarioContext";
import { TAG_DIMENSIONS } from "../tags/tagging-fixtures";
import {
  removeTag,
  type DimensionDefinition,
  type TagAssignments
} from "../tags/tagging-model";
import {
  buildVendorFilterOptions,
  matchesVendorFilter
} from "../vendors/vendor-filter-model";
import {
  generateRecurrencePreview,
  type RecurrencePreviewRule
} from "./recurrence-preview";
import "./ExpensesPage.css";

type ExpenseStatus = "planned" | "approved" | "committed" | "actual" | "cancelled";
type SortKey = "name" | "amount" | "status";
type SortDirection = "asc" | "desc";

type ExpenseRecord = {
  id: string;
  name: string;
  amountMinor: number;
  status: ExpenseStatus;
  vendorId: string;
  vendorName: string;
  serviceId: string;
  serviceName: string;
  contractId: string | null;
  contractNumber: string;
  tags: string[];
  tagAssignments: TagAssignments;
  recurrenceRule: RecurrencePreviewRule;
};

const STATUS_OPTIONS: ExpenseStatus[] = [
  "planned",
  "approved",
  "committed",
  "actual",
  "cancelled"
];

const INITIAL_EXPENSES: ExpenseRecord[] = [
  {
    id: "exp-1",
    name: "Cloud Compute",
    amountMinor: 240000,
    status: "approved",
    vendorId: "vend-aws",
    vendorName: "AWS",
    serviceId: "svc-aws-core",
    serviceName: "AWS",
    contractId: "ctr-aws-2026-base",
    contractNumber: "AWS-2026-BASE",
    tags: ["infra", "production"],
    tagAssignments: {
      "dim-cost-center": ["tag-engineering"],
      "dim-environment": ["tag-prod"]
    },
    recurrenceRule: {
      frequency: "monthly",
      interval: 1,
      dayOfMonth: 31,
      anchorDate: "2026-01-31"
    }
  },
  {
    id: "exp-2",
    name: "Endpoint Security",
    amountMinor: 84000,
    status: "planned",
    vendorId: "vend-msft",
    vendorName: "Microsoft",
    serviceId: "svc-msft-defender",
    serviceName: "Defender",
    contractId: "ctr-ms-sec-2026",
    contractNumber: "MS-SEC-2026",
    tags: ["security"],
    tagAssignments: {},
    recurrenceRule: {
      frequency: "monthly",
      interval: 1,
      dayOfMonth: 15,
      anchorDate: "2026-01-15"
    }
  },
  {
    id: "exp-3",
    name: "Analytics Suite",
    amountMinor: 125000,
    status: "committed",
    vendorId: "vend-datadog",
    vendorName: "Datadog",
    serviceId: "svc-datadog-looker",
    serviceName: "Looker",
    contractId: "ctr-look-anl-01",
    contractNumber: "LOOK-ANL-01",
    tags: ["bi", "finance"],
    tagAssignments: {
      "dim-cost-center": ["tag-finance"],
      "dim-initiative": ["tag-growth"]
    },
    recurrenceRule: {
      frequency: "quarterly",
      interval: 1,
      dayOfMonth: 30,
      anchorDate: "2026-02-01"
    }
  }
];

type ExpenseFormState = {
  name: string;
  amountMinor: string;
  status: ExpenseStatus;
  vendorId: string;
  serviceName: string;
  contractNumber: string;
  tagsCsv: string;
  recurrenceFrequency: RecurrencePreviewRule["frequency"];
  recurrenceInterval: string;
  recurrenceDayOfMonth: string;
  recurrenceAnchorDate: string;
};

function createDefaultFormState(vendorId = "vend-aws", currency: string = "USD"): ExpenseFormState {
  return {
    name: "",
    amountMinor: formatCurrencyInputMinor(0, currency),
    status: "planned",
    vendorId,
    serviceName: "",
    contractNumber: "",
    tagsCsv: "",
    recurrenceFrequency: "monthly",
    recurrenceInterval: "1",
    recurrenceDayOfMonth: "1",
    recurrenceAnchorDate: new Date().toISOString().slice(0, 10)
  };
}

function compareExpense(
  left: ExpenseRecord,
  right: ExpenseRecord,
  sortKey: SortKey,
  direction: SortDirection
): number {
  const multiplier = direction === "asc" ? 1 : -1;
  if (sortKey === "amount") {
    return (left.amountMinor - right.amountMinor) * multiplier;
  }
  if (sortKey === "status") {
    return left.status.localeCompare(right.status) * multiplier;
  }
  return left.name.localeCompare(right.name) * multiplier;
}

function statusToTone(status: ExpenseStatus): "info" | "success" | "warning" | "danger" {
  if (status === "approved" || status === "actual") {
    return "success";
  }
  if (status === "committed") {
    return "warning";
  }
  if (status === "cancelled") {
    return "danger";
  }
  return "info";
}

function fromExpense(expense: ExpenseRecord, currency: string = "USD"): ExpenseFormState {
  return {
    name: expense.name,
    amountMinor: formatCurrencyInputMinor(expense.amountMinor, currency),
    status: expense.status,
    vendorId: expense.vendorId,
    serviceName: expense.serviceName,
    contractNumber: expense.contractNumber,
    tagsCsv: expense.tags.join(", "),
    recurrenceFrequency: expense.recurrenceRule.frequency,
    recurrenceInterval: String(expense.recurrenceRule.interval),
    recurrenceDayOfMonth: String(expense.recurrenceRule.dayOfMonth),
    recurrenceAnchorDate: expense.recurrenceRule.anchorDate
  };
}

function applyTagAssignment(
  assignments: TagAssignments,
  dimension: DimensionDefinition,
  tagId: string
): TagAssignments {
  const current = assignments[dimension.id] ?? [];
  if (dimension.mode === "single_select") {
    return {
      ...assignments,
      [dimension.id]: [tagId]
    };
  }
  if (current.includes(tagId)) {
    return assignments;
  }
  return {
    ...assignments,
    [dimension.id]: [...current, tagId]
  };
}

function getAssignedTagLabels(
  assignments: TagAssignments,
  dimensions: DimensionDefinition[]
): string[] {
  return dimensions.flatMap((dimension) =>
    (assignments[dimension.id] ?? [])
      .map((tagId) => dimension.tags.find((tag) => tag.id === tagId)?.label ?? null)
      .filter((value): value is string => value !== null)
  );
}

function findTagByLabelOrId(
  dimension: DimensionDefinition,
  value: string
): { id: string; label: string } | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  const match = dimension.tags.find(
    (tag) =>
      !tag.retired &&
      (tag.id.toLowerCase() === normalized || tag.label.toLowerCase() === normalized)
  );
  if (!match) {
    return null;
  }
  return {
    id: match.id,
    label: match.label
  };
}

function mapIpcDimensions(
  dimensionRows: IpcDimensionRecord[],
  tagRows: IpcTagRecord[]
): DimensionDefinition[] {
  return dimensionRows.map((dimension) => ({
    id: dimension.id,
    name: dimension.name,
    mode: dimension.mode,
    required: dimension.required,
    tags: tagRows
      .filter((tag) => tag.dimensionId === dimension.id)
      .map((tag) => ({
        id: tag.id,
        label: tag.name,
        retired: tag.archivedAt !== null
      }))
  }));
}

export function ExpensesPage() {
  const hasIpc = isIpcAvailable();
  const useAgGrid = isAgGridAvailable();
  const { selectedScenarioId, selectScenario } = useScenarioContext();
  const displayCurrency = useScenarioCurrency(selectedScenarioId);
  const [searchParams, setSearchParams] = useSearchParams();
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(INITIAL_EXPENSES);
  const [dimensions, setDimensions] = useState<DimensionDefinition[]>(() =>
    structuredClone(TAG_DIMENSIONS)
  );
  const [vendors, setVendors] = useState<IpcVendorRecord[]>([]);
  const [services, setServices] = useState<IpcServiceRecord[]>([]);
  const [contracts, setContracts] = useState<IpcContractRecord[]>([]);
  const [recurrences, setRecurrences] = useState<IpcRecurrenceRuleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [vendorFilter, setVendorFilter] = useState<string>(() => {
    return searchParams.get("vendor") ?? "all";
  });
  const [statusFilter, setStatusFilter] = useState<ExpenseStatus | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(() => {
    return searchParams.get("expense") ?? INITIAL_EXPENSES[0]?.id ?? null;
  });
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create");
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [formState, setFormState] = useState<ExpenseFormState>(() =>
    createDefaultFormState(INITIAL_EXPENSES[0]?.vendorId ?? "vend-aws", displayCurrency)
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);
  const [bulkTagDimensionId, setBulkTagDimensionId] = useState(
    TAG_DIMENSIONS[0]?.id ?? ""
  );
  const [bulkTagId, setBulkTagId] = useState("");
  const [detailTagDimensionId, setDetailTagDimensionId] = useState(
    TAG_DIMENSIONS[0]?.id ?? ""
  );
  const [detailTagQuery, setDetailTagQuery] = useState("");
  const [pageMessage, setPageMessage] = useState<string | null>(null);
  const [expensesGridApi, setExpensesGridApi] = useState<GridApi<ExpenseRecord> | null>(null);
  const amountExample = useMemo(
    () => buildCurrencyInputExample(displayCurrency),
    [displayCurrency]
  );
  const expenseNameSuggestionsId = useId();
  const expenseServiceSuggestionsId = useId();
  const expenseContractSuggestionsId = useId();

  const vendorOptions = useMemo(
    () =>
      buildVendorFilterOptions(
        hasIpc
          ? vendors.map((vendor) => ({
              vendorId: vendor.id,
              vendorName: vendor.name
            }))
          : expenses.map((expense) => ({
              vendorId: expense.vendorId,
              vendorName: expense.vendorName
            }))
      ),
    [expenses, hasIpc, vendors]
  );
  const vendorNamesById = useMemo(
    () =>
      Object.fromEntries(vendorOptions.map((option) => [option.value, option.label])),
    [vendorOptions]
  );
  const expenseNameSuggestions = useMemo(
    () => buildSuggestionList(expenses.map((expense) => expense.name)),
    [expenses]
  );
  const serviceSuggestions = useMemo(() => {
    if (hasIpc) {
      return buildSuggestionList(
        services
          .filter((service) => service.vendorId === formState.vendorId)
          .map((service) => service.name)
      );
    }

    return buildSuggestionList(
      expenses
        .filter((expense) => expense.vendorId === formState.vendorId)
        .map((expense) => expense.serviceName)
    );
  }, [expenses, formState.vendorId, hasIpc, services]);
  const matchedServiceId = useMemo(() => {
    if (!hasIpc) {
      return null;
    }

    const normalizedServiceName = normalizeSuggestionValue(formState.serviceName);
    if (!normalizedServiceName) {
      return null;
    }

    return (
      services.find(
        (service) =>
          service.vendorId === formState.vendorId &&
          normalizeSuggestionValue(service.name) === normalizedServiceName
      )?.id ?? null
    );
  }, [formState.serviceName, formState.vendorId, hasIpc, services]);
  const contractSuggestions = useMemo(() => {
    if (hasIpc) {
      const candidateServiceIds =
        matchedServiceId !== null
          ? [matchedServiceId]
          : services
              .filter((service) => service.vendorId === formState.vendorId)
              .map((service) => service.id);

      return buildSuggestionList(
        contracts
          .filter((contract) => candidateServiceIds.includes(contract.serviceId))
          .map((contract) => contract.contractNumber ?? "")
      );
    }

    const normalizedServiceName = normalizeSuggestionValue(formState.serviceName);
    return buildSuggestionList(
      expenses
        .filter((expense) => {
          if (expense.vendorId !== formState.vendorId) {
            return false;
          }
          if (!normalizedServiceName) {
            return true;
          }
          return (
            normalizeSuggestionValue(expense.serviceName) === normalizedServiceName
          );
        })
        .map((expense) => expense.contractNumber)
    );
  }, [
    contracts,
    expenses,
    formState.serviceName,
    formState.vendorId,
    hasIpc,
    matchedServiceId,
    services
  ]);

  const loadWorkspaceData = useCallback(async () => {
    if (!hasIpc) {
      return;
    }
    setLoading(true);
    try {
      const [vendorRows, serviceRows, contractRows, expenseRows, recurrenceRows, tagRows, dimensionRows] =
        await Promise.all([
          listVendorsIpc(),
          listServicesIpc(),
          listContractsIpc(),
          listExpensesIpc({ scenarioId: selectedScenarioId }),
          listRecurrencesIpc(),
          listTagsIpc({ entityType: "expense_line" }),
          listDimensionsIpc()
        ]);

      const vendorById = new Map(vendorRows.map((vendor) => [vendor.id, vendor]));
      const serviceById = new Map(serviceRows.map((service) => [service.id, service]));
      const contractById = new Map(contractRows.map((contract) => [contract.id, contract]));
      const recurrenceByExpenseId = new Map(
        recurrenceRows.map((recurrence) => [recurrence.expenseLineId, recurrence])
      );
      const assignmentsByExpenseId = new Map<string, TagAssignments>();
      for (const assignment of tagRows.assignments) {
        if (assignment.entityType !== "expense_line") {
          continue;
        }
        const existing = assignmentsByExpenseId.get(assignment.entityId) ?? {};
        const forDimension = existing[assignment.dimensionId] ?? [];
        existing[assignment.dimensionId] = forDimension.includes(assignment.tagId)
          ? forDimension
          : [...forDimension, assignment.tagId];
        assignmentsByExpenseId.set(assignment.entityId, existing);
      }
      const mappedDimensions = mapIpcDimensions(dimensionRows, tagRows.tags);
      const mappedExpenses: ExpenseRecord[] = expenseRows.map((expense) => {
        const service = serviceById.get(expense.serviceId);
        const vendor = service ? vendorById.get(service.vendorId) : undefined;
        const contract = expense.contractId ? contractById.get(expense.contractId) : undefined;
        const recurrence = recurrenceByExpenseId.get(expense.id);
        const tagAssignments = assignmentsByExpenseId.get(expense.id) ?? {};
        return {
          id: expense.id,
          name: expense.name,
          amountMinor: expense.amountMinor,
          status: expense.status,
          vendorId: service?.vendorId ?? "",
          vendorName: vendor?.name ?? service?.vendorId ?? "Unassigned",
          serviceId: expense.serviceId,
          serviceName: service?.name ?? expense.serviceId,
          contractId: expense.contractId ?? null,
          contractNumber: contract?.contractNumber ?? expense.contractId ?? "",
          tags: getAssignedTagLabels(tagAssignments, mappedDimensions),
          tagAssignments,
          recurrenceRule: {
            frequency: recurrence?.frequency ?? "monthly",
            interval: recurrence?.interval ?? 1,
            dayOfMonth: recurrence?.dayOfMonth ?? 1,
            anchorDate: recurrence?.anchorDate ?? new Date().toISOString().slice(0, 10)
          }
        };
      });

      setVendors(vendorRows);
      setServices(serviceRows);
      setContracts(contractRows);
      setRecurrences(recurrenceRows);
      setDimensions(mappedDimensions.length > 0 ? mappedDimensions : []);
      setExpenses(mappedExpenses);
      if (!mappedExpenses.some((entry) => entry.id === selectedExpenseId)) {
        setSelectedExpenseId(mappedExpenses[0]?.id ?? null);
      }
      if (mappedDimensions.length > 0) {
        setBulkTagDimensionId((current) => {
          if (mappedDimensions.some((dimension) => dimension.id === current)) {
            return current;
          }
          return mappedDimensions[0].id;
        });
        setDetailTagDimensionId((current) => {
          if (mappedDimensions.some((dimension) => dimension.id === current)) {
            return current;
          }
          return mappedDimensions[0].id;
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setPageMessage(`Failed to load expenses workspace: ${message}`);
    } finally {
      setLoading(false);
    }
  }, [hasIpc, selectedExpenseId, selectedScenarioId]);

  useEffect(() => {
    void loadWorkspaceData();
  }, [loadWorkspaceData]);

  useEffect(() => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (vendorFilter === "all") {
          next.delete("vendor");
        } else {
          next.set("vendor", vendorFilter);
        }
        if (selectedExpenseId) {
          next.set("expense", selectedExpenseId);
        } else {
          next.delete("expense");
        }
        next.set("scenario", selectedScenarioId);
        return next;
      },
      { replace: true }
    );
  }, [selectedExpenseId, selectedScenarioId, setSearchParams, vendorFilter]);

  useEffect(() => {
    const scenarioFromUrl = searchParams.get("scenario");
    if (scenarioFromUrl && scenarioFromUrl !== selectedScenarioId) {
      selectScenario(scenarioFromUrl);
      return;
    }

    const focusedExpenseId = searchParams.get("expense");
    if (focusedExpenseId && expenses.some((expense) => expense.id === focusedExpenseId)) {
      setSelectedExpenseId(focusedExpenseId);
    }

    const action = searchParams.get("action");
    if (action === "create" && !drawerOpen) {
      setDrawerMode("create");
      setEditingExpenseId(null);
      setFormState(
        createDefaultFormState(vendorOptions[0]?.value ?? "vend-aws", displayCurrency)
      );
      setFormError(null);
      setDrawerOpen(true);
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.delete("action");
          return next;
        },
        { replace: true }
      );
    }
  }, [
    drawerOpen,
    displayCurrency,
    expenses,
    searchParams,
    selectScenario,
    selectedScenarioId,
    setSearchParams,
    vendorOptions
  ]);

  const filteredExpenses = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return expenses
      .filter((expense) => {
        const assignedLabels = getAssignedTagLabels(expense.tagAssignments, dimensions);
        if (!matchesVendorFilter(vendorFilter, expense.vendorId)) {
          return false;
        }
        if (statusFilter !== "all" && expense.status !== statusFilter) {
          return false;
        }
        if (!query) {
          return true;
        }
        return (
          expense.name.toLowerCase().includes(query) ||
          expense.vendorName.toLowerCase().includes(query) ||
          expense.serviceName.toLowerCase().includes(query) ||
          expense.contractNumber.toLowerCase().includes(query) ||
          expense.tags.some((tag) => tag.toLowerCase().includes(query)) ||
          assignedLabels.some((tag) => tag.toLowerCase().includes(query))
        );
      })
      .sort((left, right) => compareExpense(left, right, sortKey, sortDirection));
  }, [
    dimensions,
    expenses,
    searchText,
    sortDirection,
    sortKey,
    statusFilter,
    vendorFilter
  ]);

  const selectedExpense = useMemo(
    () =>
      filteredExpenses.find((expense) => expense.id === selectedExpenseId) ??
      filteredExpenses[0] ??
      null,
    [filteredExpenses, selectedExpenseId]
  );

  const recurrencePreview = useMemo(() => {
    if (!selectedExpense) {
      return [];
    }
    return generateRecurrencePreview(selectedExpense.recurrenceRule, 12);
  }, [selectedExpense]);

  const expenseGridColumns = useMemo<ColDef<ExpenseRecord>[]>(
    () => [
      {
        headerName: "Select",
        field: "id",
        sortable: false,
        filter: false,
        width: 88,
        cellRenderer: (params: { data?: ExpenseRecord }) => {
          if (!params.data) {
            return null;
          }
          return (
            <Checkbox
              checked={selectedRowIds.includes(params.data.id)}
              onChange={(event) => {
                event.stopPropagation();
                toggleRowSelection(params.data!.id);
              }}
            />
          );
        }
      },
      {
        headerName: "Name",
        field: "name",
        sortable: true,
        filter: "agTextColumnFilter",
        minWidth: 190
      },
      {
        headerName: "Amount",
        field: "amountMinor",
        sortable: true,
        filter: "agNumberColumnFilter",
        minWidth: 140,
        valueFormatter: (params) =>
          formatCurrencyMinor(Number(params.value ?? 0), displayCurrency)
      },
      {
        headerName: "Status",
        field: "status",
        sortable: true,
        filter: "agTextColumnFilter",
        minWidth: 138,
        cellRenderer: (params: { value?: ExpenseStatus }) =>
          params.value ? (
            <StatusChip
              label={toTitleCaseLabel(params.value)}
              tone={statusToTone(params.value)}
            />
          ) : null
      },
      {
        headerName: "Vendor",
        field: "vendorName",
        sortable: true,
        filter: "agTextColumnFilter",
        minWidth: 140
      },
      {
        headerName: "Service",
        field: "serviceName",
        sortable: true,
        filter: "agTextColumnFilter",
        minWidth: 140
      },
      {
        headerName: "Contract",
        field: "contractNumber",
        sortable: true,
        filter: "agTextColumnFilter",
        minWidth: 150,
        valueGetter: (params) => params.data?.contractNumber || "Unassigned"
      },
      {
        headerName: "Tags",
        field: "tags",
        sortable: false,
        filter: "agTextColumnFilter",
        minWidth: 200,
        valueGetter: (params) => {
          if (!params.data) {
            return "";
          }
          return Array.from(
            new Set([
              ...params.data.tags,
              ...getAssignedTagLabels(params.data.tagAssignments, dimensions)
            ])
          ).join(", ");
        }
      },
      {
        headerName: "Actions",
        field: "id",
        sortable: false,
        filter: false,
        minWidth: 170,
        cellRenderer: (params: { data?: ExpenseRecord }) => {
          if (!params.data) {
            return null;
          }
          return (
            <div className="expenses-row__actions">
              <Button
                size="small"
                appearance="secondary"
                onClick={(event) => {
                  event.stopPropagation();
                  openEditDrawer(params.data!);
                }}
              >
                Edit
              </Button>
              <Button
                size="small"
                appearance="secondary"
                onClick={(event) => {
                  event.stopPropagation();
                  setDeleteExpenseId(params.data!.id);
                }}
              >
                Delete
              </Button>
            </div>
          );
        }
      }
    ],
    [dimensions, selectedRowIds]
  );

  function onExpensesGridReady(event: GridReadyEvent<ExpenseRecord>): void {
    setExpensesGridApi(event.api);
  }

  function onExpensesGridRowClick(event: RowClickedEvent<ExpenseRecord>): void {
    if (!event.data) {
      return;
    }
    focusExpense(event.data.id);
  }

  function toggleSort(nextSortKey: SortKey): void {
    if (sortKey === nextSortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextSortKey);
    setSortDirection("asc");
  }

  function focusExpense(expenseId: string | null): void {
    setSelectedExpenseId(expenseId);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (expenseId) {
          next.set("expense", expenseId);
        } else {
          next.delete("expense");
        }
        return next;
      },
      { replace: true }
    );
  }

  function openCreateDrawer(): void {
    setDrawerMode("create");
    setEditingExpenseId(null);
    setFormState(createDefaultFormState(vendorOptions[0]?.value ?? "vend-aws", displayCurrency));
    setFormError(null);
    setDrawerOpen(true);
  }

  function openEditDrawer(expense: ExpenseRecord): void {
    setDrawerMode("edit");
    setEditingExpenseId(expense.id);
    setFormState(fromExpense(expense, displayCurrency));
    setFormError(null);
    setDrawerOpen(true);
  }

  function handleSubmitDrawer(): void {
    const trimmedName = formState.name.trim();
    const amountMinor = parseCurrencyInputToMinor(formState.amountMinor, displayCurrency);
    const interval = Number.parseInt(formState.recurrenceInterval, 10);
    const dayOfMonth = Number.parseInt(formState.recurrenceDayOfMonth, 10);
    const vendorName = vendorNamesById[formState.vendorId];

    if (!trimmedName) {
      setFormError("Name is required.");
      return;
    }
    if (amountMinor === null || amountMinor <= 0) {
      setFormError("Amount must be a positive amount.");
      return;
    }
    if (Number.isNaN(interval) || interval <= 0) {
      setFormError("Recurrence interval must be at least 1.");
      return;
    }
    if (Number.isNaN(dayOfMonth) || dayOfMonth <= 0 || dayOfMonth > 31) {
      setFormError("Day of month must be between 1 and 31.");
      return;
    }
    if (!vendorName) {
      setFormError("Select a valid vendor.");
      return;
    }

    if (hasIpc) {
      const normalizedServiceName = normalizeSuggestionValue(formState.serviceName);
      const serviceForVendor = services.filter((entry) => entry.vendorId === formState.vendorId);
      const linkedService =
        serviceForVendor.find(
          (entry) => normalizeSuggestionValue(entry.name) === normalizedServiceName
        ) ?? (normalizedServiceName.length === 0 ? serviceForVendor[0] : undefined);
      if (!linkedService) {
        setFormError(
          "Linked service must match an existing service for the selected vendor."
        );
        return;
      }

      const normalizedContractNumber = normalizeSuggestionValue(formState.contractNumber);
      const linkedContract =
        normalizedContractNumber.length === 0
          ? contracts.find((entry) => entry.serviceId === linkedService.id) ?? null
          : contracts.find(
              (entry) =>
                entry.serviceId === linkedService.id &&
                normalizeSuggestionValue(entry.contractNumber ?? "") ===
                  normalizedContractNumber
            ) ?? null;
      if (formState.contractNumber.trim().length > 0 && !linkedContract) {
        setFormError(
          "Linked contract must match an existing contract number for the selected service."
        );
        return;
      }

      void (async () => {
        try {
          if (drawerMode === "create") {
            const created = await createExpenseIpc({
              scenarioId: selectedScenarioId,
              serviceId: linkedService.id,
              contractId: linkedContract?.id ?? null,
              name: trimmedName,
              expenseType: "recurring",
              status: formState.status,
              amountMinor,
              recurrence: {
                frequency: formState.recurrenceFrequency,
                interval,
                dayOfMonth,
                anchorDate: formState.recurrenceAnchorDate
              }
            });
            if (created) {
              setSelectedExpenseId(created.id);
            }
            setPageMessage("Expense created.");
          } else if (editingExpenseId) {
            await updateExpenseIpc({
              id: editingExpenseId,
              scenarioId: selectedScenarioId,
              serviceId: linkedService.id,
              contractId: linkedContract?.id ?? null,
              name: trimmedName,
              expenseType: "recurring",
              status: formState.status,
              amountMinor
            });

            const existingRecurrence = recurrences.find(
              (entry) => entry.expenseLineId === editingExpenseId
            );
            if (existingRecurrence) {
              await updateRecurrenceIpc({
                id: existingRecurrence.id,
                expenseLineId: editingExpenseId,
                frequency: formState.recurrenceFrequency,
                interval,
                dayOfMonth,
                anchorDate: formState.recurrenceAnchorDate
              });
            } else {
              await createRecurrenceIpc({
                expenseLineId: editingExpenseId,
                frequency: formState.recurrenceFrequency,
                interval,
                dayOfMonth,
                anchorDate: formState.recurrenceAnchorDate
              });
            }
            setPageMessage(`Expense ${editingExpenseId} updated.`);
          }
          setDrawerOpen(false);
          setFormError(null);
          await loadWorkspaceData();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          setFormError(message);
        }
      })();
      return;
    }

    const editingExpense = editingExpenseId
      ? expenses.find((expense) => expense.id === editingExpenseId)
      : null;

    const nextRecord: ExpenseRecord = {
      id: editingExpenseId ?? `exp-${crypto.randomUUID()}`,
      name: trimmedName,
      amountMinor,
      status: formState.status,
      vendorId: formState.vendorId,
      vendorName,
      serviceId: editingExpense?.serviceId ?? `svc-${crypto.randomUUID()}`,
      serviceName: formState.serviceName.trim(),
      contractId: editingExpense?.contractId ?? null,
      contractNumber: formState.contractNumber.trim(),
      tags: formState.tagsCsv
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0),
      tagAssignments: editingExpense?.tagAssignments ?? {},
      recurrenceRule: {
        frequency: formState.recurrenceFrequency,
        interval,
        dayOfMonth,
        anchorDate: formState.recurrenceAnchorDate
      }
    };

    setExpenses((current) => {
      if (drawerMode === "create") {
        return [...current, nextRecord];
      }
      return current.map((expense) =>
        expense.id === nextRecord.id ? nextRecord : expense
      );
    });
    focusExpense(nextRecord.id);
    setDrawerOpen(false);
    setFormError(null);
    setPageMessage(
      drawerMode === "create" ? "Expense created." : `Expense ${nextRecord.id} updated.`
    );
  }

  function handleConfirmDelete(): void {
    if (!deleteExpenseId) {
      return;
    }
    if (hasIpc) {
      const removingId = deleteExpenseId;
      void (async () => {
        try {
          const recurrence = recurrences.find((entry) => entry.expenseLineId === removingId);
          if (recurrence) {
            await deleteRecurrenceIpc(recurrence.id);
          }
          await deleteExpenseIpc(removingId);
          setSelectedRowIds((current) => current.filter((id) => id !== removingId));
          if (selectedExpenseId === removingId) {
            setSelectedExpenseId(null);
          }
          setPageMessage(`Expense ${removingId} deleted.`);
          setDeleteExpenseId(null);
          await loadWorkspaceData();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          setPageMessage(`Failed to delete expense: ${message}`);
        }
      })();
      return;
    }
    setExpenses((current) => current.filter((expense) => expense.id !== deleteExpenseId));
    setSelectedRowIds((current) => current.filter((id) => id !== deleteExpenseId));
    if (selectedExpenseId === deleteExpenseId) {
      focusExpense(null);
    }
    setPageMessage(`Expense ${deleteExpenseId} deleted.`);
    setDeleteExpenseId(null);
  }

  function toggleRowSelection(expenseId: string): void {
    setSelectedRowIds((current) =>
      current.includes(expenseId)
        ? current.filter((id) => id !== expenseId)
        : [...current, expenseId]
    );
  }

  function applyBulkStatus(nextStatus: ExpenseStatus): void {
    if (selectedRowIds.length === 0) {
      setPageMessage("Select at least one expense for bulk update.");
      return;
    }
    if (hasIpc) {
      void (async () => {
        try {
          const selected = expenses.filter((expense) => selectedRowIds.includes(expense.id));
          await Promise.all(
            selected.map((expense) =>
              updateExpenseIpc({
                id: expense.id,
                scenarioId: selectedScenarioId,
                serviceId: expense.serviceId,
                contractId: expense.contractId,
                name: expense.name,
                expenseType: "recurring",
                status: nextStatus,
                amountMinor: expense.amountMinor
              })
            )
          );
          setPageMessage(`Updated ${selectedRowIds.length} expense(s) to ${nextStatus}.`);
          await loadWorkspaceData();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          setPageMessage(`Bulk status update failed: ${message}`);
        }
      })();
      return;
    }
    setExpenses((current) =>
      current.map((expense) =>
        selectedRowIds.includes(expense.id)
          ? { ...expense, status: nextStatus }
          : expense
      )
    );
    setPageMessage(`Updated ${selectedRowIds.length} expense(s) to ${nextStatus}.`);
  }

  function openBulkTagEntryPoint(): void {
    const dimension = dimensions.find((entry) => entry.id === bulkTagDimensionId);
    if (!dimension) {
      setPageMessage("Select a valid dimension for bulk tag assignment.");
      return;
    }
    const tag = dimension.tags.find((entry) => entry.id === bulkTagId && !entry.retired);
    if (!tag) {
      setPageMessage("Select a valid tag for bulk assignment.");
      return;
    }
    if (selectedRowIds.length === 0) {
      setPageMessage("Select at least one expense for bulk tag assignment.");
      return;
    }
    if (hasIpc) {
      void (async () => {
        try {
          for (const expenseId of selectedRowIds) {
            const expense = expenses.find((entry) => entry.id === expenseId);
            if (!expense) {
              continue;
            }
            const existingForDimension = expense.tagAssignments[dimension.id] ?? [];
            if (dimension.mode === "single_select") {
              await Promise.all(
                existingForDimension
                  .filter((existingTagId) => existingTagId !== tag.id)
                  .map((existingTagId) =>
                    unassignTagIpc({
                      entityType: "expense_line",
                      entityId: expense.id,
                      dimensionId: dimension.id,
                      tagId: existingTagId
                    })
                  )
              );
            }
            await assignTagIpc({
              entityType: "expense_line",
              entityId: expense.id,
              dimensionId: dimension.id,
              tagId: tag.id
            });
          }
          setPageMessage(
            `Applied ${tag.label} in ${dimension.name} to ${selectedRowIds.length} expense(s).`
          );
          await loadWorkspaceData();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          setPageMessage(`Bulk tag assignment failed: ${message}`);
        }
      })();
      return;
    }
    setExpenses((current) =>
      current.map((expense) =>
        selectedRowIds.includes(expense.id)
          ? {
              ...expense,
              tagAssignments: applyTagAssignment(
                expense.tagAssignments,
                dimension,
                tag.id
              )
            }
          : expense
      )
    );
    setPageMessage(
      `Applied ${tag.label} in ${dimension.name} to ${selectedRowIds.length} expense(s).`
    );
  }

  function assignDetailTag(): void {
    if (!selectedExpense) {
      setPageMessage("Select an expense before assigning tags.");
      return;
    }
    const dimension = dimensions.find((entry) => entry.id === detailTagDimensionId);
    if (!dimension) {
      setPageMessage("Choose a valid dimension.");
      return;
    }
    const matchedTag = findTagByLabelOrId(dimension, detailTagQuery);
    if (!matchedTag) {
      setPageMessage("Enter a tag that exists for the selected dimension.");
      return;
    }

    if (hasIpc) {
      void (async () => {
        try {
          if (dimension.mode === "single_select") {
            const existing = selectedExpense.tagAssignments[dimension.id] ?? [];
            await Promise.all(
              existing
                .filter((existingTagId) => existingTagId !== matchedTag.id)
                .map((existingTagId) =>
                  unassignTagIpc({
                    entityType: "expense_line",
                    entityId: selectedExpense.id,
                    dimensionId: dimension.id,
                    tagId: existingTagId
                  })
                )
            );
          }
          await assignTagIpc({
            entityType: "expense_line",
            entityId: selectedExpense.id,
            dimensionId: dimension.id,
            tagId: matchedTag.id
          });
          setDetailTagQuery("");
          setPageMessage(`Assigned ${matchedTag.label} to ${selectedExpense.name}.`);
          await loadWorkspaceData();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          setPageMessage(`Tag assignment failed: ${message}`);
        }
      })();
      return;
    }

    setExpenses((current) =>
      current.map((expense) =>
        expense.id === selectedExpense.id
          ? {
              ...expense,
              tagAssignments: applyTagAssignment(
                expense.tagAssignments,
                dimension,
                matchedTag.id
              )
            }
          : expense
      )
    );
    setDetailTagQuery("");
    setPageMessage(`Assigned ${matchedTag.label} to ${selectedExpense.name}.`);
  }

  function removeDetailTag(
    expenseId: string,
    dimensionId: string,
    tagId: string,
    tagLabel: string
  ): void {
    if (hasIpc) {
      void (async () => {
        try {
          await unassignTagIpc({
            entityType: "expense_line",
            entityId: expenseId,
            dimensionId,
            tagId
          });
          setPageMessage(`Removed ${tagLabel}.`);
          await loadWorkspaceData();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          setPageMessage(`Failed to remove tag: ${message}`);
        }
      })();
      return;
    }
    setExpenses((current) =>
      current.map((expense) =>
        expense.id === expenseId
          ? {
              ...expense,
              tagAssignments: removeTag(expense.tagAssignments, dimensionId, tagId)
            }
          : expense
      )
    );
    setPageMessage(`Removed ${tagLabel}.`);
  }

  const bulkDimension =
    dimensions.find((dimension) => dimension.id === bulkTagDimensionId) ?? null;
  const detailDimension =
    dimensions.find((dimension) => dimension.id === detailTagDimensionId) ?? null;
  const selectedExpenseTags = selectedExpense
    ? Array.from(
        new Set([
          ...selectedExpense.tags,
          ...getAssignedTagLabels(selectedExpense.tagAssignments, dimensions)
        ])
      )
    : [];

  function openHelpTopic(
    topic: string,
    anchor?: string,
    q?: string,
    context?: string
  ): void {
    void openHelpWindow({ topic, anchor, q, context });
  }

  return (
    <section className="expenses-page">
      <PageHeader
        title="Expenses Workspace"
        subtitle="Manage expense lines with sortable table triage, detail context, and recurrence preview."
        actions={
          <Button appearance="primary" onClick={openCreateDrawer}>
            Create Expense
          </Button>
        }
      />

      <div className="expenses-toolbar">
        <div className="expenses-toolbar__search-row">
          <Input
            aria-label="Search expenses"
            placeholder="Search by name, vendor, service, contract, or tag"
            value={searchText}
            onChange={(_event, data) => setSearchText(data.value)}
          />
          <Select
            aria-label="Filter by vendor"
            value={vendorFilter}
            onChange={(event) => setVendorFilter(event.target.value)}
          >
            <option value="all">All Vendors</option>
            {vendorOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="expenses-toolbar__action-row">
          <div className="expenses-toolbar__filters">
            <Button
              appearance={statusFilter === "all" ? "primary" : "secondary"}
              size="small"
              onClick={() => setStatusFilter("all")}
            >
              All
            </Button>
            {STATUS_OPTIONS.map((status) => (
              <Button
                key={status}
                appearance={statusFilter === status ? "primary" : "secondary"}
                size="small"
                onClick={() => setStatusFilter(status)}
              >
                {toTitleCaseLabel(status)}
              </Button>
            ))}
          </div>
          <div className="expenses-toolbar__bulk">
            <Select
              aria-label="Bulk tag dimension"
              value={bulkTagDimensionId}
              onChange={(event) => {
                setBulkTagDimensionId(event.target.value);
                setBulkTagId("");
              }}
            >
              {dimensions.map((dimension) => (
                <option key={dimension.id} value={dimension.id}>
                  {dimension.name}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Bulk tag value"
              value={bulkTagId}
              onChange={(event) => setBulkTagId(event.target.value)}
            >
              <option value="">Select Tag</option>
              {(bulkDimension?.tags ?? [])
                .filter((tag) => !tag.retired)
                .map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.label}
                  </option>
                ))}
            </Select>
            <Menu>
              <MenuTrigger disableButtonEnhancement>
                <Button size="small" appearance="secondary">
                  More
                </Button>
              </MenuTrigger>
              <MenuPopover>
                <MenuList>
                  <MenuItem onClick={() => applyBulkStatus("approved")}>
                    Bulk Set Approved
                  </MenuItem>
                  <MenuItem onClick={openBulkTagEntryPoint}>Bulk Tag Entry</MenuItem>
                </MenuList>
              </MenuPopover>
            </Menu>
          </div>
        </div>
      </div>

      {loading ? <Text>Loading expenses...</Text> : null}
      {pageMessage ? <Text>{pageMessage}</Text> : null}

      <div className="expenses-layout">
        <section>
          {filteredExpenses.length === 0 ? (
            <EmptyState
              title="No expenses match filters"
              description="Adjust search, vendor, or quick filters to find matching expenses."
            />
          ) : (
            useAgGrid ? (
              <div className="expenses-grid-wrapper">
                <div className="expenses-grid-actions">
                  <Button
                    size="small"
                    appearance="secondary"
                    disabled={expensesGridApi === null}
                    onClick={() => {
                      expensesGridApi?.exportDataAsCsv({
                        fileName: `expenses-${selectedScenarioId}.csv`
                      });
                    }}
                  >
                    Export grid CSV
                  </Button>
                </div>
                <div
                  className="ag-theme-quartz expenses-grid"
                  role="table"
                  aria-label="Expenses table"
                >
                  <AgGridReact<ExpenseRecord>
                    rowData={filteredExpenses}
                    columnDefs={expenseGridColumns}
                    defaultColDef={{
                      sortable: true,
                      filter: true,
                      resizable: true
                    }}
                    getRowId={(params) => params.data.id}
                    onGridReady={onExpensesGridReady}
                    onRowClicked={onExpensesGridRowClick}
                    rowHeight={48}
                  />
                </div>
              </div>
            ) : (
              <Table aria-label="Expenses table">
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>Select</TableHeaderCell>
                    <TableHeaderCell>
                      <Button size="small" appearance="subtle" onClick={() => toggleSort("name")}>
                        Name
                      </Button>
                    </TableHeaderCell>
                    <TableHeaderCell>
                      <Button size="small" appearance="subtle" onClick={() => toggleSort("amount")}>
                        Amount
                      </Button>
                    </TableHeaderCell>
                    <TableHeaderCell>
                      <Button size="small" appearance="subtle" onClick={() => toggleSort("status")}>
                        Status
                      </Button>
                    </TableHeaderCell>
                    <TableHeaderCell>Vendor</TableHeaderCell>
                    <TableHeaderCell>Service</TableHeaderCell>
                    <TableHeaderCell>Contract</TableHeaderCell>
                    <TableHeaderCell>Tags</TableHeaderCell>
                    <TableHeaderCell>Actions</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.map((expense) => {
                    const checked = selectedRowIds.includes(expense.id);
                    const focused = selectedExpense?.id === expense.id;
                    const tagSummary = Array.from(
                      new Set([
                        ...expense.tags,
                        ...getAssignedTagLabels(expense.tagAssignments, dimensions)
                      ])
                    );
                    return (
                      <TableRow
                        key={expense.id}
                        className={focused ? "expenses-row expenses-row--focused" : "expenses-row"}
                        onClick={() => focusExpense(expense.id)}
                      >
                        <TableCell>
                          <Checkbox
                            checked={checked}
                            onChange={(event) => {
                              event.stopPropagation();
                              toggleRowSelection(expense.id);
                            }}
                          />
                        </TableCell>
                        <TableCell>{expense.name}</TableCell>
                        <TableCell>{formatCurrencyMinor(expense.amountMinor, displayCurrency)}</TableCell>
                        <TableCell>
                          <StatusChip
                            label={toTitleCaseLabel(expense.status)}
                            tone={statusToTone(expense.status)}
                          />
                        </TableCell>
                        <TableCell>{expense.vendorName}</TableCell>
                        <TableCell>{expense.serviceName || "Unassigned"}</TableCell>
                        <TableCell>{expense.contractNumber || "Unassigned"}</TableCell>
                        <TableCell>{tagSummary.join(", ") || "None"}</TableCell>
                        <TableCell>
                          <div className="expenses-row__actions">
                            <Button
                              size="small"
                              appearance="secondary"
                              onClick={(event) => {
                                event.stopPropagation();
                                openEditDrawer(expense);
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              size="small"
                              appearance="secondary"
                              onClick={(event) => {
                                event.stopPropagation();
                                setDeleteExpenseId(expense.id);
                              }}
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )
          )}
        </section>

        <aside>
          {selectedExpense ? (
            <Card className="expenses-detail">
              <Title3>Expense Detail</Title3>
              <Text>{selectedExpense.name}</Text>
              <Text>{`Amount: ${formatCurrencyMinor(selectedExpense.amountMinor, displayCurrency)}`}</Text>
              <Text>{`Vendor: ${selectedExpense.vendorName}`}</Text>
              <Text>{`Service: ${selectedExpense.serviceName || "Unassigned"}`}</Text>
              <Text>{`Contract: ${selectedExpense.contractNumber || "Unassigned"}`}</Text>
              <Text>{`Tags: ${selectedExpenseTags.join(", ") || "None"}`}</Text>
              <div className="expenses-detail__tagging">
                <Text weight="semibold">Tag assignments</Text>
                <div className="expenses-detail__chip-grid">
                  {dimensions.map((dimension) => {
                    const assigned = selectedExpense.tagAssignments[dimension.id] ?? [];
                    return (
                      <div key={dimension.id} className="expenses-detail__chip-row">
                        <Text>{dimension.name}</Text>
                        <div className="expenses-detail__chips">
                          {assigned.length === 0 ? (
                            <Badge appearance="tint">None</Badge>
                          ) : (
                            assigned.map((tagId) => {
                              const tagLabel =
                                dimension.tags.find((tag) => tag.id === tagId)?.label ?? tagId;
                              return (
                                <Button
                                  key={tagId}
                                  size="small"
                                  appearance="secondary"
                                  onClick={() =>
                                    removeDetailTag(
                                      selectedExpense.id,
                                      dimension.id,
                                      tagId,
                                      tagLabel
                                    )
                                  }
                                >
                                  {`${tagLabel} ×`}
                                </Button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="expenses-detail__tag-entry">
                  <Select
                    aria-label="Detail tag dimension"
                    value={detailTagDimensionId}
                    onChange={(event) => setDetailTagDimensionId(event.target.value)}
                  >
                    {dimensions.map((dimension) => (
                      <option key={dimension.id} value={dimension.id}>
                        {dimension.name}
                      </option>
                    ))}
                  </Select>
                  <Input
                    aria-label="Detail tag autocomplete"
                    list="expense-detail-tag-options"
                    value={detailTagQuery}
                    onChange={(_event, data) => setDetailTagQuery(data.value)}
                    placeholder="Type tag name"
                  />
                  <datalist id="expense-detail-tag-options">
                    {(detailDimension?.tags ?? [])
                      .filter((tag) => !tag.retired)
                      .map((tag) => (
                        <option key={tag.id} value={tag.label} />
                      ))}
                  </datalist>
                  <Button size="small" appearance="secondary" onClick={assignDetailTag}>
                    Assign tag
                  </Button>
                </div>
              </div>
              <div>
                <Text weight="semibold">Next 12 occurrences</Text>
                <ul className="expenses-detail__occurrences">
                  {recurrencePreview.map((occurrence) => (
                    <li key={occurrence}>
                      <Text>{occurrence}</Text>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          ) : (
            <EmptyState
              title="No expense selected"
              description="Select an expense row to view details."
            />
          )}
        </aside>
      </div>

      <FormDrawer
        open={drawerOpen}
        title={drawerMode === "create" ? "Create Expense" : "Edit Expense"}
        onOpenChange={setDrawerOpen}
        onSubmit={handleSubmitDrawer}
        submitLabel={drawerMode === "create" ? "Create" : "Save"}
      >
        <div className="expenses-form">
          <section className="expenses-form__section">
            <div className="expenses-form__section-header">
              <Text weight="semibold">Core details</Text>
              <Text size={200}>Primary identity and accounting fields.</Text>
              <Button
                appearance="secondary"
                size="small"
                type="button"
                onClick={() =>
                  openHelpTopic(
                    "expenses-form",
                    "createedit-expense-form",
                    "expense form",
                    "expenses:form"
                  )
                }
              >
                Expense Form Guide
              </Button>
            </div>
            <div className="expenses-form__grid expenses-form__grid--two">
              <div className="expenses-form__field expenses-form__field--full">
                <Text className="expenses-form__label" size={200} weight="medium">
                  Expense name
                </Text>
                <Input
                  aria-label="Expense name"
                  list={expenseNameSuggestionsId}
                  value={formState.name}
                  onChange={(_event, data) =>
                    setFormState((current) => ({ ...current, name: data.value }))
                  }
                  placeholder="Expense name"
                />
              </div>
              <div className="expenses-form__field">
                <Text className="expenses-form__label" size={200} weight="medium">
                  Amount
                </Text>
                <Input
                  aria-label="Expense amount"
                  inputMode="decimal"
                  value={formState.amountMinor}
                  onChange={(_event, data) =>
                    setFormState((current) => ({ ...current, amountMinor: data.value }))
                  }
                  placeholder={amountExample.input}
                />
                <Text className="expenses-form__hint" size={100}>
                  {`Example: ${amountExample.input} = ${amountExample.formatted}.`}
                </Text>
              </div>
              <div className="expenses-form__field">
                <Text className="expenses-form__label" size={200} weight="medium">
                  Status
                </Text>
                <Select
                  aria-label="Expense status"
                  value={formState.status}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      status: event.target.value as ExpenseStatus
                    }))
                  }
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {toTitleCaseLabel(status)}
                    </option>
                  ))}
                </Select>
                <Text
                  aria-hidden="true"
                  className="expenses-form__hint expenses-form__hint--placeholder"
                  size={100}
                >
                  {`Example: ${amountExample.input} = ${amountExample.formatted}.`}
                </Text>
              </div>
              <div className="expenses-form__field expenses-form__field--full">
                <Text className="expenses-form__label" size={200} weight="medium">
                  Vendor
                </Text>
                <Select
                  aria-label="Expense vendor"
                  value={formState.vendorId}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      vendorId: event.target.value,
                      serviceName: "",
                      contractNumber: ""
                    }))
                  }
                >
                  {vendorOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </section>
          <section className="expenses-form__section">
            <div className="expenses-form__section-header">
              <Text weight="semibold">Links and tags</Text>
              <Text size={200}>Optional references for discovery and reporting.</Text>
            </div>
            <div className="expenses-form__grid expenses-form__grid--two">
              <div className="expenses-form__field">
                <Text className="expenses-form__label" size={200} weight="medium">
                  Linked service
                </Text>
                <Input
                  aria-label="Expense service"
                  list={expenseServiceSuggestionsId}
                  value={formState.serviceName}
                  onChange={(_event, data) =>
                    setFormState((current) => ({
                      ...current,
                      serviceName: data.value,
                      contractNumber:
                        normalizeSuggestionValue(current.serviceName) ===
                        normalizeSuggestionValue(data.value)
                          ? current.contractNumber
                          : ""
                    }))
                  }
                  placeholder="Linked service"
                />
              </div>
              <div className="expenses-form__field">
                <Text className="expenses-form__label" size={200} weight="medium">
                  Linked contract
                </Text>
                <Input
                  aria-label="Expense contract"
                  list={expenseContractSuggestionsId}
                  value={formState.contractNumber}
                  onChange={(_event, data) =>
                    setFormState((current) => ({ ...current, contractNumber: data.value }))
                  }
                  placeholder="Linked contract"
                />
              </div>
              <div className="expenses-form__field expenses-form__field--full">
                <Text className="expenses-form__label" size={200} weight="medium">
                  Tags
                </Text>
                <Input
                  aria-label="Expense tags"
                  value={formState.tagsCsv}
                  onChange={(_event, data) =>
                    setFormState((current) => ({ ...current, tagsCsv: data.value }))
                  }
                  placeholder="Tags (comma-separated)"
                />
              </div>
            </div>
          </section>
          <section className="expenses-form__section">
            <div className="expenses-form__section-header">
              <Text weight="semibold">Recurrence</Text>
              <Text size={200}>Configure cadence for forecast and renewals.</Text>
            </div>
            <div className="expenses-form__grid expenses-form__grid--two">
              <div className="expenses-form__field">
                <Text className="expenses-form__label" size={200} weight="medium">
                  Frequency
                </Text>
                <Select
                  aria-label="Recurrence frequency"
                  value={formState.recurrenceFrequency}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      recurrenceFrequency: event.target.value as RecurrencePreviewRule["frequency"]
                    }))
                  }
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </Select>
              </div>
              <div className="expenses-form__field">
                <Text className="expenses-form__label" size={200} weight="medium">
                  Interval
                </Text>
                <Input
                  aria-label="Recurrence interval"
                  type="number"
                  min="1"
                  value={formState.recurrenceInterval}
                  onChange={(_event, data) =>
                    setFormState((current) => ({ ...current, recurrenceInterval: data.value }))
                  }
                  placeholder="1"
                />
              </div>
              <div className="expenses-form__field">
                <Text className="expenses-form__label" size={200} weight="medium">
                  Day of month
                </Text>
                <Input
                  aria-label="Recurrence day of month"
                  type="number"
                  min="1"
                  max="31"
                  value={formState.recurrenceDayOfMonth}
                  onChange={(_event, data) =>
                    setFormState((current) => ({ ...current, recurrenceDayOfMonth: data.value }))
                  }
                  placeholder="1"
                />
              </div>
              <div className="expenses-form__field">
                <Text className="expenses-form__label" size={200} weight="medium">
                  Anchor date
                </Text>
                <Input
                  aria-label="Recurrence anchor date"
                  value={formState.recurrenceAnchorDate}
                  onChange={(_event, data) =>
                    setFormState((current) => ({ ...current, recurrenceAnchorDate: data.value }))
                  }
                  type="date"
                />
              </div>
            </div>
          </section>
          <datalist id={expenseNameSuggestionsId}>
            {expenseNameSuggestions.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
          <datalist id={expenseServiceSuggestionsId}>
            {serviceSuggestions.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
          <datalist id={expenseContractSuggestionsId}>
            {contractSuggestions.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
        </div>
        {formError ? <InlineError message={formError} /> : null}
      </FormDrawer>

      <ConfirmDialog
        open={deleteExpenseId !== null}
        title="Delete expense?"
        message="This action removes the selected expense record."
        onOpenChange={(open) => {
          if (!open) {
            setDeleteExpenseId(null);
          }
        }}
        onConfirm={handleConfirmDelete}
        confirmLabel="Delete"
      />
    </section>
  );
}
