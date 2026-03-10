import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Button,
  Card,
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
  createOwner as createOwnerIpc,
  createVendor as createVendorIpc,
  deleteVendor as deleteVendorIpc,
  getOwnerUsage as getOwnerUsageIpc,
  isIpcAvailable,
  listTechCatalogEntries as listTechCatalogEntriesIpc,
  listContracts as listContractsIpc,
  listOwners as listOwnersIpc,
  listServices as listServicesIpc,
  listVendors as listVendorsIpc,
  openHelpWindow,
  retireOwner as retireOwnerIpc,
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
import { OwnerSelectField } from "../owners/OwnerSelectField";
import { buildOwnerOptions, toOwnerId } from "../owners/owner-model";
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
  ownerId: string;
  annualSpendMinor: string;
  status: VendorStatus;
  risk: VendorRisk;
  linkedServiceIdsCsv: string;
  linkedContractIdsCsv: string;
};

const MAX_VISIBLE_VENDOR_NAME_SUGGESTIONS = 4;

function createDefaultFormState(currency: string = "USD"): VendorFormState {
  return {
    name: "",
    ownerId: "",
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
    ownerId: vendor.ownerId,
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
  const [vendors, setVendors] = useState<VendorRecord[]>(hasIpc ? [] : INITIAL_VENDOR_RECORDS);
  const [searchText, setSearchText] = useState("");
  const [sortKey, setSortKey] = useState<VendorSortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [selectedVendorId, setSelectedVendorId] = useState<string>(
    searchParams.get("vendor") ?? (hasIpc ? "" : (INITIAL_VENDOR_RECORDS[0]?.id ?? ""))
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
  const [owners, setOwners] = useState(() =>
    hasIpc
      ? []
      : buildOwnerOptions({
          vendors: INITIAL_VENDOR_RECORDS,
          services: Object.values(SERVICE_BY_ID),
          contracts: Object.values(CONTRACT_BY_ID)
        })
  );
  const lastSyncedVendorIdRef = useRef<string | null>(null);
  const annualSpendExample = useMemo(
    () => buildCurrencyInputExample(displayCurrency),
    [displayCurrency]
  );
  const vendorNameSuggestionsListboxId = useId();
  const vendorNameComboboxRef = useRef<HTMLDivElement | null>(null);
  const vendorNameSuggestionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [vendorNameSuggestionsOpen, setVendorNameSuggestionsOpen] = useState(false);
  const [vendorNameSuggestionCursor, setVendorNameSuggestionCursor] = useState(-1);
  const vendorNameSuggestions = useMemo(
    () =>
      buildSuggestionList([
        ...vendors.map((vendor) => vendor.name),
        ...catalogVendorNames
      ]),
    [catalogVendorNames, vendors]
  );
  const filteredVendorNameSuggestions = useMemo(() => {
    const query = formState.name.trim().toLowerCase();
    return vendorNameSuggestions.filter((suggestion) =>
      query.length === 0 ? true : suggestion.toLowerCase().includes(query)
    );
  }, [formState.name, vendorNameSuggestions]);
  const ownerNameById = useMemo(
    () => Object.fromEntries(owners.map((owner) => [owner.id, owner.name])),
    [owners]
  );
  const refreshLocalOwners = useCallback((nextVendors: VendorRecord[]) => {
    setOwners((current) => {
      const vendorCounts = new Map<string, number>();
      for (const vendor of nextVendors) {
        vendorCounts.set(vendor.ownerId, (vendorCounts.get(vendor.ownerId) ?? 0) + 1);
      }
      const nextOwners = new Map(current.map((owner) => [owner.id, { ...owner }]));
      for (const vendor of nextVendors) {
        if (!nextOwners.has(vendor.ownerId)) {
          nextOwners.set(vendor.ownerId, {
            id: vendor.ownerId,
            name: vendor.owner,
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
        owner.vendorCount = vendorCounts.get(owner.id) ?? 0;
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
      const [vendorRows, serviceRows, contractRows, ownerRows] = await Promise.all([
        listVendorsIpc(),
        listServicesIpc(),
        listContractsIpc(),
        listOwnersIpc()
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
        ownerId: vendor.ownerId ?? toOwnerId(vendor.owner ?? ""),
        owner: vendor.owner ?? "",
        annualSpendMinor: vendor.annualSpendMinor,
        status: vendor.status,
        risk: vendor.risk,
        linkedServiceIds: serviceIdsByVendor.get(vendor.id) ?? [],
        linkedContractIds: contractIdsByVendor.get(vendor.id) ?? []
      }));
      setVendors(mapped);
      setOwners(ownerRows);
      if (mapped.length === 0) {
        setSelectedVendorId("");
      } else if (!mapped.some((vendor) => vendor.id === selectedVendorId)) {
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
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (selectedVendorId) {
          lastSyncedVendorIdRef.current = selectedVendorId;
          next.set("vendor", selectedVendorId);
        } else {
          lastSyncedVendorIdRef.current = null;
          next.delete("vendor");
        }
        return next;
      },
      { replace: true }
    );
  }, [selectedVendorId, setSearchParams]);

  useEffect(() => {
    if (!drawerOpen) {
      setVendorNameSuggestionsOpen(false);
      setVendorNameSuggestionCursor(-1);
    }
  }, [drawerOpen]);

  useEffect(() => {
    if (!vendorNameSuggestionsOpen || filteredVendorNameSuggestions.length === 0) {
      setVendorNameSuggestionCursor(-1);
      return;
    }
    setVendorNameSuggestionCursor((current) => {
      if (current < 0) {
        return -1;
      }
      return Math.min(current, filteredVendorNameSuggestions.length - 1);
    });
  }, [filteredVendorNameSuggestions.length, vendorNameSuggestionsOpen]);

  useEffect(() => {
    if (vendorNameSuggestionCursor < 0) {
      return;
    }
    vendorNameSuggestionRefs.current[vendorNameSuggestionCursor]?.scrollIntoView({
      block: "nearest"
    });
  }, [vendorNameSuggestionCursor]);

  const filteredVendors = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return vendors
      .filter((vendor) => {
        if (ownerFilter !== "all" && vendor.ownerId !== ownerFilter) {
          return false;
        }
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
  }, [ownerFilter, searchText, sortDirection, sortKey, vendors]);

  const selectedVendor =
    filteredVendors.find((vendor) => vendor.id === selectedVendorId) ??
    filteredVendors[0] ??
    null;
  const hasActiveFilters = searchText.trim().length > 0 || ownerFilter !== "all";

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

  function closeVendorNameSuggestions(): void {
    setVendorNameSuggestionsOpen(false);
    setVendorNameSuggestionCursor(-1);
  }

  function selectVendorNameSuggestion(suggestion: string): void {
    setFormState((current) => ({ ...current, name: suggestion }));
    closeVendorNameSuggestions();
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
      vendors: vendors
        .filter((vendor) => vendor.ownerId === ownerId)
        .map((vendor) => ({ id: vendor.id, name: vendor.name })),
      services: Object.values(SERVICE_BY_ID)
        .filter((service) => service.ownerId === ownerId)
        .map((service) => ({ id: service.id, name: service.name })),
      contracts: Object.values(CONTRACT_BY_ID)
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
      setVendors((current) => {
        const replacementName =
          owners.find((owner) => owner.id === replacementOwnerId)?.name ?? "";
        const next = current.map((vendor) =>
          vendor.ownerId === ownerId
            ? {
                ...vendor,
                ownerId: replacementOwnerId,
                owner: replacementName
              }
            : vendor
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
    const linkedServiceIds = parseCsvIds(formState.linkedServiceIdsCsv);
    const linkedContractIds = parseCsvIds(formState.linkedContractIdsCsv);

    if (!trimmedName) {
      setFormError("Vendor name is required.");
      return;
    }
    if (!ownerId || !trimmedOwner) {
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
              ownerId,
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
              ownerId,
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
      ownerId,
      owner: trimmedOwner,
      annualSpendMinor,
      status: formState.status,
      risk: formState.risk,
      linkedServiceIds,
      linkedContractIds
    };

    setVendors((current) => {
      const next =
        drawerMode === "create"
          ? [...current, nextVendor]
          : current.map((vendor) => (vendor.id === nextVendor.id ? nextVendor : vendor));
      refreshLocalOwners(next);
      return next;
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
          ownerId: vendor.ownerId,
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
    setVendors((current) => {
      const next = current.filter((vendor) => vendor.id !== deleteVendorId);
      refreshLocalOwners(next);
      return next;
    });
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
        <Select
          aria-label="Filter vendors by owner"
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
      </div>
      {loading ? <Text>Loading vendors...</Text> : null}

      {pageMessage ? <Text>{pageMessage}</Text> : null}

      <div className="vendors-layout">
        <section>
          {filteredVendors.length === 0 ? (
            <EmptyState
              title={hasActiveFilters ? "No vendors match filters" : "No vendors yet"}
              description={
                hasActiveFilters
                  ? "Adjust search terms or owner filters."
                  : "Create a vendor to populate this workspace."
              }
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
                            appearance={selected ? "primary" : "secondary"}
                            onClick={(event) => {
                              event.stopPropagation();
                              openEditDrawer(vendor);
                            }}
                          >
                            Edit
                          </Button>
                          <Menu>
                            <MenuTrigger disableButtonEnhancement>
                              <Button
                                size="small"
                                appearance="secondary"
                                onClick={(event) => {
                                  event.stopPropagation();
                                }}
                              >
                                More
                              </Button>
                            </MenuTrigger>
                            <MenuPopover>
                              <MenuList>
                                <MenuItem
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openServices(vendor);
                                  }}
                                >
                                  Open Services
                                </MenuItem>
                                <MenuItem
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openExpenses(vendor);
                                  }}
                                >
                                  Open Expenses
                                </MenuItem>
                                <MenuItem
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    requestArchive(vendor);
                                  }}
                                >
                                  Archive
                                </MenuItem>
                                <MenuItem
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    requestDelete(vendor);
                                  }}
                                >
                                  Delete
                                </MenuItem>
                              </MenuList>
                            </MenuPopover>
                          </Menu>
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
                <div
                  className="vendors-form__combobox"
                  onBlur={(event) => {
                    const nextTarget = event.relatedTarget as Node | null;
                    if (!event.currentTarget.contains(nextTarget)) {
                      closeVendorNameSuggestions();
                    }
                  }}
                  ref={vendorNameComboboxRef}
                >
                  <Input
                    aria-autocomplete="list"
                    aria-controls={vendorNameSuggestionsListboxId}
                    aria-expanded={vendorNameSuggestionsOpen}
                    aria-label="Vendor name"
                    role="combobox"
                    value={formState.name}
                    onChange={(_event, data) => {
                      setFormState((current) => ({ ...current, name: data.value }));
                      setVendorNameSuggestionsOpen(true);
                      setVendorNameSuggestionCursor(-1);
                    }}
                    onFocus={() => {
                      if (filteredVendorNameSuggestions.length > 0) {
                        setVendorNameSuggestionsOpen(true);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (filteredVendorNameSuggestions.length === 0) {
                        return;
                      }
                      if (event.key === "ArrowDown") {
                        event.preventDefault();
                        setVendorNameSuggestionsOpen(true);
                        setVendorNameSuggestionCursor((current) =>
                          Math.min(current + 1, filteredVendorNameSuggestions.length - 1)
                        );
                        return;
                      }
                      if (event.key === "ArrowUp") {
                        event.preventDefault();
                        setVendorNameSuggestionsOpen(true);
                        setVendorNameSuggestionCursor((current) => Math.max(current - 1, 0));
                        return;
                      }
                      if (event.key === "Enter" && vendorNameSuggestionCursor >= 0) {
                        event.preventDefault();
                        selectVendorNameSuggestion(
                          filteredVendorNameSuggestions[vendorNameSuggestionCursor]
                        );
                        return;
                      }
                      if (event.key === "Escape") {
                        closeVendorNameSuggestions();
                      }
                    }}
                    placeholder="Vendor name"
                  />
                  {vendorNameSuggestionsOpen && filteredVendorNameSuggestions.length > 0 ? (
                    <ul
                      aria-label="Vendor suggestions"
                      className="vendors-form__suggestions"
                      data-visible-limit={MAX_VISIBLE_VENDOR_NAME_SUGGESTIONS}
                      id={vendorNameSuggestionsListboxId}
                      role="listbox"
                    >
                      {filteredVendorNameSuggestions.map((suggestion, index) => (
                        <li key={suggestion} role="option" aria-selected={index === vendorNameSuggestionCursor}>
                          <button
                            className={
                              index === vendorNameSuggestionCursor
                                ? "vendors-form__suggestion vendors-form__suggestion--active"
                                : "vendors-form__suggestion"
                            }
                            onMouseDown={(event) => {
                              event.preventDefault();
                              selectVendorNameSuggestion(suggestion);
                            }}
                            ref={(element) => {
                              vendorNameSuggestionRefs.current[index] = element;
                            }}
                            type="button"
                          >
                            {suggestion}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
              <div className="vendors-form__field">
                <OwnerSelectField
                  label="Owner"
                  inputAriaLabel="Vendor owner"
                  owners={owners}
                  placeholder="Vendor owner"
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
