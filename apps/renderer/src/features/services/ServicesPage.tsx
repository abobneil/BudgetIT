import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Input,
  Select,
  Tab,
  TabList,
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
import {
  createService as createServiceIpc,
  deleteService as deleteServiceIpc,
  isIpcAvailable,
  listContracts as listContractsIpc,
  listExpenses as listExpensesIpc,
  listServices as listServicesIpc,
  listVendors as listVendorsIpc,
  updateService as updateServiceIpc
} from "../../lib/ipcClient";
import {
  buildVendorFilterOptions,
  matchesVendorFilter
} from "../vendors/vendor-filter-model";
import {
  CONTRACT_BY_ID,
  SERVICE_RECORDS,
  type ServiceRecord,
  type ServiceRisk
} from "./service-contract-data";
import {
  deriveServiceLifecycleState,
  isInRenewalWindow,
  renewalWindowLabel,
  serviceLifecycleTone,
  serviceRiskTone
} from "./service-lifecycle-model";
import "./ServicesPage.css";

type ServiceDetailTab =
  | "overview"
  | "expenses"
  | "contracts"
  | "renewals"
  | "replacement";

type ServiceStatusValue = "active" | "trial" | "deprecated" | "retiring" | "retired";

type WorkspaceServiceRecord = ServiceRecord & {
  status: ServiceStatusValue;
};

type ServiceFormState = {
  vendorId: string;
  name: string;
  owner: string;
  annualSpendMinor: string;
  status: ServiceStatusValue;
  risk: ServiceRisk;
  replacementStatus: "not-started" | "candidate-review" | "approved";
};

const REFERENCE_DATE = "2026-03-01";

function resolveDetailTab(value: string | null): ServiceDetailTab {
  if (
    value === "overview" ||
    value === "expenses" ||
    value === "contracts" ||
    value === "renewals" ||
    value === "replacement"
  ) {
    return value;
  }
  return "overview";
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

function formatUsd(amountMinor: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(amountMinor / 100);
}

function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00.000Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  });
}

function primaryContractId(service: WorkspaceServiceRecord): string | null {
  return service.linkedContractIds[0] ?? null;
}

function normalizeServiceId(name: string): string {
  return `svc-${name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}`;
}

function createDefaultFormState(vendorId: string): ServiceFormState {
  return {
    vendorId,
    name: "",
    owner: "",
    annualSpendMinor: "0",
    status: "active",
    risk: "low",
    replacementStatus: "not-started"
  };
}

function fromService(service: WorkspaceServiceRecord): ServiceFormState {
  return {
    vendorId: service.vendorId,
    name: service.name,
    owner: service.owner,
    annualSpendMinor: String(service.annualSpendMinor),
    status: service.status,
    risk: service.risk,
    replacementStatus: service.replacementStatus
  };
}

