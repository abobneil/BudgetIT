import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Input,
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
import { useSearchParams } from "react-router-dom";

import {
  ConfirmDialog,
  EmptyState,
  FormDrawer,
  InlineError,
  PageHeader,
  StatusChip
} from "../../ui/primitives";
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
  serviceName: string;
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
    serviceName: "AWS",
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
    serviceName: "Defender",
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
    serviceName: "Looker",
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

function createDefaultFormState(vendorId = "vend-aws"): ExpenseFormState {
  return {
    name: "",
    amountMinor: "0",
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

function formatUsd(amountMinor: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(amountMinor / 100);
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

function fromExpense(expense: ExpenseRecord): ExpenseFormState {
  return {
    name: expense.name,
    amountMinor: String(expense.amountMinor),
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

export function ExpensesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(INITIAL_EXPENSES);
  const [dimensions] = useState<DimensionDefinition[]>(() =>
    structuredClone(TAG_DIMENSIONS)
  );
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
    createDefaultFormState(INITIAL_EXPENSES[0]?.vendorId ?? "vend-aws")
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

  const vendorOptions = useMemo(
    () =>
      buildVendorFilterOptions(
        expenses.map((expense) => ({
          vendorId: expense.vendorId,
          vendorName: expense.vendorName
        }))
      ),
    [expenses]
  );
  const vendorNamesById = useMemo(
    () =>
      Object.fromEntries(vendorOptions.map((option) => [option.value, option.label])),
    [vendorOptions]
  );

  useEffect(() => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (vendorFilter === "all") {
          next.delete("vendor");
        } else {
          next.set("vendor", vendorFilter);
        }
        return next;
      },
      { replace: true }
    );
  }, [setSearchParams, vendorFilter]);

  useEffect(() => {
    const focusedExpenseId = searchParams.get("expense");
    if (focusedExpenseId && expenses.some((expense) => expense.id === focusedExpenseId)) {
      setSelectedExpenseId(focusedExpenseId);
    }

    const action = searchParams.get("action");
    if (action === "create" && !drawerOpen) {
      setDrawerMode("create");
      setEditingExpenseId(null);
      setFormState(createDefaultFormState(vendorOptions[0]?.value ?? "vend-aws"));
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
  }, [drawerOpen, expenses, searchParams, setSearchParams, vendorOptions]);

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
    setFormState(createDefaultFormState(vendorOptions[0]?.value ?? "vend-aws"));
    setFormError(null);
    setDrawerOpen(true);
  }

  function openEditDrawer(expense: ExpenseRecord): void {
    setDrawerMode("edit");
    setEditingExpenseId(expense.id);
    setFormState(fromExpense(expense));
    setFormError(null);
    setDrawerOpen(true);
  }

  function handleSubmitDrawer(): void {
    const trimmedName = formState.name.trim();
    const amountMinor = Number.parseInt(formState.amountMinor, 10);
    const interval = Number.parseInt(formState.recurrenceInterval, 10);
    const dayOfMonth = Number.parseInt(formState.recurrenceDayOfMonth, 10);
    const vendorName = vendorNamesById[formState.vendorId];

    if (!trimmedName) {
      setFormError("Name is required.");
      return;
    }
    if (Number.isNaN(amountMinor) || amountMinor <= 0) {
      setFormError("Amount (minor units) must be a positive integer.");
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
      serviceName: formState.serviceName.trim(),
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
          <option value="all">All vendors</option>
          {vendorOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
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
              {status}
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
            <option value="">Select tag</option>
            {(bulkDimension?.tags ?? [])
              .filter((tag) => !tag.retired)
              .map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.label}
                </option>
              ))}
          </Select>
          <Button size="small" onClick={() => applyBulkStatus("approved")}>
            Bulk set Approved
          </Button>
          <Button size="small" appearance="secondary" onClick={openBulkTagEntryPoint}>
            Bulk tag entry
          </Button>
        </div>
      </div>

      {pageMessage ? <Text>{pageMessage}</Text> : null}

      <div className="expenses-layout">
        <section>
          {filteredExpenses.length === 0 ? (
            <EmptyState
              title="No expenses match filters"
              description="Adjust search, vendor, or quick filters to find matching expenses."
            />
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
                      <TableCell>{formatUsd(expense.amountMinor)}</TableCell>
                      <TableCell>
                        <StatusChip
                          label={expense.status.toUpperCase()}
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
          )}
        </section>

        <aside>
          {selectedExpense ? (
            <Card className="expenses-detail">
              <Title3>Expense Detail</Title3>
              <Text>{selectedExpense.name}</Text>
              <Text>{`Amount: ${formatUsd(selectedExpense.amountMinor)}`}</Text>
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
          <Input
            aria-label="Expense name"
            value={formState.name}
            onChange={(_event, data) =>
              setFormState((current) => ({ ...current, name: data.value }))
            }
            placeholder="Expense name"
          />
          <Input
            aria-label="Expense amount minor units"
            value={formState.amountMinor}
            onChange={(_event, data) =>
              setFormState((current) => ({ ...current, amountMinor: data.value }))
            }
            placeholder="Amount in minor units"
          />
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
                {status}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Expense vendor"
            value={formState.vendorId}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                vendorId: event.target.value
              }))
            }
          >
            {vendorOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Input
            aria-label="Expense service"
            value={formState.serviceName}
            onChange={(_event, data) =>
              setFormState((current) => ({ ...current, serviceName: data.value }))
            }
            placeholder="Linked service"
          />
          <Input
            aria-label="Expense contract"
            value={formState.contractNumber}
            onChange={(_event, data) =>
              setFormState((current) => ({ ...current, contractNumber: data.value }))
            }
            placeholder="Linked contract"
          />
          <Input
            aria-label="Expense tags"
            value={formState.tagsCsv}
            onChange={(_event, data) =>
              setFormState((current) => ({ ...current, tagsCsv: data.value }))
            }
            placeholder="Tags (comma-separated)"
          />
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
            <option value="monthly">monthly</option>
            <option value="quarterly">quarterly</option>
            <option value="yearly">yearly</option>
          </Select>
          <Input
            aria-label="Recurrence interval"
            value={formState.recurrenceInterval}
            onChange={(_event, data) =>
              setFormState((current) => ({ ...current, recurrenceInterval: data.value }))
            }
            placeholder="Recurrence interval"
          />
          <Input
            aria-label="Recurrence day of month"
            value={formState.recurrenceDayOfMonth}
            onChange={(_event, data) =>
              setFormState((current) => ({ ...current, recurrenceDayOfMonth: data.value }))
            }
            placeholder="Day of month (1-31)"
          />
          <Input
            aria-label="Recurrence anchor date"
            value={formState.recurrenceAnchorDate}
            onChange={(_event, data) =>
              setFormState((current) => ({ ...current, recurrenceAnchorDate: data.value }))
            }
            type="date"
          />
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
