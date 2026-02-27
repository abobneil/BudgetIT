import { useEffect, useMemo, useState } from "react";
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

import { EmptyState, PageHeader, StatusChip } from "../../ui/primitives";
import {
  CONTRACT_RECORDS,
  SERVICE_BY_ID,
  type ContractLifecycleStatus
} from "../services/service-contract-data";
import {
  contractLifecycleTone,
  renewalWindowLabel
} from "../services/service-lifecycle-model";
import "./ContractsPage.css";

const REFERENCE_DATE = "2026-03-01";

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

export function ContractsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ContractLifecycleStatus | "all">(
    "all"
  );
  const [selectedContractId, setSelectedContractId] = useState<string>(() => {
    return searchParams.get("contract") ?? CONTRACT_RECORDS[0]?.id ?? "";
  });
  const [message, setMessage] = useState<string | null>(null);

  const visibleContracts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return CONTRACT_RECORDS.filter((contract) => {
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
  }, [query, statusFilter]);

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
    CONTRACT_RECORDS.find((contract) => contract.id === selectedContractId) ??
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

  return (
    <section className="contracts-page">
      <PageHeader
        title="Contracts Workspace"
        subtitle="Contract lifecycle management with linked services, renewal actions, and replacement pathways."
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
                          {renewalWindowLabel(contract.renewalDate, REFERENCE_DATE)}
                        </Text>
                      </TableCell>
                      <TableCell>{formatDate(contract.noticeDeadline)}</TableCell>
                      <TableCell>{formatUsd(contract.totalCommitmentMinor)}</TableCell>
                      <TableCell data-testid={`contract-linked-count-${contract.id}`}>
                        {contract.linkedServiceIds.length}
                      </TableCell>
                      <TableCell>
                        <StatusChip
                          label={contract.lifecycleStatus.toUpperCase()}
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
                            disabled={!firstServiceId}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (!firstServiceId) {
                                return;
                              }
                              openService(firstServiceId);
                            }}
                          >
                            Open service
                          </Button>
                          <Button
                            size="small"
                            appearance="secondary"
                            onClick={(event) => {
                              event.stopPropagation();
                              openAlert(contract.id);
                            }}
                          >
                            Open alert
                          </Button>
                          <Button
                            size="small"
                            appearance="secondary"
                            onClick={(event) => {
                              event.stopPropagation();
                              openReplacement(contract.id);
                            }}
                          >
                            Open replacement
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
                        {`Open service ${service.name}`}
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
                  Open related alert
                </Button>
                <Button
                  size="small"
                  appearance="secondary"
                  onClick={() => openReplacement(selectedContract.id)}
                >
                  Open replacement workspace
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
                  Start renewal review
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
    </section>
  );
}