export function ServicesPage() {
  const navigate = useNavigate();
  const hasIpc = isIpcAvailable();
  const [searchParams, setSearchParams] = useSearchParams();
  const [serviceRecords, setServiceRecords] = useState<WorkspaceServiceRecord[]>(
    SERVICE_RECORDS.map((entry) => ({
      ...entry,
      status: "active"
    }))
  );
  const [vendorNameById, setVendorNameById] = useState<Record<string, string>>(
    Object.fromEntries(SERVICE_RECORDS.map((entry) => [entry.vendorId, entry.vendorName]))
  );
  const [contractById, setContractById] = useState<Record<string, { id: string; contractNumber: string; providerName: string }>>(
    () =>
      Object.fromEntries(
        Object.values(CONTRACT_BY_ID).map((contract) => [
          contract.id,
          {
            id: contract.id,
            contractNumber: contract.contractNumber,
            providerName: contract.providerName
          }
        ])
      )
  );
  const [loading, setLoading] = useState(false);
  const [pageMessage, setPageMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [vendorFilter, setVendorFilter] = useState<string>(() => {
    return searchParams.get("vendor") ?? "all";
  });
  const [riskFilter, setRiskFilter] = useState<ServiceRisk | "all">("all");
  const [detailTab, setDetailTab] = useState<ServiceDetailTab>(() =>
    resolveDetailTab(searchParams.get("tab"))
  );
  const [selectedServiceId, setSelectedServiceId] = useState<string>(() => searchParams.get("service") ?? "");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create");
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [formState, setFormState] = useState<ServiceFormState>(() => createDefaultFormState(""));
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteServiceId, setDeleteServiceId] = useState<string | null>(null);

  const vendorChoices = useMemo(
    () =>
      Object.entries(vendorNameById)
        .map(([id, name]) => ({ id, name }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    [vendorNameById]
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
        listExpensesIpc({ scenarioId: "baseline" })
      ]);
      const nextVendorNameById = Object.fromEntries(
        vendors.map((vendor) => [vendor.id, vendor.name])
      );
      setVendorNameById(nextVendorNameById);
      const contractsByServiceId = new Map<string, typeof contracts>();
      for (const contract of contracts) {
        const list = contractsByServiceId.get(contract.serviceId) ?? [];
        list.push(contract);
        contractsByServiceId.set(contract.serviceId, list);
      }
      const expensesByServiceId = new Map<string, typeof expenses>();
      for (const expense of expenses) {
        const list = expensesByServiceId.get(expense.serviceId) ?? [];
        list.push(expense);
        expensesByServiceId.set(expense.serviceId, list);
      }
      const mappedServices: WorkspaceServiceRecord[] = services.map((service) => {
        const linkedContracts = contractsByServiceId.get(service.id) ?? [];
        const linkedExpenses = expensesByServiceId.get(service.id) ?? [];
        const firstRenewal =
          linkedContracts
            .map((contract) => contract.renewalDate)
            .filter((value): value is string => Boolean(value))
            .sort()[0] ?? "2026-12-31";
        return {
          id: service.id,
          vendorId: service.vendorId,
          name: service.name,
          vendorName: nextVendorNameById[service.vendorId] ?? service.vendorId,
          owner: service.ownerTeam ?? "",
          annualSpendMinor: service.annualSpendMinor,
          renewalDate: firstRenewal,
          risk: service.risk,
          replacementStatus: service.replacementStatus,
          linkedContractIds: linkedContracts.map((contract) => contract.id),
          expenseLines: linkedExpenses
            .filter(
              (
                expense
              ): expense is typeof expense & {
                status: "planned" | "approved" | "committed" | "actual";
              } => expense.status !== "cancelled"
            )
            .map((expense) => ({
              id: expense.id,
              name: expense.name,
              amountMinor: expense.amountMinor,
              status: expense.status
            })),
          status: service.status
        };
      });
      setServiceRecords(mappedServices);
      setContractById(
        Object.fromEntries(
          contracts.map((contract) => [
            contract.id,
            {
              id: contract.id,
              contractNumber: contract.contractNumber ?? contract.id,
              providerName:
                nextVendorNameById[
                  services.find((service) => service.id === contract.serviceId)?.vendorId ?? ""
                ] ?? ""
            }
          ])
        )
      );
      if (mappedServices.length > 0 && !mappedServices.some((entry) => entry.id === selectedServiceId)) {
        setSelectedServiceId(mappedServices[0].id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setPageMessage(`Failed to load services workspace: ${message}`);
    } finally {
      setLoading(false);
    }
  }, [hasIpc, selectedServiceId]);

  useEffect(() => {
    void loadWorkspaceData();
  }, [loadWorkspaceData]);

  const vendorOptions = useMemo(
    () =>
      buildVendorFilterOptions(
        serviceRecords.map((service) => ({
          vendorId: service.vendorId,
          vendorName: service.vendorName
        }))
      ),
    [serviceRecords]
  );

  const visibleServices = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return serviceRecords.filter((service) => {
      if (!matchesVendorFilter(vendorFilter, service.vendorId)) {
        return false;
      }
      if (riskFilter !== "all" && service.risk !== riskFilter) {
        return false;
      }
      if (!normalized) {
        return true;
      }
      return (
        service.name.toLowerCase().includes(normalized) ||
        service.vendorName.toLowerCase().includes(normalized) ||
        service.owner.toLowerCase().includes(normalized)
      );
    });
  }, [query, riskFilter, vendorFilter, serviceRecords]);

  useEffect(() => {
    if (visibleServices.length === 0) {
      return;
    }
    if (!visibleServices.some((service) => service.id === selectedServiceId)) {
      setSelectedServiceId(visibleServices[0].id);
    }
  }, [selectedServiceId, visibleServices]);

  useEffect(() => {
    if (!selectedServiceId) {
      return;
    }
    setSearchParams(
      (current) =>
        mergeQuery(current, {
          service: selectedServiceId,
          tab: detailTab,
          vendor: vendorFilter === "all" ? null : vendorFilter
        }),
      { replace: true }
    );
  }, [detailTab, selectedServiceId, setSearchParams, vendorFilter]);

  const selectedService =
    serviceRecords.find((service) => service.id === selectedServiceId) ??
    visibleServices[0] ??
    null;

  function openContract(contractId: string, serviceId: string): void {
    navigate(`/contracts?contract=${contractId}&service=${serviceId}`);
  }

  function openAlert(serviceId: string): void {
    navigate(`/alerts?tab=all&entityType=service&entityId=${serviceId}`);
  }

  function openReplacement(serviceId: string): void {
    navigate(`/reports?replacementServiceId=${serviceId}`);
  }

  function openCreateDrawer(): void {
    const defaultVendorId = vendorChoices[0]?.id ?? serviceRecords[0]?.vendorId ?? "";
    setDrawerMode("create");
    setEditingServiceId(null);
    setFormState(createDefaultFormState(defaultVendorId));
    setFormError(null);
    setDrawerOpen(true);
  }

  function openEditDrawer(service: WorkspaceServiceRecord): void {
    setDrawerMode("edit");
    setEditingServiceId(service.id);
    setFormState(fromService(service));
    setFormError(null);
    setDrawerOpen(true);
  }

  function handleSubmitDrawer(): void {
    const trimmedName = formState.name.trim();
    const trimmedOwner = formState.owner.trim();
    const annualSpendMinor = Number.parseInt(formState.annualSpendMinor, 10);

    if (!formState.vendorId) {
      setFormError("Vendor is required.");
      return;
    }
    if (!trimmedName) {
      setFormError("Service name is required.");
      return;
    }
    if (!trimmedOwner) {
      setFormError("Service owner is required.");
      return;
    }
    if (Number.isNaN(annualSpendMinor) || annualSpendMinor < 0) {
      setFormError("Annual spend (minor units) must be zero or a positive integer.");
      return;
    }

    if (hasIpc) {
      void (async () => {
        try {
          if (drawerMode === "create") {
            const created = await createServiceIpc({
              vendorId: formState.vendorId,
              name: trimmedName,
              status: formState.status,
              ownerTeam: trimmedOwner,
              annualSpendMinor,
              risk: formState.risk,
              replacementStatus: formState.replacementStatus
            });
            if (created) {
              setSelectedServiceId(created.id);
            }
            setPageMessage(`Service ${trimmedName} created.`);
          } else if (editingServiceId) {
            await updateServiceIpc({
              id: editingServiceId,
              vendorId: formState.vendorId,
              name: trimmedName,
              status: formState.status,
              ownerTeam: trimmedOwner,
              annualSpendMinor,
              risk: formState.risk,
              replacementStatus: formState.replacementStatus
            });
            setPageMessage(`Service ${trimmedName} updated.`);
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

    const nextService: WorkspaceServiceRecord = {
      id: editingServiceId ?? normalizeServiceId(trimmedName),
      vendorId: formState.vendorId,
      name: trimmedName,
      vendorName: vendorNameById[formState.vendorId] ?? formState.vendorId,
      owner: trimmedOwner,
      annualSpendMinor,
      renewalDate: "2026-12-31",
      risk: formState.risk,
      replacementStatus: formState.replacementStatus,
      linkedContractIds: [],
      expenseLines: [],
      status: formState.status
    };

    setServiceRecords((current) => {
      if (drawerMode === "create") {
        return [...current, nextService];
      }
      return current.map((service) =>
        service.id === nextService.id ? { ...service, ...nextService } : service
      );
    });
    setSelectedServiceId(nextService.id);
    setDrawerOpen(false);
    setFormError(null);
    setPageMessage(
      drawerMode === "create"
        ? `Service ${nextService.name} created.`
        : `Service ${nextService.name} updated.`
    );
  }

  function confirmDelete(): void {
    if (!deleteServiceId) {
      return;
    }
    if (hasIpc) {
      const deletingId = deleteServiceId;
      const serviceName =
        serviceRecords.find((entry) => entry.id === deletingId)?.name ?? deletingId;
      void (async () => {
        try {
          await deleteServiceIpc(deletingId);
          if (selectedServiceId === deletingId) {
            setSelectedServiceId("");
          }
          setPageMessage(`Service ${serviceName} deleted.`);
          setDeleteServiceId(null);
          await loadWorkspaceData();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          setPageMessage(`Delete failed: ${message}`);
          setDeleteServiceId(null);
        }
      })();
      return;
    }

    const deletedName =
      serviceRecords.find((entry) => entry.id === deleteServiceId)?.name ?? deleteServiceId;
    setServiceRecords((current) => current.filter((entry) => entry.id !== deleteServiceId));
    if (selectedServiceId === deleteServiceId) {
      setSelectedServiceId("");
    }
    setDeleteServiceId(null);
    setPageMessage(`Service ${deletedName} deleted.`);
  }

  return (
    <section className="services-page">
      <PageHeader
        title="Services Workspace"
        subtitle="Lifecycle-focused service management with renewal context and replacement pathways."
        helpTopic="services-workspace"
        actions={
          <Button appearance="primary" onClick={openCreateDrawer}>
            Create Service
          </Button>
        }
      />

      <div className="services-toolbar">
        <Input
          aria-label="Search services"
          placeholder="Search service, vendor, or owner"
          value={query}
          onChange={(_event, data) => setQuery(data.value)}
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
        <Select
          aria-label="Filter by risk"
          value={riskFilter}
          onChange={(event) =>
            setRiskFilter(event.target.value as ServiceRisk | "all")
          }
        >
          <option value="all">All risks</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </Select>
      </div>

      {loading ? <Text>Loading services...</Text> : null}
      {pageMessage ? <Text>{pageMessage}</Text> : null}

      <div className="services-layout">
        <section>
          {visibleServices.length === 0 ? (
            <EmptyState
              title="No services match filters"
              description="Adjust search text or risk filter to see lifecycle records."
            />
          ) : (
            <Table aria-label="Services table">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Service</TableHeaderCell>
                  <TableHeaderCell>Vendor</TableHeaderCell>
                  <TableHeaderCell>Renewal</TableHeaderCell>
                  <TableHeaderCell>Annual spend</TableHeaderCell>
                  <TableHeaderCell>Risk</TableHeaderCell>
                  <TableHeaderCell>Replacement</TableHeaderCell>
                  <TableHeaderCell>Linked contracts</TableHeaderCell>
                  <TableHeaderCell>Actions</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleServices.map((service) => {
                  const lifecycleState = deriveServiceLifecycleState(
                    service.renewalDate,
                    service.risk,
                    REFERENCE_DATE
                  );
                  const highlightRenewal = isInRenewalWindow(
                    service.renewalDate,
                    REFERENCE_DATE,
                    60
                  );
                  const firstContractId = primaryContractId(service);
                  const selected = selectedService?.id === service.id;

                  return (
                    <TableRow
                      key={service.id}
                      className={selected ? "services-row services-row--selected" : "services-row"}
                      onClick={() => setSelectedServiceId(service.id)}
                    >
                      <TableCell>{service.name}</TableCell>
                      <TableCell>{service.vendorName}</TableCell>
                      <TableCell>
                        <Text
                          className={
                            highlightRenewal
                              ? "services-renewal services-renewal--highlight"
                              : "services-renewal"
                          }
                        >
                          {formatDate(service.renewalDate)}
                        </Text>
                        <StatusChip
                          label={lifecycleState.toUpperCase()}
                          tone={serviceLifecycleTone(lifecycleState)}
                        />
                      </TableCell>
                      <TableCell>{formatUsd(service.annualSpendMinor)}</TableCell>
                      <TableCell>
                        <StatusChip
                          label={service.risk.toUpperCase()}
                          tone={serviceRiskTone(service.risk)}
                        />
                      </TableCell>
                      <TableCell>{service.replacementStatus}</TableCell>
                      <TableCell data-testid={`service-linked-count-${service.id}`}>
                        {service.linkedContractIds.length}
                      </TableCell>
                      <TableCell>
                        <div className="services-row__actions">
                          <Button
                            size="small"
                            appearance="secondary"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedServiceId(service.id);
                            }}
                          >
                            Review
                          </Button>
                          <Button
                            size="small"
                            appearance="secondary"
                            onClick={(event) => {
                              event.stopPropagation();
                              openEditDrawer(service);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="small"
                            appearance="secondary"
                            disabled={!firstContractId}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (!firstContractId) {
                                return;
                              }
                              openContract(firstContractId, service.id);
                            }}
                          >
                            Open contract
                          </Button>
                          <Button
                            size="small"
                            appearance="secondary"
                            onClick={(event) => {
                              event.stopPropagation();
                              openAlert(service.id);
                            }}
                          >
                            Open alert
                          </Button>
                          <Button
                            size="small"
                            appearance="secondary"
                            onClick={(event) => {
                              event.stopPropagation();
                              openReplacement(service.id);
                            }}
                          >
                            Open replacement
                          </Button>
                          <Button
                            size="small"
                            appearance="secondary"
                            onClick={(event) => {
                              event.stopPropagation();
                              setDeleteServiceId(service.id);
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
          {selectedService ? (
            <Card className="services-detail">
              <Title3>{selectedService.name}</Title3>
              <Text>{`Owner: ${selectedService.owner}`}</Text>
              <Text>{`Vendor: ${selectedService.vendorName}`}</Text>
              <Text>{`Status: ${selectedService.status}`}</Text>
              <Text>{`Renewal: ${formatDate(selectedService.renewalDate)} (${renewalWindowLabel(
                selectedService.renewalDate,
                REFERENCE_DATE
              )})`}</Text>

              <TabList
                selectedValue={detailTab}
                onTabSelect={(_event, data) =>
                  setDetailTab(resolveDetailTab(String(data.value)))
                }
              >
                <Tab value="overview">Overview</Tab>
                <Tab value="expenses">Expenses</Tab>
                <Tab value="contracts">Contracts</Tab>
                <Tab value="renewals">Renewals</Tab>
                <Tab value="replacement">Replacement Plan</Tab>
              </TabList>

              {detailTab === "overview" ? (
                <div className="services-detail__section">
                  <Text>{`Annual spend: ${formatUsd(selectedService.annualSpendMinor)}`}</Text>
                  <Text>{`Risk level: ${selectedService.risk}`}</Text>
                  <Text>{`Replacement status: ${selectedService.replacementStatus}`}</Text>
                </div>
              ) : null}

              {detailTab === "expenses" ? (
                <div className="services-detail__section">
                  <Text weight="semibold">Linked expense lines</Text>
                  <ul className="services-detail__list">
                    {selectedService.expenseLines.map((line) => (
                      <li key={line.id}>
                        <Text>{`${line.name} - ${formatUsd(line.amountMinor)} (${line.status})`}</Text>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {detailTab === "contracts" ? (
                <div className="services-detail__section">
                  <Text weight="semibold">Linked contracts</Text>
                  <ul className="services-detail__list">
                    {selectedService.linkedContractIds.map((contractId) => {
                      const contract = CONTRACT_BY_ID[contractId];
                      const contractFromState = contractById[contractId];
                      if (contractFromState) {
                        return (
                          <li key={contractFromState.id} className="services-linked-contract">
                            <Text>{`${contractFromState.contractNumber} - ${contractFromState.providerName}`}</Text>
                            <Button
                              size="small"
                              appearance="secondary"
                              onClick={() => openContract(contractFromState.id, selectedService.id)}
                            >
                              {`Open contract ${contractFromState.contractNumber}`}
                            </Button>
                          </li>
                        );
                      }
                      if (!contract) {
                        return null;
                      }
                      return (
                        <li key={contract.id} className="services-linked-contract">
                          <Text>{`${contract.contractNumber} - ${contract.providerName}`}</Text>
                          <Button
                            size="small"
                            appearance="secondary"
                            onClick={() => openContract(contract.id, selectedService.id)}
                          >
                            {`Open contract ${contract.contractNumber}`}
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              {detailTab === "renewals" ? (
                <div className="services-detail__section">
                  <Text weight="semibold">Renewal path</Text>
                  <Text>{renewalWindowLabel(selectedService.renewalDate, REFERENCE_DATE)}</Text>
                  <Button
                    size="small"
                    appearance="secondary"
                    onClick={() => openAlert(selectedService.id)}
                  >
                    Open related alert
                  </Button>
                </div>
              ) : null}

              {detailTab === "replacement" ? (
                <div className="services-detail__section">
                  <Text weight="semibold">Replacement planning</Text>
                  <Text>{`Current stage: ${selectedService.replacementStatus}`}</Text>
                  <Button
                    size="small"
                    appearance="secondary"
                    onClick={() => openReplacement(selectedService.id)}
                  >
                    Open replacement workspace
                  </Button>
                </div>
              ) : null}
            </Card>
          ) : (
            <EmptyState
              title="No service selected"
              description="Select a service row to inspect lifecycle and linked context."
            />
          )}
        </aside>
      </div>

      <FormDrawer
        open={drawerOpen}
        title={drawerMode === "create" ? "Create Service" : "Edit Service"}
        onOpenChange={setDrawerOpen}
        onSubmit={handleSubmitDrawer}
        submitLabel={drawerMode === "create" ? "Create" : "Save"}
        helpTopic="services-form"
      >
        <div className="services-form">
          <section className="services-form__section">
            <div className="services-form__section-header">
              <Text weight="semibold">Core details</Text>
              <Text size={200}>Primary service identity, ownership, and lifecycle posture.</Text>
            </div>
            <div className="services-form__grid services-form__grid--two">
              <div className="services-form__field services-form__field--full">
                <Text className="services-form__label" size={200} weight="medium">
                  Service name
                </Text>
                <Input
                  aria-label="Service name"
                  value={formState.name}
                  onChange={(_event, data) =>
                    setFormState((current) => ({ ...current, name: data.value }))
                  }
                  placeholder="Service name"
                />
              </div>
              <div className="services-form__field services-form__field--full">
                <Text className="services-form__label" size={200} weight="medium">
                  Vendor
                </Text>
                <Select
                  aria-label="Service vendor"
                  value={formState.vendorId}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, vendorId: event.target.value }))
                  }
                >
                  <option value="">Select vendor</option>
                  {vendorChoices.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="services-form__field">
                <Text className="services-form__label" size={200} weight="medium">
                  Owner
                </Text>
                <Input
                  aria-label="Service owner"
                  value={formState.owner}
                  onChange={(_event, data) =>
                    setFormState((current) => ({ ...current, owner: data.value }))
                  }
                  placeholder="Owner team"
                />
              </div>
              <div className="services-form__field">
                <Text className="services-form__label" size={200} weight="medium">
                  Annual spend (minor units)
                </Text>
                <Input
                  aria-label="Service annual spend minor units"
                  type="number"
                  min="0"
                  value={formState.annualSpendMinor}
                  onChange={(_event, data) =>
                    setFormState((current) => ({ ...current, annualSpendMinor: data.value }))
                  }
                  placeholder="50000"
                />
              </div>
              <div className="services-form__field">
                <Text className="services-form__label" size={200} weight="medium">
                  Status
                </Text>
                <Select
                  aria-label="Service status"
                  value={formState.status}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      status: event.target.value as ServiceStatusValue
                    }))
                  }
                >
                  <option value="active">active</option>
                  <option value="trial">trial</option>
                  <option value="deprecated">deprecated</option>
                  <option value="retiring">retiring</option>
                  <option value="retired">retired</option>
                </Select>
              </div>
              <div className="services-form__field">
                <Text className="services-form__label" size={200} weight="medium">
                  Risk
                </Text>
                <Select
                  aria-label="Service risk"
                  value={formState.risk}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      risk: event.target.value as ServiceRisk
                    }))
                  }
                >
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </Select>
              </div>
              <div className="services-form__field services-form__field--full">
                <Text className="services-form__label" size={200} weight="medium">
                  Replacement status
                </Text>
                <Select
                  aria-label="Service replacement status"
                  value={formState.replacementStatus}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      replacementStatus: event.target.value as
                        | "not-started"
                        | "candidate-review"
                        | "approved"
                    }))
                  }
                >
                  <option value="not-started">not-started</option>
                  <option value="candidate-review">candidate-review</option>
                  <option value="approved">approved</option>
                </Select>
              </div>
            </div>
          </section>
        </div>
        {formError ? <InlineError message={formError} /> : null}
      </FormDrawer>

      <ConfirmDialog
        open={deleteServiceId !== null}
        title="Delete service?"
        message="Delete removes this service from active planning workflows."
        onOpenChange={(open) => {
          if (!open) {
            setDeleteServiceId(null);
          }
        }}
        onConfirm={confirmDelete}
        confirmLabel="Delete"
      />
    </section>
  );
}
