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
  Textarea,
  Title3
} from "@fluentui/react-components";
import { useSearchParams } from "react-router-dom";

import {
  isIpcAvailable,
  listRenewalWorkbench,
  openHelpWindow,
  upsertRenewalDecision,
  type RenewalDecisionAction,
  type RenewalSavingsCategory,
  type RenewalWorkbenchItem
} from "../../lib/ipcClient";
import { formatCurrencyMinor, useScenarioCurrency } from "../../lib/currency";
import { EmptyState, InlineError, PageHeader, StatusChip } from "../../ui/primitives";
import { toTitleCaseLabel } from "../../ui/text/labelCase";
import { useFeedback } from "../../ui/feedback";
import { useScenarioContext } from "../scenarios/ScenarioContext";
import "./RenewalsPage.css";

function resolveDefaultAction(item: RenewalWorkbenchItem): RenewalDecisionAction {
  return item.decision?.action ?? "renew";
}

function resolveDefaultEffectiveDate(item: RenewalWorkbenchItem): string {
  return item.decision?.effectiveDate ?? item.renewalDate ?? "";
}

function defaultSavingsCategoryForAction(action: RenewalDecisionAction): RenewalSavingsCategory {
  if (action === "retire") {
    return "retirement";
  }
  if (action === "do_not_renew") {
    return "non_renewal";
  }
  if (action === "replace") {
    return "replacement";
  }
  if (action === "renegotiate") {
    return "renegotiation";
  }
  return "other";
}

function resolveDefaultSavingsCategory(item: RenewalWorkbenchItem): RenewalSavingsCategory {
  return item.decision?.savingsCategory ?? defaultSavingsCategoryForAction(resolveDefaultAction(item));
}

