import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
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
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  ConfirmDialog,
  EmptyState,
  FormDrawer,
  InlineError,
  PageHeader,
  StatusChip
} from "../../ui/primitives";
import { toTitleCaseLabel } from "../../ui/text/labelCase";
import {
  createContract as createContractIpc,
  deleteContract as deleteContractIpc,
  isIpcAvailable,
  listContracts as listContractsIpc,
  listExpenses as listExpensesIpc,
  listServices as listServicesIpc,
  listVendors as listVendorsIpc,
  openHelpWindow,
  updateContract as updateContractIpc
} from "../../lib/ipcClient";
import {
  CONTRACT_RECORDS,
  SERVICE_BY_ID,
  type ContractLifecycleStatus
} from "../services/service-contract-data";
import { currentYearDateRange, toUtcIsoDate } from "../../lib/dateDefaults";
import {
  contractLifecycleTone,
  renewalWindowLabel
} from "../services/service-lifecycle-model";
import { useScenarioContext } from "../scenarios/ScenarioContext";
import "./ContractsPage.css";

type ServiceContext = {
  id: string;
  name: string;
  vendorId: string;
  vendorName: string;
  ownerTeam: string;
};

type ContractFormState = {
  serviceId: string;
  contractNumber: string;
  owner: string;
  startDate: string;
  endDate: string;
  renewalType: "auto" | "manual" | "none";
  renewalDate: string;
  noticePeriodDays: string;
  lifecycleStatus: ContractLifecycleStatus;
  renewalAction: "auto-renew" | "manual-review" | "cancel-window";
};

function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00.000Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  });
}

function formatUsd(amountMinor: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(amountMinor / 100);
}

function mergeQuery(
  params: URLSearchParams,
  updates: Record<string, string | null>
): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const [key, value] of Object.entries(updates)) {
    if (!value) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
  }
  return next;
}

function normalizeContractId(contractNumber: string): string {
  return `ctr-${contractNumber
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}`;
}

function buildNoticeDeadline(renewalDate: string, noticePeriodDays: number): string {
  const renewalDateValue = new Date(`${renewalDate}T00:00:00.000Z`);
  renewalDateValue.setUTCDate(renewalDateValue.getUTCDate() - noticePeriodDays);
  return renewalDateValue.toISOString().slice(0, 10);
}

function createDefaultFormState(serviceId: string): ContractFormState {
  const currentYearRange = currentYearDateRange();
  return {
    serviceId,
    contractNumber: "",
    owner: "",
    startDate: currentYearRange.dateFrom,
    endDate: currentYearRange.dateTo,
    renewalType: "manual",
    renewalDate: currentYearRange.dateTo,
    noticePeriodDays: "30",
    lifecycleStatus: "active",
    renewalAction: "manual-review"
  };
}

function fromContract(contract: (typeof CONTRACT_RECORDS)[number]): ContractFormState {
  const noticeDays = Math.max(1, Math.round((
    new Date(`${contract.renewalDate}T00:00:00.000Z`).getTime() -
      new Date(`${contract.noticeDeadline}T00:00:00.000Z`).getTime()) /
      (1000 * 60 * 60 * 24)
  ));
  return {
    serviceId: contract.linkedServiceIds[0] ?? "",
    contractNumber: contract.contractNumber,
    owner: contract.owner,
    startDate: contract.startDate,
    endDate: contract.endDate,
    renewalType: contract.renewalAction === "auto-renew" ? "auto" : "manual",
    renewalDate: contract.renewalDate,
    noticePeriodDays: String(noticeDays),
    lifecycleStatus: contract.lifecycleStatus,
    renewalAction: contract.renewalAction
  };
}

