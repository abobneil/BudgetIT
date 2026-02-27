import { useEffect, useMemo, useState } from "react";
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

import { EmptyState, PageHeader, StatusChip } from "../../ui/primitives";
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

function primaryContractId(service: ServiceRecord): string | null {
  return service.linkedContractIds[0] ?? null;
}

export function ServicesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<ServiceRisk | "all">("all");
  const [detailTab, setDetailTab] = useState<ServiceDetailTab>(() =>
    resolveDetailTab(searchParams.get("tab"))
  );
  const [selectedServiceId, setSelectedServiceId] = useState<string>(() => {
    return searchParams.get("service") ?? SERVICE_RECORDS[0]?.id ?? "";
  });

  const visibleServices = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return SERVICE_RECORDS.filter((service) => {
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
  }, [query, riskFilter]);

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
          tab: detailTab
        }),
      { replace: true }
    );
  }, [detailTab, selectedServiceId, setSearchParams]);

  const selectedService =
    SERVICE_RECORDS.find((service) => service.id === selectedServiceId) ??
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

  return (
    <section className="services-page">
      <PageHeader
        title="Services Workspace"
        subtitle="Lifecycle-focused service management with renewal context and replacement pathways."
      />

      <div className="services-toolbar">
        <Input
          aria-label="Search services"
          placeholder="Search service, vendor, or owner"
          value={query}
          onChange={(_event, data) => setQuery(data.value)}
        />
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
    </section>
  );
}