export function RenewalsPage() {
  const hasIpc = isIpcAvailable();
  const { selectedScenarioId } = useScenarioContext();
  const displayCurrency = useScenarioCurrency(selectedScenarioId);
  const { notify } = useFeedback();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<RenewalWorkbenchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(
    searchParams.get("contract")
  );
  const [action, setAction] = useState<RenewalDecisionAction>("renew");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [expectedAmount, setExpectedAmount] = useState("0.00");
  const [oneTimeCost, setOneTimeCost] = useState("0.00");
  const [savingsCategory, setSavingsCategory] = useState<RenewalSavingsCategory>("other");
  const [savingsRationale, setSavingsRationale] = useState("");
  const [notes, setNotes] = useState("");
  const [assumptions, setAssumptions] = useState("");

  async function loadWorkbench(preferredContractId?: string | null): Promise<void> {
    if (!hasIpc) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await listRenewalWorkbench({ scenarioId: selectedScenarioId });
      setItems(next);
      const nextSelected =
        preferredContractId && next.some((entry) => entry.contractId === preferredContractId)
          ? preferredContractId
          : next[0]?.contractId ?? null;
      setSelectedContractId(nextSelected);
    } catch (loadError) {
      const detail = loadError instanceof Error ? loadError.message : String(loadError);
      setError(`Failed to load renewal workbench: ${detail}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkbench(selectedContractId);
  }, [hasIpc, selectedScenarioId]);

  useEffect(() => {
    if (selectedContractId) {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set("contract", selectedContractId);
        return next;
      }, { replace: true });
    }
  }, [selectedContractId, setSearchParams]);

  const selectedItem = useMemo(
    () => items.find((entry) => entry.contractId === selectedContractId) ?? items[0] ?? null,
    [items, selectedContractId]
  );

  useEffect(() => {
    if (!selectedItem) {
      return;
    }
    setAction(resolveDefaultAction(selectedItem));
    setEffectiveDate(resolveDefaultEffectiveDate(selectedItem));
    setExpectedAmount(((selectedItem.decision?.expectedAmountMinor ?? selectedItem.currentAmountMinor) / 100).toFixed(2));
    setOneTimeCost(((selectedItem.decision?.oneTimeCostMinor ?? 0) / 100).toFixed(2));
    setSavingsCategory(resolveDefaultSavingsCategory(selectedItem));
    setSavingsRationale(selectedItem.decision?.savingsRationale ?? "");
    setNotes(selectedItem.decision?.notes ?? "");
    setAssumptions(selectedItem.decision?.assumptions ?? "");
  }, [selectedItem]);

  async function handleSave(): Promise<void> {
    if (!selectedItem) {
      return;
    }
    const parsedMinor = Math.round(Number.parseFloat(expectedAmount || "0") * 100);
    const parsedOneTimeCostMinor = Math.round(Number.parseFloat(oneTimeCost || "0") * 100);
    if (!effectiveDate) {
      setError("Effective date is required.");
      return;
    }
    if (Number.isNaN(parsedMinor) || parsedMinor < 0) {
      setError("Expected future cost must be zero or a positive amount.");
      return;
    }
    if (Number.isNaN(parsedOneTimeCostMinor) || parsedOneTimeCostMinor < 0) {
      setError("Transition cost must be zero or a positive amount.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await upsertRenewalDecision({
        scenarioId: selectedScenarioId,
        serviceId: selectedItem.serviceId,
        contractId: selectedItem.contractId,
        action,
        effectiveDate,
        expectedAmountMinor: parsedMinor,
        currency: selectedItem.currency || displayCurrency,
        oneTimeCostMinor: parsedOneTimeCostMinor,
        savingsCategory,
        savingsRationale,
        notes,
        assumptions
      });
      await loadWorkbench(selectedItem.contractId);
      notify({ tone: "success", message: "Renewal decision saved and forecast refreshed." });
    } catch (saveError) {
      const detail = saveError instanceof Error ? saveError.message : String(saveError);
      setError(`Failed to save renewal decision: ${detail}`);
    } finally {
      setSaving(false);
    }
  }

  function openHelpTopic(): void {
    void openHelpWindow({
      topic: "contracts-workspace",
      anchor: "start-renewal-review",
      q: "renewal review",
      context: "renewals:workspace"
    });
  }

  return (
    <section>
      <PageHeader
        title="Renewal Workbench"
        subtitle="Scenario-aware renewal and refresh planning with expected future cost materialized into forecast changes."
        actions={
          <Button appearance="secondary" onClick={openHelpTopic}>
            Renewal Help
          </Button>
        }
      />

      {loading ? <Text>Loading renewal workbench...</Text> : null}
      {error ? <InlineError message={error} /> : null}

      <div className="renewals-layout">
        <section>
          {items.length === 0 ? (
            <EmptyState
              title="No renewal candidates"
              description="Contracts with renewal metadata will appear here for scenario planning."
            />
          ) : (
            <Table aria-label="Renewal workbench table">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Service</TableHeaderCell>
                  <TableHeaderCell>Vendor</TableHeaderCell>
                  <TableHeaderCell>Renewal</TableHeaderCell>
                  <TableHeaderCell>Notice</TableHeaderCell>
                  <TableHeaderCell>Lifecycle</TableHeaderCell>
                  <TableHeaderCell>Current Cost</TableHeaderCell>
                  <TableHeaderCell>Planned Action</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow
                    key={`${item.serviceId}-${item.contractId ?? "service"}`}
                    onClick={() => setSelectedContractId(item.contractId)}
                  >
                    <TableCell>{item.serviceName}</TableCell>
                    <TableCell>{item.vendorName}</TableCell>
                    <TableCell>{item.renewalDate ?? "Unscheduled"}</TableCell>
                    <TableCell>{item.noticeDeadline ?? "N/A"}</TableCell>
                    <TableCell>
                      <StatusChip
                        label={toTitleCaseLabel(item.lifecycleStatus)}
                        tone={
                          item.lifecycleStatus === "notice-window"
                            ? "warning"
                            : item.lifecycleStatus === "renewal-window"
                              ? "info"
                              : item.lifecycleStatus === "expired"
                                ? "danger"
                                : "success"
                        }
                      />
                    </TableCell>
                    <TableCell>{formatCurrencyMinor(item.currentAmountMinor, item.currency, displayCurrency)}</TableCell>
                    <TableCell>{item.decision ? toTitleCaseLabel(item.decision.action) : "Not Planned"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>

        <aside>
          {selectedItem ? (
            <Card>
              <Title3>{selectedItem.contractNumber ?? selectedItem.serviceName}</Title3>
              <Text>{`Scenario: ${selectedScenarioId}`}</Text>
              <Text>{`Service: ${selectedItem.serviceName}`}</Text>
              <Text>{`Vendor: ${selectedItem.vendorName}`}</Text>
              <Text>{`Renewal date: ${selectedItem.renewalDate ?? "Unscheduled"}`}</Text>
              <Text>{`Notice deadline: ${selectedItem.noticeDeadline ?? "N/A"}`}</Text>
              <Text>{`Current cost: ${formatCurrencyMinor(selectedItem.currentAmountMinor, selectedItem.currency, displayCurrency)}`}</Text>

              <div className="renewals-form-grid">
                <div>
                  <Text size={200} weight="medium">
                    Planned action
                  </Text>
                  <Select
                    aria-label="Renewal planned action"
                    value={action}
                    onChange={(event) => {
                      const nextAction = event.target.value as RenewalDecisionAction;
                      setAction(nextAction);
                      setSavingsCategory(defaultSavingsCategoryForAction(nextAction));
                    }}
                  >
                    <option value="renew">Renew</option>
                    <option value="renegotiate">Renegotiate</option>
                    <option value="replace">Replace</option>
                    <option value="retire">Retire</option>
                    <option value="do_not_renew">Do Not Renew</option>
                    <option value="defer">Defer</option>
                  </Select>
                </div>
                <div>
                  <Text size={200} weight="medium">
                    Effective date
                  </Text>
                  <Input
                    aria-label="Renewal effective date"
                    type="date"
                    value={effectiveDate}
                    onChange={(_event, data) => setEffectiveDate(data.value)}
                  />
                </div>
                <div>
                  <Text size={200} weight="medium">
                    Expected future cost
                  </Text>
                  <Input
                    aria-label="Renewal expected future cost"
                    inputMode="decimal"
                    value={expectedAmount}
                    onChange={(_event, data) => setExpectedAmount(data.value)}
                  />
                </div>
                <div>
                  <Text size={200} weight="medium">
                    Currency
                  </Text>
                  <Input
                    aria-label="Renewal currency"
                    value={selectedItem.currency}
                    readOnly
                  />
                </div>
                <div>
                  <Text size={200} weight="medium">
                    Transition cost
                  </Text>
                  <Input
                    aria-label="Renewal transition cost"
                    inputMode="decimal"
                    value={oneTimeCost}
                    onChange={(_event, data) => setOneTimeCost(data.value)}
                  />
                </div>
                <div>
                  <Text size={200} weight="medium">
                    Savings category
                  </Text>
                  <Select
                    aria-label="Renewal savings category"
                    value={savingsCategory}
                    onChange={(event) =>
                      setSavingsCategory(event.target.value as RenewalSavingsCategory)
                    }
                  >
                    <option value="retirement">Retirement</option>
                    <option value="non_renewal">Non-Renewal</option>
                    <option value="replacement">Replacement</option>
                    <option value="consolidation">Consolidation</option>
                    <option value="renegotiation">Renegotiation</option>
                    <option value="other">Other</option>
                  </Select>
                </div>
                <div className="renewals-form-grid__full">
                  <Text size={200} weight="medium">
                    Savings rationale
                  </Text>
                  <Textarea
                    aria-label="Renewal savings rationale"
                    value={savingsRationale}
                    onChange={(_event, data) => setSavingsRationale(data.value)}
                  />
                </div>
                <div className="renewals-form-grid__full">
                  <Text size={200} weight="medium">
                    Notes
                  </Text>
                  <Textarea
                    aria-label="Renewal notes"
                    value={notes}
                    onChange={(_event, data) => setNotes(data.value)}
                  />
                </div>
                <div className="renewals-form-grid__full">
                  <Text size={200} weight="medium">
                    Assumptions
                  </Text>
                  <Textarea
                    aria-label="Renewal assumptions"
                    value={assumptions}
                    onChange={(_event, data) => setAssumptions(data.value)}
                  />
                </div>
              </div>

              <Button appearance="primary" disabled={saving} onClick={() => void handleSave()}>
                {saving ? "Saving..." : "Save Renewal Decision"}
              </Button>
            </Card>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