export function ContractsPage() {
  const navigate = useNavigate();
  const hasIpc = isIpcAvailable();
  const { selectedScenarioId } = useScenarioContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const [contractRecords, setContractRecords] = useState(CONTRACT_RECORDS);
  const [serviceById, setServiceById] = useState<Record<string, ServiceContext>>(
    () =>
      Object.fromEntries(
        Object.values(SERVICE_BY_ID).map((service) => [
          service.id,
          {
            id: service.id,
            name: service.name,
            vendorId: service.vendorId,
            vendorName: service.vendorName,
            ownerTeam: service.owner
          }
        ])
      )
  );
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ContractLifecycleStatus | "all">(
    "all"
  );
  const [selectedContractId, setSelectedContractId] = useState<string>(() => searchParams.get("contract") ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create");
  const [editingContractId, setEditingContractId] = useState<string | null>(null);
  const [formState, setFormState] = useState<ContractFormState>(() => createDefaultFormState(""));
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteContractId, setDeleteContractId] = useState<string | null>(null);
  const referenceDate = toUtcIsoDate();
  const currentYearRange = useMemo(() => currentYearDateRange(), []);

  const serviceChoices = useMemo(
    () =>
      Object.values(serviceById)
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((entry) => ({ value: entry.id, label: entry.name })),
    [serviceById]
  );

  const loadWorkspaceData = useCallback(async () => {
    if (!hasIpc) {
      return;
    }
    setLoading(true);
    try {
      const [vendors, services, contracts, expenses] = await Promise.all([
        listVendorsIpc(),
        listServicesIpc(),
        listContractsIpc(),
        listExpensesIpc({ scenarioId: selectedScenarioId })
      ]);
      const vendorNameById = new Map(vendors.map((vendor) => [vendor.id, vendor.name]));
      const serviceMap = Object.fromEntries(
        services.map((service) => [
          service.id,
          {
            id: service.id,
            name: service.name,
            vendorId: service.vendorId,
            vendorName: vendorNameById.get(service.vendorId) ?? service.vendorId,
            ownerTeam: service.ownerTeam ?? ""
          }
        ])
      ) as Record<string, ServiceContext>;
      setServiceById(serviceMap);

      const spendByContractId = new Map<string, number>();
      for (const expense of expenses) {
        if (!expense.contractId) {
          continue;
        }
        spendByContractId.set(
          expense.contractId,
          (spendByContractId.get(expense.contractId) ?? 0) + expense.amountMinor
        );
      }

      const mappedContracts = contracts.map((contract) => {
        const service = services.find((entry) => entry.id === contract.serviceId);
        const vendorName =
          vendorNameById.get(service?.vendorId ?? "") ?? service?.vendorId ?? "";
        const renewalDate = contract.renewalDate ?? contract.endDate ?? currentYearRange.dateTo;
        const noticeDays = contract.noticePeriodDays ?? 30;
        return {
          id: contract.id,
          vendorId: service?.vendorId ?? "",
          contractNumber: contract.contractNumber ?? contract.id,
          providerName: vendorName,
          owner: contract.owner ?? service?.ownerTeam ?? "",
          startDate: contract.startDate ?? renewalDate,
          endDate: contract.endDate ?? renewalDate,
          renewalDate,
          noticeDeadline: buildNoticeDeadline(renewalDate, noticeDays),
          lifecycleStatus: contract.lifecycleStatus,
          renewalAction: contract.renewalAction,
          linkedServiceIds: [contract.serviceId],
          totalCommitmentMinor: spendByContractId.get(contract.id) ?? 0
        };
      });
      setContractRecords(mappedContracts);
      if (mappedContracts.length > 0 && !mappedContracts.some((entry) => entry.id === selectedContractId)) {
        setSelectedContractId(mappedContracts[0].id);
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setMessage(`Failed to load contracts: ${detail}`);
    } finally {
      setLoading(false);
    }
  }, [currentYearRange.dateTo, hasIpc, selectedContractId, selectedScenarioId]);

  useEffect(() => {
    void loadWorkspaceData();
  }, [loadWorkspaceData]);

  const visibleContracts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return contractRecords.filter((contract) => {
      if (statusFilter !== "all" && contract.lifecycleStatus !== statusFilter) {
        return false;
      }
      if (!normalized) {
        return true;
      }
      return (
        contract.contractNumber.toLowerCase().includes(normalized) ||
        contract.providerName.toLowerCase().includes(normalized) ||
        contract.owner.toLowerCase().includes(normalized)
      );
    });
  }, [query, statusFilter, contractRecords]);

  useEffect(() => {
    if (visibleContracts.length === 0) {
      return;
    }
    if (!visibleContracts.some((contract) => contract.id === selectedContractId)) {
      setSelectedContractId(visibleContracts[0].id);
    }
  }, [selectedContractId, visibleContracts]);

  useEffect(() => {
    if (!selectedContractId) {
      return;
    }
    setSearchParams(
      (current) =>
        mergeQuery(current, {
          contract: selectedContractId
        }),
      { replace: true }
    );
  }, [selectedContractId, setSearchParams]);

  const selectedContract =
    contractRecords.find((contract) => contract.id === selectedContractId) ??
    visibleContracts[0] ??
    null;

  function openService(serviceId: string): void {
    navigate(`/services?service=${serviceId}&tab=contracts`);
  }

  function openAlert(contractId: string): void {
    navigate(`/alerts?tab=all&entityType=contract&entityId=${contractId}`);
  }

  function openReplacement(contractId: string): void {
    navigate(`/reports?replacementContractId=${contractId}`);
  }

  function openCreateDrawer(): void {
    const defaultService = serviceChoices[0]?.value ?? contractRecords[0]?.linkedServiceIds[0] ?? "";
    setDrawerMode("create");
    setEditingContractId(null);
    setFormState(createDefaultFormState(defaultService));
    setFormError(null);
    setDrawerOpen(true);
  }

  function openEditDrawer(contract: (typeof CONTRACT_RECORDS)[number]): void {
    setDrawerMode("edit");
    setEditingContractId(contract.id);
    setFormState(fromContract(contract));
    setFormError(null);
    setDrawerOpen(true);
  }

  function handleSubmitDrawer(): void {
    const serviceId = formState.serviceId;
    const contractNumber = formState.contractNumber.trim();
    const owner = formState.owner.trim();
    const noticePeriodDays = Number.parseInt(formState.noticePeriodDays, 10);

    if (!serviceId) {
      setFormError("Linked service is required.");
      return;
    }
    if (!contractNumber) {
      setFormError("Contract number is required.");
      return;
    }
    if (!owner) {
      setFormError("Owner is required.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(formState.startDate)) {
      setFormError("Start date must be YYYY-MM-DD.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(formState.endDate)) {
      setFormError("End date must be YYYY-MM-DD.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(formState.renewalDate)) {
      setFormError("Renewal date must be YYYY-MM-DD.");
      return;
    }
    if (Number.isNaN(noticePeriodDays) || noticePeriodDays <= 0) {
      setFormError("Notice period must be a positive integer.");
      return;
    }

    if (hasIpc) {
      void (async () => {
        try {
          if (drawerMode === "create") {
            const created = await createContractIpc({
              serviceId,
              contractNumber,
              startDate: formState.startDate,
              endDate: formState.endDate,
              renewalType: formState.renewalType,
              renewalDate: formState.renewalDate,
              noticePeriodDays,
              owner,
              lifecycleStatus: formState.lifecycleStatus,
              renewalAction: formState.renewalAction
            });
            if (created) {
              setSelectedContractId(created.id);
            }
            setMessage(`Contract ${contractNumber} created.`);
          } else if (editingContractId) {
            await updateContractIpc({
              id: editingContractId,
              serviceId,
              contractNumber,
              startDate: formState.startDate,
              endDate: formState.endDate,
              renewalType: formState.renewalType,
              renewalDate: formState.renewalDate,
              noticePeriodDays,
              owner,
              lifecycleStatus: formState.lifecycleStatus,
              renewalAction: formState.renewalAction
            });
            setMessage(`Contract ${contractNumber} updated.`);
          }
          setDrawerOpen(false);
          setFormError(null);
          await loadWorkspaceData();
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          setFormError(detail);
        }
      })();
      return;
    }

    const service = serviceById[serviceId];
    const nextContract = {
      id: editingContractId ?? normalizeContractId(contractNumber),
      vendorId: service?.vendorId ?? "",
      contractNumber,
      providerName: service?.vendorName ?? "",
      owner,
      startDate: formState.startDate,
      endDate: formState.endDate,
      renewalDate: formState.renewalDate,
      noticeDeadline: buildNoticeDeadline(formState.renewalDate, noticePeriodDays),
      lifecycleStatus: formState.lifecycleStatus,
      renewalAction: formState.renewalAction,
      linkedServiceIds: [serviceId],
      totalCommitmentMinor: 0
    } satisfies (typeof CONTRACT_RECORDS)[number];

    setContractRecords((current) => {
      if (drawerMode === "create") {
        return [...current, nextContract];
      }
      return current.map((contract) =>
        contract.id === nextContract.id ? nextContract : contract
      );
    });
    setSelectedContractId(nextContract.id);
    setDrawerOpen(false);
    setFormError(null);
    setMessage(
      drawerMode === "create"
        ? `Contract ${contractNumber} created.`
        : `Contract ${contractNumber} updated.`
    );
  }

  function handleConfirmDelete(): void {
    if (!deleteContractId) {
      return;
    }
    if (hasIpc) {
      const deletingId = deleteContractId;
      const contractNumber =
        contractRecords.find((entry) => entry.id === deletingId)?.contractNumber ?? deletingId;
      void (async () => {
        try {
          await deleteContractIpc(deletingId);
          if (selectedContractId === deletingId) {
            setSelectedContractId("");
          }
          setMessage(`Contract ${contractNumber} deleted.`);
          setDeleteContractId(null);
          await loadWorkspaceData();
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          setMessage(`Delete failed: ${detail}`);
          setDeleteContractId(null);
        }
      })();
      return;
    }

    const contractNumber =
      contractRecords.find((entry) => entry.id === deleteContractId)?.contractNumber ??
      deleteContractId;
    setContractRecords((current) => current.filter((entry) => entry.id !== deleteContractId));
    if (selectedContractId === deleteContractId) {
      setSelectedContractId("");
    }
    setDeleteContractId(null);
    setMessage(`Contract ${contractNumber} deleted.`);
  }

  function openHelpTopic(
    topic: string,
    anchor?: string,
    q?: string,
    context?: string
  ): void {
    void openHelpWindow({ topic, anchor, q, context });
  }

  return (
    <section className="contracts-page">
      <PageHeader
        title="Contracts Workspace"
        subtitle="Contract lifecycle management with linked services, renewal actions, and replacement pathways."
        actions={
          <Button appearance="primary" onClick={openCreateDrawer}>
            Create Contract
          </Button>
        }
      />

      <div className="contracts-toolbar">
        <Input
          aria-label="Search contracts"
          placeholder="Search contract number, provider, or owner"
          value={query}
          onChange={(_event, data) => setQuery(data.value)}
        />
        <Select
          aria-label="Filter by contract status"
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as ContractLifecycleStatus | "all")
          }
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="renewal-window">Renewal window</option>
          <option value="notice-window">Notice window</option>
          <option value="expired">Expired</option>
        </Select>
      </div>

      {loading ? <Text>Loading contracts...</Text> : null}
      {message ? <Text>{message}</Text> : null}

      <div className="contracts-layout">
        <section>
          {visibleContracts.length === 0 ? (
            <EmptyState
              title="No contracts match filters"
              description="Adjust search text or status filters to inspect contract records."
            />
          ) : (
            <Table aria-label="Contracts table">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Contract</TableHeaderCell>
                  <TableHeaderCell>Provider</TableHeaderCell>
                  <TableHeaderCell>Renewal</TableHeaderCell>
                  <TableHeaderCell>Notice deadline</TableHeaderCell>
                  <TableHeaderCell>Commitment</TableHeaderCell>
                  <TableHeaderCell>Linked services</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>Actions</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleContracts.map((contract) => {
                  const firstServiceId = contract.linkedServiceIds[0] ?? null;
                  const selected = selectedContract?.id === contract.id;
                  return (
                    <TableRow
                      key={contract.id}
                      className={
                        selected ? "contracts-row contracts-row--selected" : "contracts-row"
                      }
                      onClick={() => setSelectedContractId(contract.id)}
                    >
                      <TableCell>{contract.contractNumber}</TableCell>
                      <TableCell>{contract.providerName}</TableCell>
                      <TableCell>
                        <Text>{formatDate(contract.renewalDate)}</Text>
                        <Text size={200}>
                          {renewalWindowLabel(contract.renewalDate, referenceDate)}
                        </Text>
                      </TableCell>
                      <TableCell>{formatDate(contract.noticeDeadline)}</TableCell>
                      <TableCell>{formatUsd(contract.totalCommitmentMinor)}</TableCell>
                      <TableCell data-testid={`contract-linked-count-${contract.id}`}>
                        {contract.linkedServiceIds.length}
                      </TableCell>
                      <TableCell>
                        <StatusChip
                          label={toTitleCaseLabel(contract.lifecycleStatus)}
                          tone={contractLifecycleTone(contract.lifecycleStatus)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="contracts-row__actions">
                          <Button
                            size="small"
                            appearance="secondary"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedContractId(contract.id);
                            }}
                          >
                            Review
                          </Button>
                          <Button
                            size="small"
                            appearance="secondary"
                            onClick={(event) => {
                              event.stopPropagation();
                              openEditDrawer(contract);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="small"
                            appearance="secondary"
                            disabled={!firstServiceId}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (!firstServiceId) {
                                return;
                              }
                              openService(firstServiceId);
                            }}
                          >
                            Open Service
                          </Button>
                          <Button
                            size="small"
                            appearance="secondary"
                            onClick={(event) => {
                              event.stopPropagation();
                              openAlert(contract.id);
                            }}
                          >
                            Open Alert
                          </Button>
                          <Button
                            size="small"
                            appearance="secondary"
                            onClick={(event) => {
                              event.stopPropagation();
                              openReplacement(contract.id);
                            }}
                          >
                            Open Replacement
                          </Button>
                          <Button
                            size="small"
                            appearance="secondary"
                            onClick={(event) => {
                              event.stopPropagation();
                              setDeleteContractId(contract.id);
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
          {selectedContract ? (
            <Card className="contracts-detail">
              <Title3>Contract Detail</Title3>
              <Text>{selectedContract.contractNumber}</Text>
              <Text>{`Provider: ${selectedContract.providerName}`}</Text>
              <Text>{`Owner: ${selectedContract.owner}`}</Text>
              <Text>{`Term: ${formatDate(selectedContract.startDate)} to ${formatDate(
                selectedContract.endDate
              )}`}</Text>
              <Text>{`Renewal action: ${selectedContract.renewalAction}`}</Text>
              <Text weight="semibold">Linked services</Text>
              <ul className="contracts-detail__list">
                {selectedContract.linkedServiceIds.map((serviceId) => {
                  const service = SERVICE_BY_ID[serviceId];
                  const serviceFromState = serviceById[serviceId];
                  if (serviceFromState) {
                    return (
                      <li key={serviceFromState.id} className="contracts-linked-service">
                        <Text>{serviceFromState.name}</Text>
                        <Button
                          size="small"
                          appearance="secondary"
                          onClick={() => openService(serviceFromState.id)}
                        >
                          {`Open Service ${serviceFromState.name}`}
                        </Button>
                      </li>
                    );
                  }
                  if (!service) {
                    return null;
                  }
                  return (
                    <li key={service.id} className="contracts-linked-service">
                      <Text>{service.name}</Text>
                      <Button
                        size="small"
                        appearance="secondary"
                        onClick={() => openService(service.id)}
                      >
                        {`Open Service ${service.name}`}
                      </Button>
                    </li>
                  );
                })}
              </ul>
              <div className="contracts-detail__actions">
                <Button
                  size="small"
                  appearance="secondary"
                  onClick={() => openAlert(selectedContract.id)}
                >
                  Open Related Alert
                </Button>
                <Button
                  size="small"
                  appearance="secondary"
                  onClick={() => openReplacement(selectedContract.id)}
                >
                  Open Replacement Workspace
                </Button>
                <Button
                  size="small"
                  appearance="primary"
                  onClick={() =>
                    setMessage(
                      `Renewal review started for ${selectedContract.contractNumber}.`
                    )
                  }
                >
                  Start Renewal Review
                </Button>
              </div>
            </Card>
          ) : (
            <EmptyState
              title="No contract selected"
              description="Select a contract row to inspect metadata and linked services."
            />
          )}
        </aside>
      </div>

      <FormDrawer
        open={drawerOpen}
        title={drawerMode === "create" ? "Create Contract" : "Edit Contract"}
        onOpenChange={setDrawerOpen}
        onSubmit={handleSubmitDrawer}
        submitLabel={drawerMode === "create" ? "Create" : "Save"}
      >
        <div className="contracts-form">
          <section className="contracts-form__section">
            <div className="contracts-form__section-header">
              <Text weight="semibold">Core details</Text>
              <Text size={200}>Identity, linked service, term, and renewal configuration.</Text>
              <Button
                appearance="secondary"
                size="small"
                type="button"
                onClick={() =>
                  openHelpTopic(
                    "contracts-form",
                    "createedit-contract-form",
                    "contract form",
                    "contracts:form"
                  )
                }
              >
                Contract Form Guide
              </Button>
            </div>
            <div className="contracts-form__grid contracts-form__grid--two">
              <div className="contracts-form__field contracts-form__field--full">
                <Text className="contracts-form__label" size={200} weight="medium">
                  Linked service
                </Text>
                <Select
                  aria-label="Contract linked service"
                  value={formState.serviceId}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, serviceId: event.target.value }))
                  }
                >
                  <option value="">Select service</option>
                  {serviceChoices.map((entry) => (
                    <option key={entry.value} value={entry.value}>
                      {entry.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="contracts-form__field">
                <Text className="contracts-form__label" size={200} weight="medium">
                  Contract number
                </Text>
                <Input
                  aria-label="Contract number"
                  value={formState.contractNumber}
                  onChange={(_event, data) =>
                    setFormState((current) => ({ ...current, contractNumber: data.value }))
                  }
                  placeholder="CTR-0001"
                />
              </div>
              <div className="contracts-form__field">
                <Text className="contracts-form__label" size={200} weight="medium">
                  Owner
                </Text>
                <Input
                  aria-label="Contract owner"
                  value={formState.owner}
                  onChange={(_event, data) =>
                    setFormState((current) => ({ ...current, owner: data.value }))
                  }
                  placeholder="Owner"
                />
              </div>
              <div className="contracts-form__field">
                <Text className="contracts-form__label" size={200} weight="medium">
                  Start date
                </Text>
                <Input
                  aria-label="Contract start date"
                  type="date"
                  value={formState.startDate}
                  onChange={(_event, data) =>
                    setFormState((current) => ({ ...current, startDate: data.value }))
                  }
                />
              </div>
              <div className="contracts-form__field">
                <Text className="contracts-form__label" size={200} weight="medium">
                  End date
                </Text>
                <Input
                  aria-label="Contract end date"
                  type="date"
                  value={formState.endDate}
                  onChange={(_event, data) =>
                    setFormState((current) => ({ ...current, endDate: data.value }))
                  }
                />
              </div>
              <div className="contracts-form__field">
                <Text className="contracts-form__label" size={200} weight="medium">
                  Renewal type
                </Text>
                <Select
                  aria-label="Contract renewal type"
                  value={formState.renewalType}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      renewalType: event.target.value as "auto" | "manual" | "none"
                    }))
                  }
                >
                  <option value="auto">{toTitleCaseLabel("auto")}</option>
                  <option value="manual">{toTitleCaseLabel("manual")}</option>
                  <option value="none">{toTitleCaseLabel("none")}</option>
                </Select>
              </div>
              <div className="contracts-form__field">
                <Text className="contracts-form__label" size={200} weight="medium">
                  Renewal date
                </Text>
                <Input
                  aria-label="Contract renewal date"
                  type="date"
                  value={formState.renewalDate}
                  onChange={(_event, data) =>
                    setFormState((current) => ({ ...current, renewalDate: data.value }))
                  }
                />
              </div>
              <div className="contracts-form__field">
                <Text className="contracts-form__label" size={200} weight="medium">
                  Notice period days
                </Text>
                <Input
                  aria-label="Contract notice period days"
                  type="number"
                  min="1"
                  value={formState.noticePeriodDays}
                  onChange={(_event, data) =>
                    setFormState((current) => ({ ...current, noticePeriodDays: data.value }))
                  }
                />
              </div>
              <div className="contracts-form__field">
                <Text className="contracts-form__label" size={200} weight="medium">
                  Lifecycle status
                </Text>
                <Select
                  aria-label="Contract lifecycle status"
                  value={formState.lifecycleStatus}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      lifecycleStatus: event.target.value as ContractLifecycleStatus
                    }))
                  }
                >
                  <option value="active">{toTitleCaseLabel("active")}</option>
                  <option value="renewal-window">{toTitleCaseLabel("renewal-window")}</option>
                  <option value="notice-window">{toTitleCaseLabel("notice-window")}</option>
                  <option value="expired">{toTitleCaseLabel("expired")}</option>
                </Select>
              </div>
              <div className="contracts-form__field">
                <Text className="contracts-form__label" size={200} weight="medium">
                  Renewal action
                </Text>
                <Select
                  aria-label="Contract renewal action"
                  value={formState.renewalAction}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      renewalAction: event.target.value as
                        | "auto-renew"
                        | "manual-review"
                        | "cancel-window"
                    }))
                  }
                >
                  <option value="auto-renew">{toTitleCaseLabel("auto-renew")}</option>
                  <option value="manual-review">{toTitleCaseLabel("manual-review")}</option>
                  <option value="cancel-window">{toTitleCaseLabel("cancel-window")}</option>
                </Select>
              </div>
            </div>
          </section>
        </div>
        {formError ? <InlineError message={formError} /> : null}
      </FormDrawer>

      <ConfirmDialog
        open={deleteContractId !== null}
        title="Delete contract?"
        message="Delete removes this contract from active lifecycle workflows."
        onOpenChange={(open) => {
          if (!open) {
            setDeleteContractId(null);
          }
        }}
        onConfirm={handleConfirmDelete}
        confirmLabel="Delete"
      />
    </section>
  );
}
