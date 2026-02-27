import { useMemo, useState } from "react";
import {
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

import {
  ConfirmDialog,
  EmptyState,
  FormDrawer,
  InlineError,
  PageHeader,
  StatusChip
} from "../../ui/primitives";
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
  serviceName: string;
  contractNumber: string;
  tags: string[];
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
    serviceName: "AWS",
    contractNumber: "AWS-2026-BASE",
    tags: ["infra", "production"],
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
    serviceName: "Defender",
    contractNumber: "MS-SEC-2026",
    tags: ["security"],
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
    serviceName: "Looker",
    contractNumber: "LOOK-ANL-01",
    tags: ["bi", "finance"],
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
  serviceName: string;
  contractNumber: string;
  tagsCsv: string;
  recurrenceFrequency: RecurrencePreviewRule["frequency"];
  recurrenceInterval: string;
  recurrenceDayOfMonth: string;
  recurrenceAnchorDate: string;
};

function createDefaultFormState(): ExpenseFormState {
  return {
    name: "",
    amountMinor: "0",
    status: "planned",
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
    serviceName: expense.serviceName,
    contractNumber: expense.contractNumber,
    tagsCsv: expense.tags.join(", "),
    recurrenceFrequency: expense.recurrenceRule.frequency,
    recurrenceInterval: String(expense.recurrenceRule.interval),
    recurrenceDayOfMonth: String(expense.recurrenceRule.dayOfMonth),
    recurrenceAnchorDate: expense.recurrenceRule.anchorDate
  };
}

export function ExpensesPage() {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(INITIAL_EXPENSES);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<ExpenseStatus | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(INITIAL_EXPENSES[0]?.id ?? null);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create");
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [formState, setFormState] = useState<ExpenseFormState>(createDefaultFormState());
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);
  const [pageMessage, setPageMessage] = useState<string | null>(null);

  const filteredExpenses = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return expenses
      .filter((expense) => {
        if (statusFilter !== "all" && expense.status !== statusFilter) {
          return false;
        }
        if (!query) {
          return true;
        }
        return (
          expense.name.toLowerCase().includes(query) ||
          expense.serviceName.toLowerCase().includes(query) ||
          expense.contractNumber.toLowerCase().includes(query) ||
          expense.tags.some((tag) => tag.toLowerCase().includes(query))
        );
      })
      .sort((left, right) => compareExpense(left, right, sortKey, sortDirection));
  }, [expenses, searchText, sortDirection, sortKey, statusFilter]);

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

  function openCreateDrawer(): void {
    setDrawerMode("create");
    setEditingExpenseId(null);
    setFormState(createDefaultFormState());
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

    const nextRecord: ExpenseRecord = {
      id: editingExpenseId ?? `exp-${crypto.randomUUID()}`,
      name: trimmedName,
      amountMinor,
      status: formState.status,
      serviceName: formState.serviceName.trim(),
      contractNumber: formState.contractNumber.trim(),
      tags: formState.tagsCsv
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0),
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
    setSelectedExpenseId(nextRecord.id);
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
      setSelectedExpenseId(null);
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
    if (selectedRowIds.length === 0) {
      setPageMessage("Select at least one expense for bulk tag assignment.");
      return;
    }
    setPageMessage(
      `Bulk tag assignment entry point prepared for ${selectedRowIds.length} expense(s).`
    );
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
        <Input
          aria-label="Search expenses"
          placeholder="Search by name, service, contract, or tag"
          value={searchText}
          onChange={(_event, data) => setSearchText(data.value)}
        />
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
              description="Adjust search or quick filters to find matching expenses."
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
                  <TableHeaderCell>Service</TableHeaderCell>
                  <TableHeaderCell>Contract</TableHeaderCell>
                  <TableHeaderCell>Actions</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.map((expense) => {
                  const checked = selectedRowIds.includes(expense.id);
                  const focused = selectedExpense?.id === expense.id;
                  return (
                    <TableRow
                      key={expense.id}
                      className={focused ? "expenses-row expenses-row--focused" : "expenses-row"}
                      onClick={() => setSelectedExpenseId(expense.id)}
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
                        <StatusChip label={expense.status.toUpperCase()} tone={statusToTone(expense.status)} />
                      </TableCell>
                      <TableCell>{expense.serviceName || "Unassigned"}</TableCell>
                      <TableCell>{expense.contractNumber || "Unassigned"}</TableCell>
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
              <Text>{`Service: ${selectedExpense.serviceName || "Unassigned"}`}</Text>
              <Text>{`Contract: ${selectedExpense.contractNumber || "Unassigned"}`}</Text>
              <Text>{`Tags: ${selectedExpense.tags.join(", ") || "None"}`}</Text>
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
