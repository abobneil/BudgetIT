import { useCallback, useEffect, useId, useMemo, useState } from "react";
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
import { buildSuggestionList } from "../../lib/autocomplete";
import { toTitleCaseLabel } from "../../ui/text/labelCase";
import {
  createOwner as createOwnerIpc,
  createService as createServiceIpc,
  deleteService as deleteServiceIpc,
  getOwnerUsage as getOwnerUsageIpc,
  isIpcAvailable,
  listContracts as listContractsIpc,
  listExpenses as listExpensesIpc,
  listOwners as listOwnersIpc,
  listServices as listServicesIpc,
  listVendors as listVendorsIpc,
  openHelpWindow,
  retireOwner as retireOwnerIpc,
  updateService as updateServiceIpc
} from "../../lib/ipcClient";
import {
  buildCurrencyInputExample,
  formatCurrencyInputMinor,
  formatCurrencyMinor,
  parseCurrencyInputToMinor,
  useScenarioCurrency
} from "../../lib/currency";
import {
  buildVendorFilterOptions,
  matchesVendorFilter
} from "../vendors/vendor-filter-model";
import { currentYearDateRange, toUtcIsoDate } from "../../lib/dateDefaults";
import {
  CONTRACT_BY_ID,
  SERVICE_RECORDS,
  CONTRACT_RECORDS,
  type ServiceRecord,
  type ServiceRisk
} from "./service-contract-data";
import { INITIAL_VENDOR_RECORDS } from "../vendors/vendor-data";
import { OwnerSelectField } from "../owners/OwnerSelectField";
import { buildOwnerOptions, toOwnerId } from "../owners/owner-model";
import {
  deriveServiceLifecycleState,
  isInRenewalWindow,
  renewalWindowLabel,
  serviceLifecycleTone,
  serviceRiskTone
} from "./service-lifecycle-model";
import { useScenarioContext } from "../scenarios/ScenarioContext";
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
  ownerId: string;
  annualSpendMinor: string;
  status: ServiceStatusValue;
  risk: ServiceRisk;
  replacementStatus: "not-started" | "candidate-review" | "approved";
};

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

function createDefaultFormState(vendorId: string, currency: string = "USD"): ServiceFormState {
  return {
    vendorId,
    name: "",
    ownerId: "",
    annualSpendMinor: formatCurrencyInputMinor(0, currency),
    status: "active",
    risk: "low",
    replacementStatus: "not-started"
  };
}

function fromService(service: WorkspaceServiceRecord, currency: string = "USD"): ServiceFormState {
  return {
    vendorId: service.vendorId,
    name: service.name,
    ownerId: service.ownerId,
    annualSpendMinor: formatCurrencyInputMinor(service.annualSpendMinor, currency),
    status: service.status,
    risk: service.risk,
    replacementStatus: service.replacementStatus
  };
}

