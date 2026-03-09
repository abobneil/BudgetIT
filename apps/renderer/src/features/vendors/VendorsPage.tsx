import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
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
import { buildSuggestionList } from "../../lib/autocomplete";
import {
  createVendor as createVendorIpc,
  deleteVendor as deleteVendorIpc,
  isIpcAvailable,
  listTechCatalogEntries as listTechCatalogEntriesIpc,
  listContracts as listContractsIpc,
  listServices as listServicesIpc,
  listVendors as listVendorsIpc,
  openHelpWindow,
  updateVendor as updateVendorIpc
} from "../../lib/ipcClient";
import {
  buildCurrencyInputExample,
  formatCurrencyInputMinor,
  formatCurrencyMinor,
  parseCurrencyInputToMinor,
  useScenarioCurrency
} from "../../lib/currency";
import { toTitleCaseLabel } from "../../ui/text/labelCase";
import { CONTRACT_BY_ID, SERVICE_BY_ID } from "../services/service-contract-data";
import {
  INITIAL_VENDOR_RECORDS,
  type VendorRecord,
  type VendorRisk,
  type VendorStatus
} from "./vendor-data";
import { evaluateVendorGuards, isDuplicateVendorName } from "./vendors-model";
import { useScenarioContext } from "../scenarios/ScenarioContext";
import "./VendorsPage.css";

type VendorSortKey = "name" | "spend" | "status";
type SortDirection = "asc" | "desc";

type VendorFormState = {
  name: string;
  owner: string;
  annualSpendMinor: string;
  status: VendorStatus;
  risk: VendorRisk;
  linkedServiceIdsCsv: string;
  linkedContractIdsCsv: string;
};

function createDefaultFormState(currency: string = "USD"): VendorFormState {
  return {
    name: "",
    owner: "",
    annualSpendMinor: formatCurrencyInputMinor(0, currency),
    status: "active",
    risk: "low",
    linkedServiceIdsCsv: "",
    linkedContractIdsCsv: ""
  };
}

function fromVendor(vendor: VendorRecord, currency: string = "USD"): VendorFormState {
  return {
    name: vendor.name,
    owner: vendor.owner,
    annualSpendMinor: formatCurrencyInputMinor(vendor.annualSpendMinor, currency),
    status: vendor.status,
    risk: vendor.risk,
    linkedServiceIdsCsv: vendor.linkedServiceIds.join(","),
    linkedContractIdsCsv: vendor.linkedContractIds.join(",")
  };
}

