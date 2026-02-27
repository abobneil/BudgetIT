import { useMemo, useState } from "react";
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
import { useNavigate } from "react-router-dom";

import {
  ConfirmDialog,
  EmptyState,
  FormDrawer,
  InlineError,
  PageHeader,
  StatusChip
} from "../../ui/primitives";
import { CONTRACT_BY_ID, SERVICE_BY_ID } from "../services/service-contract-data";
import {
  INITIAL_VENDOR_RECORDS,
  type VendorRecord,
  type VendorRisk,
  type VendorStatus
} from "./vendor-data";
import { evaluateVendorGuards, isDuplicateVendorName } from "./vendors-model";
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

function createDefaultFormState(): VendorFormState {
  return {
    name: "",
    owner: "",
    annualSpendMinor: "0",
    status: "active",
    risk: "low",
    linkedServiceIdsCsv: "",
    linkedContractIdsCsv: ""
  };
}

function fromVendor(vendor: VendorRecord): VendorFormState {
  return {
    name: vendor.name,
    owner: vendor.owner,
    annualSpendMinor: String(vendor.annualSpendMinor),
    status: vendor.status,
    risk: vendor.risk,
    linkedServiceIdsCsv: vendor.linkedServiceIds.join(","),
    linkedContractIdsCsv: vendor.linkedContractIds.join(",")
  };
}

function formatUsd(amountMinor: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(amountMinor / 100);
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
  const [vendors, setVendors] = useState<VendorRecord[]>(INITIAL_VENDOR_RECORDS);
  const [searchText, setSearchText] = useState("");
  const [sortKey, setSortKey] = useState<VendorSortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedVendorId, setSelectedVendorId] = useState<string>(
    INITIAL_VENDOR_RECORDS[0]?.id ?? ""
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create");
  const [editingVendorId, setEditingVendorId] = useState<string | null>(null);
  const [formState, setFormState] = useState<VendorFormState>(createDefaultFormState());
  const [formError, setFormError] = useState<string | null>(null);
  const [archiveVendorId, setArchiveVendorId] = useState<string | null>(null);
  const [deleteVendorId, setDeleteVendorId] = useState<string | null>(null);
  const [pageMessage, setPageMessage] = useState<string | null>(null);

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
    setFormState(createDefaultFormState());
    setFormError(null);
    setDrawerOpen(true);
  }

  function openEditDrawer(vendor: VendorRecord): void {
    setDrawerMode("edit");
    setEditingVendorId(vendor.id);
    setFormState(fromVendor(vendor));
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
    const annualSpendMinor = Number.parseInt(formState.annualSpendMinor, 10);
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
    if (Number.isNaN(annualSpendMinor) || annualSpendMinor < 0) {
      setFormError("Annual spend (minor units) must be zero or a positive integer.");
      return;
    }
    if (isDuplicateVendorName(trimmedName, vendors, editingVendorId ?? undefined)) {
      setFormError("Vendor name already exists.");
      return;
    }
    if (linkedServiceIds.some((serviceId) => !SERVICE_BY_ID[serviceId])) {
      setFormError("One or more linked service IDs are invalid.");
      return;
    }
    if (linkedContractIds.some((contractId) => !CONTRACT_BY_ID[contractId])) {
      setFormError("One or more linked contract IDs are invalid.");
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
    const deletedVendorName =
      vendors.find((vendor) => vendor.id === deleteVendorId)?.name ?? deleteVendorId;
    setVendors((current) => current.filter((vendor) => vendor.id !== deleteVendorId));
    if (selectedVendorId === deleteVendorId) {
      setSelectedVendorId("");
    }
    setPageMessage(`Vendor ${deletedVendorName} deleted.`);
    setDeleteVendorId(null);
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
                      <TableCell>{formatUsd(vendor.annualSpendMinor)}</TableCell>
                      <TableCell>
                        <StatusChip label={vendor.status.toUpperCase()} tone={statusTone(vendor.status)} />
                      </TableCell>
                      <TableCell>
                        <StatusChip label={vendor.risk.toUpperCase()} tone={riskTone(vendor.risk)} />
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
                            Open services
                          </Button>
                          <Button
                            size="small"
                            appearance="secondary"
                            onClick={(event) => {
                              event.stopPropagation();
                              openExpenses(vendor);
                            }}
                          >
                            Open expenses
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
              <Text>{`Annual spend: ${formatUsd(selectedVendor.annualSpendMinor)}`}</Text>
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
                            {`Open service ${service.name}`}
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
                            {`Open contract ${contract.contractNumber}`}
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
                  Open services workspace
                </Button>
                <Button
                  size="small"
                  appearance="secondary"
                  onClick={() => openExpenses(selectedVendor)}
                >
                  Open expenses workspace
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
          <Input
            aria-label="Vendor name"
            value={formState.name}
            onChange={(_event, data) =>
              setFormState((current) => ({ ...current, name: data.value }))
            }
            placeholder="Vendor name"
          />
          <Input
            aria-label="Vendor owner"
            value={formState.owner}
            onChange={(_event, data) =>
              setFormState((current) => ({ ...current, owner: data.value }))
            }
            placeholder="Vendor owner"
          />
          <Input
            aria-label="Vendor annual spend minor units"
            value={formState.annualSpendMinor}
            onChange={(_event, data) =>
              setFormState((current) => ({ ...current, annualSpendMinor: data.value }))
            }
            placeholder="Annual spend (minor units)"
          />
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
            <option value="active">active</option>
            <option value="watch">watch</option>
            <option value="archived">archived</option>
          </Select>
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
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </Select>
          <Input
            aria-label="Vendor linked service IDs"
            value={formState.linkedServiceIdsCsv}
            onChange={(_event, data) =>
              setFormState((current) => ({ ...current, linkedServiceIdsCsv: data.value }))
            }
            placeholder="Linked service IDs (comma-separated)"
          />
          <Input
            aria-label="Vendor linked contract IDs"
            value={formState.linkedContractIdsCsv}
            onChange={(_event, data) =>
              setFormState((current) => ({ ...current, linkedContractIdsCsv: data.value }))
            }
            placeholder="Linked contract IDs (comma-separated)"
          />
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