export function ServicesPage() {
  const navigate = useNavigate();
  const hasIpc = isIpcAvailable();
  const { selectedScenarioId } = useScenarioContext();
  const displayCurrency = useScenarioCurrency(selectedScenarioId);
  const [searchParams, setSearchParams] = useSearchParams();
  const [serviceRecords, setServiceRecords] = useState<WorkspaceServiceRecord[]>(
    SERVICE_RECORDS.map((entry) => ({
      ...entry,
      status: "active"
    }))
  );
  const [vendorNameById, setVendorNameById] = useState<Record<string, string>>(
    Object.fromEntries(INITIAL_VENDOR_RECORDS.map((entry) => [entry.id, entry.name]))
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
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<ServiceRisk | "all">("all");
  const [detailTab, setDetailTab] = useState<ServiceDetailTab>(() =>
    resolveDetailTab(searchParams.get("tab"))
  );
  const [selectedServiceId, setSelectedServiceId] = useState<string>(() => searchParams.get("service") ?? "");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create");
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [formState, setFormState] = useState<ServiceFormState>(() =>
    createDefaultFormState("", displayCurrency)
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteServiceId, setDeleteServiceId] = useState<string | null>(null);
  const [owners, setOwners] = useState(() =>
    buildOwnerOptions({
      vendors: INITIAL_VENDOR_RECORDS,
      services: SERVICE_RECORDS,
      contracts: CONTRACT_RECORDS
    })
  );
  const referenceDate = toUtcIsoDate();
  const currentYearRange = useMemo(() => currentYearDateRange(), []);
  const annualSpendExample = useMemo(
    () => buildCurrencyInputExample(displayCurrency),
    [displayCurrency]
  );
  const serviceNameSuggestionsId = useId();

  const vendorChoices = useMemo(
    () =>
      Object.entries(vendorNameById)
        .map(([id, name]) => ({ id, name }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    [vendorNameById]
  );
  const serviceNameSuggestions = useMemo(
    () => buildSuggestionList(serviceRecords.map((service) => service.name)),
    [serviceRecords]
  );
  const ownerNameById = useMemo(
    () => Object.fromEntries(owners.map((owner) => [owner.id, owner.name])),
    [owners]
  );
  const refreshLocalOwners = useCallback((nextServices: WorkspaceServiceRecord[]) => {
    setOwners((current) => {
      const serviceCounts = new Map<string, number>();
      for (const service of nextServices) {
        serviceCounts.set(service.ownerId, (serviceCounts.get(service.ownerId) ?? 0) + 1);
      }
      const nextOwners = new Map(current.map((owner) => [owner.id, { ...owner }]));
      for (const service of nextServices) {
        if (!nextOwners.has(service.ownerId)) {
          nextOwners.set(service.ownerId, {
            id: service.ownerId,
            name: service.owner,
            archivedAt: null,
            createdAt: "",
            updatedAt: "",
            vendorCount: 0,
            serviceCount: 0,
            contractCount: 0
          });
        }
      }
      for (const owner of nextOwners.values()) {
        owner.serviceCount = serviceCounts.get(owner.id) ?? 0;
      }
      return [...nextOwners.values()].sort((left, right) => left.name.localeCompare(right.name));
    });
  }, []);

  const loadWorkspaceData = useCallback(async () => {
    if (!hasIpc) {
      return;
    }
    setLoading(true);
    try {
      const [vendors, services, contracts, expenses, ownerRows] = await Promise.all([
        listVendorsIpc(),
        listServicesIpc(),
        listContractsIpc(),
        listExpensesIpc({ scenarioId: selectedScenarioId }),
        listOwnersIpc()
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
            .sort()[0] ?? currentYearRange.dateTo;
        return {
          id: service.id,
          vendorId: service.vendorId,
          name: service.name,
          vendorName: nextVendorNameById[service.vendorId] ?? service.vendorId,
          ownerId: service.ownerId ?? toOwnerId(service.ownerTeam ?? ""),
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
      setOwners(ownerRows);
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
  }, [currentYearRange.dateTo, hasIpc, selectedScenarioId, selectedServiceId]);

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
      if (ownerFilter !== "all" && service.ownerId !== ownerFilter) {
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
  }, [ownerFilter, query, riskFilter, vendorFilter, serviceRecords]);

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

  function openRenewalReview(serviceId: string): void {
    const contractId = selectedService?.linkedContractIds[0] ?? "";
    navigate(`/renewals?service=${serviceId}${contractId ? `&contract=${contractId}` : ""}`);
  }

  function openCreateDrawer(): void {
    const defaultVendorId = vendorChoices[0]?.id ?? serviceRecords[0]?.vendorId ?? "";
    setDrawerMode("create");
    setEditingServiceId(null);
    setFormState(createDefaultFormState(defaultVendorId, displayCurrency));
    setFormError(null);
    setDrawerOpen(true);
  }

  function openEditDrawer(service: WorkspaceServiceRecord): void {
    setDrawerMode("edit");
    setEditingServiceId(service.id);
    setFormState(fromService(service, displayCurrency));
    setFormError(null);
    setDrawerOpen(true);
  }

  async function handleCreateOwner(name: string) {
    if (hasIpc) {
      const created = await createOwnerIpc({ name });
      await loadWorkspaceData();
      return created;
    }

    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error("Owner name is required.");
    }
    const existing = owners.find(
      (owner) => owner.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) {
      return existing;
    }
    const created = {
      id: toOwnerId(trimmed),
      name: trimmed,
      archivedAt: null,
      createdAt: "",
      updatedAt: "",
      vendorCount: 0,
      serviceCount: 0,
      contractCount: 0
    };
    setOwners((current) =>
      [...current, created].sort((left, right) => left.name.localeCompare(right.name))
    );
    return created;
  }

  async function handleGetOwnerUsage(ownerId: string) {
    if (hasIpc) {
      return getOwnerUsageIpc(ownerId);
    }

    const owner = owners.find((entry) => entry.id === ownerId);
    if (!owner) {
      throw new Error(`Owner not found: ${ownerId}`);
    }
    return {
      owner,
      vendors: INITIAL_VENDOR_RECORDS
        .filter((vendor) => vendor.ownerId === ownerId)
        .map((vendor) => ({ id: vendor.id, name: vendor.name })),
      services: serviceRecords
        .filter((service) => service.ownerId === ownerId)
        .map((service) => ({ id: service.id, name: service.name })),
      contracts: CONTRACT_RECORDS
        .filter((contract) => contract.ownerId === ownerId)
        .map((contract) => ({ id: contract.id, contractNumber: contract.contractNumber }))
    };
  }

  async function handleRetireOwner(ownerId: string, replacementOwnerId?: string | null) {
    if (hasIpc) {
      await retireOwnerIpc({
        id: ownerId,
        replacementOwnerId
      });
      await loadWorkspaceData();
      return;
    }

    const usage = await handleGetOwnerUsage(ownerId);
    const totalUsage =
      usage.owner.vendorCount + usage.owner.serviceCount + usage.owner.contractCount;
    if (totalUsage > 0 && !replacementOwnerId) {
      throw new Error("Choose a replacement owner before retiring this owner.");
    }

    if (replacementOwnerId) {
      setServiceRecords((current) => {
        const replacementName =
          owners.find((owner) => owner.id === replacementOwnerId)?.name ?? "";
        const next = current.map((service) =>
          service.ownerId === ownerId
            ? {
                ...service,
                ownerId: replacementOwnerId,
                owner: replacementName
              }
            : service
        );
        refreshLocalOwners(next);
        return next;
      });
    }

    setOwners((current) =>
      current.map((owner) =>
        owner.id === ownerId
          ? {
              ...owner,
              archivedAt: new Date().toISOString()
            }
          : owner
      )
    );
  }

  function handleSubmitDrawer(): void {
    const trimmedName = formState.name.trim();
    const ownerId = formState.ownerId;
    const trimmedOwner = ownerNameById[ownerId]?.trim() ?? "";
    const annualSpendMinor = parseCurrencyInputToMinor(
      formState.annualSpendMinor,
      displayCurrency
    );

    if (!formState.vendorId) {
      setFormError("Vendor is required.");
      return;
    }
    if (!trimmedName) {
      setFormError("Service name is required.");
      return;
    }
    if (!ownerId || !trimmedOwner) {
      setFormError("Service owner is required.");
      return;
    }
    if (annualSpendMinor === null || annualSpendMinor < 0) {
      setFormError("Annual spend must be zero or a positive amount.");
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
              ownerId,
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
              ownerId,
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
      ownerId,
      owner: trimmedOwner,
      annualSpendMinor,
      renewalDate: currentYearRange.dateTo,
      risk: formState.risk,
      replacementStatus: formState.replacementStatus,
      linkedContractIds: [],
      expenseLines: [],
      status: formState.status
    };

    setServiceRecords((current) => {
      const next =
        drawerMode === "create"
          ? [...current, nextService]
          : current.map((service) =>
              service.id === nextService.id ? { ...service, ...nextService } : service
            );
      refreshLocalOwners(next);
      return next;
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
    setServiceRecords((current) => {
      const next = current.filter((entry) => entry.id !== deleteServiceId);
      refreshLocalOwners(next);
      return next;
    });
    if (selectedServiceId === deleteServiceId) {
      setSelectedServiceId("");
    }
    setDeleteServiceId(null);
    setPageMessage(`Service ${deletedName} deleted.`);
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
    <section className="services-page">
      <PageHeader
        title="Services Workspace"
        subtitle="Lifecycle-focused service management with renewal context and replacement pathways."
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
          aria-label="Filter by owner"
          value={ownerFilter}
          onChange={(event) => setOwnerFilter(event.target.value)}
        >
          <option value="all">All owners</option>
          {owners
            .filter((owner) => owner.archivedAt === null)
            .map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name}
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
                    referenceDate
                  );
                  const highlightRenewal = isInRenewalWindow(
                    service.renewalDate,
                    referenceDate,
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
                          label={toTitleCaseLabel(lifecycleState)}
                          tone={serviceLifecycleTone(lifecycleState)}
                        />
                      </TableCell>
                      <TableCell>{formatCurrencyMinor(service.annualSpendMinor, displayCurrency)}</TableCell>
                      <TableCell>
                        <StatusChip
                          label={toTitleCaseLabel(service.risk)}
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
                            Open Contract
                          </Button>
                          <Button
                            size="small"
                            appearance="secondary"
                            onClick={(event) => {
                              event.stopPropagation();
                              openAlert(service.id);
                            }}
                          >
                            Open Alert
                          </Button>
                          <Button
                            size="small"
                            appearance="secondary"
                            onClick={(event) => {
                              event.stopPropagation();
                              openReplacement(service.id);
                            }}
                          >
                            Open Replacement
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
                referenceDate
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
                  <Text>{`Annual spend: ${formatCurrencyMinor(selectedService.annualSpendMinor, displayCurrency)}`}</Text>
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
                        <Text>{`${line.name} - ${formatCurrencyMinor(line.amountMinor, displayCurrency)} (${line.status})`}</Text>
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
                              {`Open Contract ${contractFromState.contractNumber}`}
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
                            {`Open Contract ${contract.contractNumber}`}
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
                  <Text>{renewalWindowLabel(selectedService.renewalDate, referenceDate)}</Text>
                  <Button
                    size="small"
                    appearance="secondary"
                    onClick={() => openRenewalReview(selectedService.id)}
                  >
                    Open Renewal Workbench
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
                    Open Replacement Workspace
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
      >
        <div className="services-form">
          <section className="services-form__section">
            <div className="services-form__section-header">
              <Text weight="semibold">Core details</Text>
              <Text size={200}>Primary service identity, ownership, and lifecycle posture.</Text>
              <Button
                appearance="secondary"
                size="small"
                type="button"
                onClick={() =>
                  openHelpTopic(
                    "services-form",
                    "createedit-service-form",
                    "service form",
                    "services:form"
                  )
                }
              >
                Service Form Guide
              </Button>
            </div>
            <div className="services-form__grid services-form__grid--two">
              <div className="services-form__field services-form__field--full">
                <Text className="services-form__label" size={200} weight="medium">
                  Service name
                </Text>
                <Input
                  aria-label="Service name"
                  list={serviceNameSuggestionsId}
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
                <OwnerSelectField
                  label="Owner"
                  inputAriaLabel="Service owner"
                  owners={owners}
                  placeholder="Owner team"
                  selectedOwnerId={formState.ownerId}
                  onSelect={(ownerId) =>
                    setFormState((current) => ({ ...current, ownerId }))
                  }
                  onCreateOwner={handleCreateOwner}
                  onGetOwnerUsage={handleGetOwnerUsage}
                  onRetireOwner={handleRetireOwner}
                />
                <Text
                  aria-hidden="true"
                  className="services-form__hint services-form__hint--placeholder"
                  size={100}
                >
                  {`Example: ${annualSpendExample.input} = ${annualSpendExample.formatted}.`}
                </Text>
              </div>
              <div className="services-form__field">
                <Text className="services-form__label" size={200} weight="medium">
                  Annual spend
                </Text>
                <Input
                  aria-label="Service annual spend"
                  inputMode="decimal"
                  value={formState.annualSpendMinor}
                  onChange={(_event, data) =>
                    setFormState((current) => ({ ...current, annualSpendMinor: data.value }))
                  }
                  placeholder={annualSpendExample.input}
                />
                <Text className="services-form__hint" size={100}>
                  {`Example: ${annualSpendExample.input} = ${annualSpendExample.formatted}.`}
                </Text>
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
                  <option value="active">{toTitleCaseLabel("active")}</option>
                  <option value="trial">{toTitleCaseLabel("trial")}</option>
                  <option value="deprecated">{toTitleCaseLabel("deprecated")}</option>
                  <option value="retiring">{toTitleCaseLabel("retiring")}</option>
                  <option value="retired">{toTitleCaseLabel("retired")}</option>
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
                  <option value="low">{toTitleCaseLabel("low")}</option>
                  <option value="medium">{toTitleCaseLabel("medium")}</option>
                  <option value="high">{toTitleCaseLabel("high")}</option>
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
                  <option value="not-started">{toTitleCaseLabel("not-started")}</option>
                  <option value="candidate-review">{toTitleCaseLabel("candidate-review")}</option>
                  <option value="approved">{toTitleCaseLabel("approved")}</option>
                </Select>
              </div>
            </div>
          </section>
          <datalist id={serviceNameSuggestionsId}>
            {serviceNameSuggestions.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
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