function parseCsvIds(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function compareVendor(
  left: VendorRecord,
  right: VendorRecord,
  sortKey: VendorSortKey,
  direction: SortDirection
): number {
  const multiplier = direction === "asc" ? 1 : -1;
  if (sortKey === "spend") {
    return (left.annualSpendMinor - right.annualSpendMinor) * multiplier;
  }
  if (sortKey === "status") {
    return left.status.localeCompare(right.status) * multiplier;
  }
  return left.name.localeCompare(right.name) * multiplier;
}

function statusTone(status: VendorStatus): "info" | "warning" | "success" {
  if (status === "archived") {
    return "warning";
  }
  if (status === "watch") {
    return "info";
  }
  return "success";
}

function riskTone(risk: VendorRisk): "info" | "warning" | "danger" {
  if (risk === "high") {
    return "danger";
  }
  if (risk === "medium") {
    return "warning";
  }
  return "info";
}

function normalizeVendorId(name: string): string {
  return `vend-${name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}`;
}

export function VendorsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const hasIpc = isIpcAvailable();
  const { selectedScenarioId } = useScenarioContext();
  const displayCurrency = useScenarioCurrency(selectedScenarioId);
  const [vendors, setVendors] = useState<VendorRecord[]>(INITIAL_VENDOR_RECORDS);
  const [searchText, setSearchText] = useState("");
  const [sortKey, setSortKey] = useState<VendorSortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedVendorId, setSelectedVendorId] = useState<string>(
    searchParams.get("vendor") ?? INITIAL_VENDOR_RECORDS[0]?.id ?? ""
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create");
  const [editingVendorId, setEditingVendorId] = useState<string | null>(null);
  const [formState, setFormState] = useState<VendorFormState>(() =>
    createDefaultFormState(displayCurrency)
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [archiveVendorId, setArchiveVendorId] = useState<string | null>(null);
  const [deleteVendorId, setDeleteVendorId] = useState<string | null>(null);
  const [pageMessage, setPageMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [catalogVendorNames, setCatalogVendorNames] = useState<string[]>([]);
  const lastSyncedVendorIdRef = useRef<string | null>(null);
  const annualSpendExample = useMemo(
    () => buildCurrencyInputExample(displayCurrency),
    [displayCurrency]
  );
  const vendorNameSuggestionsId = useId();
  const vendorOwnerSuggestionsId = useId();
  const vendorNameSuggestions = useMemo(
    () =>
      buildSuggestionList([
        ...vendors.map((vendor) => vendor.name),
        ...catalogVendorNames
      ]),
    [catalogVendorNames, vendors]
  );
  const vendorOwnerSuggestions = useMemo(
    () => buildSuggestionList(vendors.map((vendor) => vendor.owner)),
    [vendors]
  );

  const loadWorkspaceData = useCallback(async () => {
    if (!hasIpc) {
      return;
    }
    setLoading(true);
    try {
      const [vendorRows, serviceRows, contractRows] = await Promise.all([
        listVendorsIpc(),
        listServicesIpc(),
        listContractsIpc()
      ]);
      const serviceIdsByVendor = new Map<string, string[]>();
      for (const service of serviceRows) {
        const current = serviceIdsByVendor.get(service.vendorId) ?? [];
        current.push(service.id);
        serviceIdsByVendor.set(service.vendorId, current);
      }
      const contractIdsByVendor = new Map<string, string[]>();
      const serviceById = new Map(serviceRows.map((service) => [service.id, service]));
      for (const contract of contractRows) {
        const service = serviceById.get(contract.serviceId);
        if (!service) {
          continue;
        }
        const current = contractIdsByVendor.get(service.vendorId) ?? [];
        current.push(contract.id);
        contractIdsByVendor.set(service.vendorId, current);
      }
      const mapped: VendorRecord[] = vendorRows.map((vendor) => ({
        id: vendor.id,
        name: vendor.name,
        owner: vendor.owner ?? "",
        annualSpendMinor: vendor.annualSpendMinor,
        status: vendor.status,
        risk: vendor.risk,
        linkedServiceIds: serviceIdsByVendor.get(vendor.id) ?? [],
        linkedContractIds: contractIdsByVendor.get(vendor.id) ?? []
      }));
      setVendors(mapped);
      if (mapped.length > 0 && !mapped.some((vendor) => vendor.id === selectedVendorId)) {
        setSelectedVendorId(mapped[0].id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setPageMessage(`Failed to load vendors: ${message}`);
    } finally {
      setLoading(false);
    }
  }, [hasIpc, selectedVendorId]);

  useEffect(() => {
    void loadWorkspaceData();
  }, [loadWorkspaceData]);

  useEffect(() => {
    if (!hasIpc) {
      setCatalogVendorNames([]);
      return;
    }

    void (async () => {
      try {
        const entries = await listTechCatalogEntriesIpc();
        setCatalogVendorNames(entries.map((entry) => entry.name));
      } catch {
        setCatalogVendorNames([]);
      }
    })();
  }, [hasIpc]);

  useEffect(() => {
    const focusedVendorId = searchParams.get("vendor");
    if (
      focusedVendorId &&
      focusedVendorId !== lastSyncedVendorIdRef.current &&
      vendors.some((vendor) => vendor.id === focusedVendorId)
    ) {
      setSelectedVendorId(focusedVendorId);
    }
  }, [searchParams, vendors]);

  useEffect(() => {
    if (!selectedVendorId) {
      return;
    }
    lastSyncedVendorIdRef.current = selectedVendorId;
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set("vendor", selectedVendorId);
        return next;
      },
      { replace: true }
    );
  }, [selectedVendorId, setSearchParams]);

  const filteredVendors = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return vendors
      .filter((vendor) => {
        if (!query) {
          return true;
        }
        return (
          vendor.name.toLowerCase().includes(query) ||
          vendor.owner.toLowerCase().includes(query) ||
          vendor.status.toLowerCase().includes(query)
        );
      })
      .sort((left, right) => compareVendor(left, right, sortKey, sortDirection));
  }, [searchText, sortDirection, sortKey, vendors]);

  const selectedVendor =
    filteredVendors.find((vendor) => vendor.id === selectedVendorId) ??
    filteredVendors[0] ??
    null;

  function toggleSort(nextSortKey: VendorSortKey): void {
    if (sortKey === nextSortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextSortKey);
    setSortDirection("asc");
  }

  function openCreateDrawer(): void {
    setDrawerMode("create");
    setEditingVendorId(null);
    setFormState(createDefaultFormState(displayCurrency));
    setFormError(null);
    setDrawerOpen(true);
  }

  function openEditDrawer(vendor: VendorRecord): void {
    setDrawerMode("edit");
    setEditingVendorId(vendor.id);
    setFormState(fromVendor(vendor, displayCurrency));
    setFormError(null);
    setDrawerOpen(true);
  }

  function openServices(vendor: VendorRecord): void {
    navigate(`/services?vendor=${vendor.id}`);
  }

  function openExpenses(vendor: VendorRecord): void {
    navigate(`/expenses?vendor=${vendor.id}`);
  }

  function handleSubmitDrawer(): void {
    const trimmedName = formState.name.trim();
    const trimmedOwner = formState.owner.trim();
    const annualSpendMinor = parseCurrencyInputToMinor(
      formState.annualSpendMinor,
      displayCurrency
    );
    const linkedServiceIds = parseCsvIds(formState.linkedServiceIdsCsv);
    const linkedContractIds = parseCsvIds(formState.linkedContractIdsCsv);

    if (!trimmedName) {
      setFormError("Vendor name is required.");
      return;
    }
    if (!trimmedOwner) {
      setFormError("Vendor owner is required.");
      return;
    }
    if (annualSpendMinor === null || annualSpendMinor < 0) {
      setFormError("Annual spend must be zero or a positive amount.");
      return;
    }
    if (isDuplicateVendorName(trimmedName, vendors, editingVendorId ?? undefined)) {
      setFormError("Vendor name already exists.");
      return;
    }
    if (!hasIpc && linkedServiceIds.some((serviceId) => !SERVICE_BY_ID[serviceId])) {
      setFormError("One or more linked service IDs are invalid.");
      return;
    }
    if (!hasIpc && linkedContractIds.some((contractId) => !CONTRACT_BY_ID[contractId])) {
      setFormError("One or more linked contract IDs are invalid.");
      return;
    }

    if (hasIpc) {
      void (async () => {
        try {
          if (drawerMode === "create") {
            const created = await createVendorIpc({
              name: trimmedName,
              owner: trimmedOwner,
              annualSpendMinor,
              status: formState.status,
              risk: formState.risk
            });
            if (created) {
              setSelectedVendorId(created.id);
            }
            setPageMessage(`Vendor ${trimmedName} created.`);
          } else if (editingVendorId) {
            await updateVendorIpc({
              id: editingVendorId,
              name: trimmedName,
              owner: trimmedOwner,
              annualSpendMinor,
              status: formState.status,
              risk: formState.risk
            });
            setPageMessage(`Vendor ${trimmedName} updated.`);
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

    const nextVendor: VendorRecord = {
      id: editingVendorId ?? normalizeVendorId(trimmedName),
      name: trimmedName,
      owner: trimmedOwner,
      annualSpendMinor,
      status: formState.status,
      risk: formState.risk,
      linkedServiceIds,
      linkedContractIds
    };

    setVendors((current) => {
      if (drawerMode === "create") {
        return [...current, nextVendor];
      }
      return current.map((vendor) =>
        vendor.id === nextVendor.id ? nextVendor : vendor
      );
    });
    setSelectedVendorId(nextVendor.id);
    setDrawerOpen(false);
    setFormError(null);
    setPageMessage(
      drawerMode === "create"
        ? `Vendor ${nextVendor.name} created.`
        : `Vendor ${nextVendor.name} updated.`
    );
  }

  function requestArchive(vendor: VendorRecord): void {
    const guard = evaluateVendorGuards(vendor);
    if (!guard.canArchive) {
      setPageMessage(guard.archiveReason);
      return;
    }
    setArchiveVendorId(vendor.id);
  }

  function confirmArchive(): void {
    if (!archiveVendorId) {
      return;
    }
    if (hasIpc) {
      const vendor = vendors.find((entry) => entry.id === archiveVendorId);
      if (!vendor) {
        setArchiveVendorId(null);
        return;
      }
      void (async () => {
        await updateVendorIpc({
          id: vendor.id,
          name: vendor.name,
          owner: vendor.owner,
          annualSpendMinor: vendor.annualSpendMinor,
          status: "archived",
          risk: vendor.risk
        });
        setPageMessage(`Vendor ${vendor.name} archived.`);
        setArchiveVendorId(null);
        await loadWorkspaceData();
      })();
      return;
    }
    setVendors((current) =>
      current.map((vendor) =>
        vendor.id === archiveVendorId ? { ...vendor, status: "archived" } : vendor
      )
    );
    const vendorName =
      vendors.find((vendor) => vendor.id === archiveVendorId)?.name ?? archiveVendorId;
    setPageMessage(`Vendor ${vendorName} archived.`);
    setArchiveVendorId(null);
  }

  function requestDelete(vendor: VendorRecord): void {
    const guard = evaluateVendorGuards(vendor);
    if (!guard.canDelete) {
      setPageMessage(guard.deleteReason);
      return;
    }
    setDeleteVendorId(vendor.id);
  }

  function confirmDelete(): void {
    if (!deleteVendorId) {
      return;
    }
    if (hasIpc) {
      const deletingId = deleteVendorId;
      const vendorName =
        vendors.find((vendor) => vendor.id === deletingId)?.name ?? deletingId;
      void (async () => {
        await deleteVendorIpc(deletingId);
        if (selectedVendorId === deletingId) {
          setSelectedVendorId("");
        }
        setPageMessage(`Vendor ${vendorName} deleted.`);
        setDeleteVendorId(null);
        await loadWorkspaceData();
      })();
      return;
    }
    const deletedVendorName =
      vendors.find((vendor) => vendor.id === deleteVendorId)?.name ?? deleteVendorId;
    setVendors((current) => current.filter((vendor) => vendor.id !== deleteVendorId));
    if (selectedVendorId === deleteVendorId) {
      setSelectedVendorId("");
    }
    setPageMessage(`Vendor ${deletedVendorName} deleted.`);
    setDeleteVendorId(null);
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
    <section className="vendors-page">
      <PageHeader
        title="Vendors Workspace"
        subtitle="Manage vendor lifecycle, relationship impact, and guarded archive/delete workflows."
        actions={
          <Button appearance="primary" onClick={openCreateDrawer}>
            Create Vendor
          </Button>
        }
      />

      <div className="vendors-toolbar">
        <Input
          aria-label="Search vendors"
          placeholder="Search by name, owner, or status"
          value={searchText}
          onChange={(_event, data) => setSearchText(data.value)}
        />
      </div>
      {loading ? <Text>Loading vendors...</Text> : null}

      {pageMessage ? <Text>{pageMessage}</Text> : null}

      <div className="vendors-layout">
        <section>
          {filteredVendors.length === 0 ? (
            <EmptyState
              title="No vendors match filters"
              description="Adjust search terms or create a vendor to populate this workspace."
            />
          ) : (
            <Table aria-label="Vendors table">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>
                    <Button size="small" appearance="subtle" onClick={() => toggleSort("name")}>
                      Name
                    </Button>
                  </TableHeaderCell>
                  <TableHeaderCell>Owner</TableHeaderCell>
                  <TableHeaderCell>
                    <Button size="small" appearance="subtle" onClick={() => toggleSort("spend")}>
                      Annual spend
                    </Button>
                  </TableHeaderCell>
                  <TableHeaderCell>
                    <Button size="small" appearance="subtle" onClick={() => toggleSort("status")}>
                      Status
                    </Button>
                  </TableHeaderCell>
                  <TableHeaderCell>Risk</TableHeaderCell>
                  <TableHeaderCell>Linked services</TableHeaderCell>
                  <TableHeaderCell>Linked contracts</TableHeaderCell>
                  <TableHeaderCell>Actions</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVendors.map((vendor) => {
                  const selected = selectedVendor?.id === vendor.id;
                  return (
                    <TableRow
                      key={vendor.id}
                      className={selected ? "vendors-row vendors-row--selected" : "vendors-row"}
                      onClick={() => setSelectedVendorId(vendor.id)}
                    >
                      <TableCell>{vendor.name}</TableCell>
                      <TableCell>{vendor.owner}</TableCell>
                      <TableCell>{formatCurrencyMinor(vendor.annualSpendMinor, displayCurrency)}</TableCell>
                      <TableCell>
                        <StatusChip label={toTitleCaseLabel(vendor.status)} tone={statusTone(vendor.status)} />
                      </TableCell>
                      <TableCell>
                        <StatusChip label={toTitleCaseLabel(vendor.risk)} tone={riskTone(vendor.risk)} />
                      </TableCell>
                      <TableCell data-testid={`vendor-service-count-${vendor.id}`}>
                        {vendor.linkedServiceIds.length}
                      </TableCell>
                      <TableCell data-testid={`vendor-contract-count-${vendor.id}`}>
                        {vendor.linkedContractIds.length}
                      </TableCell>
                      <TableCell>
                        <div className="vendors-row__actions">
                          <Button
                            size="small"
                            appearance="secondary"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedVendorId(vendor.id);
                            }}
                          >
                            Review
                          </Button>
                          <Button
                            size="small"
                            appearance="secondary"
                            onClick={(event) => {
                              event.stopPropagation();
                              openEditDrawer(vendor);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="small"
                            appearance="secondary"
                            onClick={(event) => {
                              event.stopPropagation();
                              openServices(vendor);
                            }}
                          >
                            Open Services
                          </Button>
                          <Button
                            size="small"
                            appearance="secondary"
                            onClick={(event) => {
                              event.stopPropagation();
                              openExpenses(vendor);
                            }}
                          >
                            Open Expenses
                          </Button>
                          <Button
                            size="small"
                            appearance="secondary"
                            onClick={(event) => {
                              event.stopPropagation();
                              requestArchive(vendor);
                            }}
                          >
                            Archive
                          </Button>
                          <Button
                            size="small"
                            appearance="secondary"
                            onClick={(event) => {
                              event.stopPropagation();
                              requestDelete(vendor);
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
          {selectedVendor ? (
            <Card className="vendors-detail">
              <Title3>{selectedVendor.name}</Title3>
              <Text>{`Owner: ${selectedVendor.owner}`}</Text>
              <Text>{`Annual spend: ${formatCurrencyMinor(selectedVendor.annualSpendMinor, displayCurrency)}`}</Text>
              <Text>{`Status: ${selectedVendor.status}`}</Text>
              <Text>{`Risk: ${selectedVendor.risk}`}</Text>

              <div className="vendors-detail__section">
                <Text weight="semibold">Linked services</Text>
                <ul className="vendors-detail__list">
                  {selectedVendor.linkedServiceIds.length === 0 ? (
                    <li>
                      <Text>No linked services.</Text>
                    </li>
                  ) : (
                    selectedVendor.linkedServiceIds.map((serviceId) => {
                      const service = SERVICE_BY_ID[serviceId];
                      if (!service) {
                        return null;
                      }
                      return (
                        <li key={service.id} className="vendors-linked-item">
                          <Text>{service.name}</Text>
                          <Button
                            size="small"
                            appearance="secondary"
                            onClick={() =>
                              navigate(`/services?service=${service.id}&tab=overview`)
                            }
                          >
                              {`Open Service ${service.name}`}
                          </Button>
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>

              <div className="vendors-detail__section">
                <Text weight="semibold">Linked contracts</Text>
                <ul className="vendors-detail__list">
                  {selectedVendor.linkedContractIds.length === 0 ? (
                    <li>
                      <Text>No linked contracts.</Text>
                    </li>
                  ) : (
                    selectedVendor.linkedContractIds.map((contractId) => {
                      const contract = CONTRACT_BY_ID[contractId];
                      if (!contract) {
                        return null;
                      }
                      return (
                        <li key={contract.id} className="vendors-linked-item">
                          <Text>{contract.contractNumber}</Text>
                          <Button
                            size="small"
                            appearance="secondary"
                            onClick={() => navigate(`/contracts?contract=${contract.id}`)}
                          >
                              {`Open Contract ${contract.contractNumber}`}
                          </Button>
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>

              <div className="vendors-detail__actions">
                <Button
                  size="small"
                  appearance="secondary"
                  onClick={() => openServices(selectedVendor)}
                >
                  Open Services Workspace
                </Button>
                <Button
                  size="small"
                  appearance="secondary"
                  onClick={() => openExpenses(selectedVendor)}
                >
                  Open Expenses Workspace
                </Button>
              </div>
            </Card>
          ) : (
            <EmptyState
              title="No vendor selected"
              description="Select a vendor row to inspect relationship impact."
            />
          )}
        </aside>
      </div>

      <FormDrawer
        open={drawerOpen}
        title={drawerMode === "create" ? "Create Vendor" : "Edit Vendor"}
        onOpenChange={setDrawerOpen}
        onSubmit={handleSubmitDrawer}
        submitLabel={drawerMode === "create" ? "Create" : "Save"}
      >
        <div className="vendors-form">
          <section className="vendors-form__section">
            <div className="vendors-form__section-header">
              <Text weight="semibold">Core details</Text>
              <Text size={200}>Primary identity, owner, and spend profile.</Text>
              <Button
                appearance="secondary"
                size="small"
                type="button"
                onClick={() =>
                  openHelpTopic(
                    "vendors-form",
                    "createedit-vendor-form",
                    "vendor form",
                    "vendors:form"
                  )
                }
              >
                Vendor Form Guide
              </Button>
            </div>
            <div className="vendors-form__grid vendors-form__grid--two">
              <div className="vendors-form__field vendors-form__field--full">
                <Text className="vendors-form__label" size={200} weight="medium">
                  Vendor name
                </Text>
                <Input
                  aria-label="Vendor name"
                  list={vendorNameSuggestionsId}
                  value={formState.name}
                  onChange={(_event, data) =>
                    setFormState((current) => ({ ...current, name: data.value }))
                  }
                  placeholder="Vendor name"
                />
              </div>
              <div className="vendors-form__field">
                <Text className="vendors-form__label" size={200} weight="medium">
                  Owner
                </Text>
                <Input
                  aria-label="Vendor owner"
                  list={vendorOwnerSuggestionsId}
                  value={formState.owner}
                  onChange={(_event, data) =>
                    setFormState((current) => ({ ...current, owner: data.value }))
                  }
                  placeholder="Vendor owner"
                />
                <Text
                  aria-hidden="true"
                  className="vendors-form__hint vendors-form__hint--placeholder"
                  size={100}
                >
                  {`Example: ${annualSpendExample.input} = ${annualSpendExample.formatted}.`}
                </Text>
              </div>
              <div className="vendors-form__field">
                <Text className="vendors-form__label" size={200} weight="medium">
                  Annual spend
                </Text>
                <Input
                  aria-label="Vendor annual spend"
                  inputMode="decimal"
                  value={formState.annualSpendMinor}
                  onChange={(_event, data) =>
                    setFormState((current) => ({ ...current, annualSpendMinor: data.value }))
                  }
                  placeholder={annualSpendExample.input}
                />
                <Text className="vendors-form__hint" size={100}>
                  {`Example: ${annualSpendExample.input} = ${annualSpendExample.formatted}.`}
                </Text>
              </div>
              <div className="vendors-form__field">
                <Text className="vendors-form__label" size={200} weight="medium">
                  Status
                </Text>
                <Select
                  aria-label="Vendor status"
                  value={formState.status}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      status: event.target.value as VendorStatus
                    }))
                  }
                >
                  <option value="active">{toTitleCaseLabel("active")}</option>
                  <option value="watch">{toTitleCaseLabel("watch")}</option>
                  <option value="archived">{toTitleCaseLabel("archived")}</option>
                </Select>
              </div>
              <div className="vendors-form__field">
                <Text className="vendors-form__label" size={200} weight="medium">
                  Risk
                </Text>
                <Select
                  aria-label="Vendor risk"
                  value={formState.risk}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      risk: event.target.value as VendorRisk
                    }))
                  }
                >
                  <option value="low">{toTitleCaseLabel("low")}</option>
                  <option value="medium">{toTitleCaseLabel("medium")}</option>
                  <option value="high">{toTitleCaseLabel("high")}</option>
                </Select>
              </div>
            </div>
          </section>
          <section className="vendors-form__section">
            <div className="vendors-form__section-header">
              <Text weight="semibold">Linked records</Text>
              <Text size={200}>Optional relationship IDs for services and contracts.</Text>
            </div>
            <div className="vendors-form__grid">
              <div className="vendors-form__field">
                <Text className="vendors-form__label" size={200} weight="medium">
                  Linked service IDs
                </Text>
                <Input
                  aria-label="Vendor linked service IDs"
                  value={formState.linkedServiceIdsCsv}
                  onChange={(_event, data) =>
                    setFormState((current) => ({ ...current, linkedServiceIdsCsv: data.value }))
                  }
                  placeholder="Linked service IDs (comma-separated)"
                />
              </div>
              <div className="vendors-form__field">
                <Text className="vendors-form__label" size={200} weight="medium">
                  Linked contract IDs
                </Text>
                <Input
                  aria-label="Vendor linked contract IDs"
                  value={formState.linkedContractIdsCsv}
                  onChange={(_event, data) =>
                    setFormState((current) => ({ ...current, linkedContractIdsCsv: data.value }))
                  }
                  placeholder="Linked contract IDs (comma-separated)"
                />
              </div>
            </div>
          </section>
          <datalist id={vendorNameSuggestionsId}>
            {vendorNameSuggestions.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
          <datalist id={vendorOwnerSuggestionsId}>
            {vendorOwnerSuggestions.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
        </div>
        {formError ? <InlineError message={formError} /> : null}
      </FormDrawer>

      <ConfirmDialog
        open={archiveVendorId !== null}
        title="Archive vendor?"
        message="Archive keeps linked records but removes this vendor from active workflow."
        onOpenChange={(open) => {
          if (!open) {
            setArchiveVendorId(null);
          }
        }}
        onConfirm={confirmArchive}
        confirmLabel="Archive"
      />

      <ConfirmDialog
        open={deleteVendorId !== null}
        title="Delete vendor?"
        message="Delete permanently removes the vendor record."
        onOpenChange={(open) => {
          if (!open) {
            setDeleteVendorId(null);
          }
        }}
        onConfirm={confirmDelete}
        confirmLabel="Delete"
      />
    </section>
  );
}
