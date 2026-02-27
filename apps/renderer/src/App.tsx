import { useEffect, useState } from "react";

import { formatRestoreBanner, type RestoreSummary } from "./restore-banner";

type RuntimeSettings = {
  startWithWindows: boolean;
  minimizeToTray: boolean;
  teamsEnabled: boolean;
  teamsWebhookUrl: string;
};

type RuntimeSettingsResponse = RuntimeSettings & {
  lastRestoreSummary?: RestoreSummary | null;
};

type AlertRecord = {
  id: string;
  entityType: string;
  entityId: string;
  fireAt: string;
  status: "pending" | "snoozed" | "acked";
  snoozedUntil: string | null;
  message: string;
};

type ImportField =
  | "scenarioId"
  | "serviceId"
  | "contractId"
  | "name"
  | "expenseType"
  | "status"
  | "amount"
  | "currency"
  | "startDate"
  | "endDate"
  | "frequency"
  | "interval"
  | "dayOfMonth"
  | "monthOfYear"
  | "anchorDate";

type ImportRowError = {
  rowNumber: number;
  code: "validation" | "duplicate";
  field: ImportField | "row";
  message: string;
};

type ImportPreviewResult = {
  totalRows: number;
  acceptedCount: number;
  rejectedCount: number;
  duplicateCount: number;
  templateApplied: string | null;
  templateSaved: string | null;
  errors: ImportRowError[];
};

type ImportCommitResult = {
  totalRows: number;
  acceptedCount: number;
  rejectedCount: number;
  duplicateCount: number;
  insertedCount: number;
  skippedDuplicateCount: number;
  matchedCount?: number;
  unmatchedCount?: number;
  matchRate?: number;
  unmatchedForReview?: Array<{
    id: string;
    transactionDate: string;
    amountMinor: number;
    description: string | null;
  }>;
  errors: ImportRowError[];
};

type ReplacementDetail = {
  servicePlan: {
    id: string;
    decisionStatus: string;
    reasonCode: string | null;
  };
  aggregation: {
    candidateCount: number;
    averageWeightedScore: number;
    bestCandidateId: string | null;
    bestWeightedScore: number | null;
  };
};

const defaultSettings: RuntimeSettings = {
  startWithWindows: true,
  minimizeToTray: true,
  teamsEnabled: false,
  teamsWebhookUrl: ""
};

async function getSettings(): Promise<RuntimeSettingsResponse> {
  if (!window.budgetit) {
    return defaultSettings;
  }

  return (await window.budgetit.invoke("settings.get")) as RuntimeSettingsResponse;
}

async function saveSettings(settings: RuntimeSettings): Promise<RuntimeSettings> {
  if (!window.budgetit) {
    return settings;
  }

  return (await window.budgetit.invoke("settings.update", settings)) as RuntimeSettings;
}

async function listAlerts(): Promise<AlertRecord[]> {
  if (!window.budgetit) {
    return [];
  }

  return (await window.budgetit.invoke("alerts.list")) as AlertRecord[];
}

async function acknowledgeAlert(alertEventId: string): Promise<AlertRecord> {
  if (!window.budgetit) {
    throw new Error("IPC bridge is unavailable.");
  }

  return (await window.budgetit.invoke("alerts.ack", { alertEventId })) as AlertRecord;
}

async function snoozeAlert(alertEventId: string, snoozedUntil: string): Promise<AlertRecord> {
  if (!window.budgetit) {
    throw new Error("IPC bridge is unavailable.");
  }

  return (await window.budgetit.invoke("alerts.snooze", {
    alertEventId,
    snoozedUntil
  })) as AlertRecord;
}

async function unsnoozeAlert(alertEventId: string): Promise<AlertRecord> {
  if (!window.budgetit) {
    throw new Error("IPC bridge is unavailable.");
  }

  return (await window.budgetit.invoke("alerts.snooze", {
    alertEventId,
    snoozedUntil: null
  })) as AlertRecord;
}

async function sendTeamsTestAlert(): Promise<{
  ok: boolean;
  attempts: number;
  statusCode: number | null;
  health: { status: string };
}> {
  if (!window.budgetit) {
    throw new Error("IPC bridge is unavailable.");
  }

  return (await window.budgetit.invoke("alerts.sendTest")) as {
    ok: boolean;
    attempts: number;
    statusCode: number | null;
    health: { status: string };
  };
}

async function restoreBackup(
  backupPath: string,
  manifestPath: string
): Promise<RestoreSummary> {
  if (!window.budgetit) {
    throw new Error("IPC bridge is unavailable.");
  }

  return (await window.budgetit.invoke("backup.restore", {
    backupPath,
    manifestPath
  })) as RestoreSummary;
}

async function previewImport(input: {
  mode: "expenses" | "actuals";
  filePath: string;
  templateName?: string;
  useSavedTemplate?: boolean;
  saveTemplate?: boolean;
}): Promise<ImportPreviewResult> {
  if (!window.budgetit) {
    throw new Error("IPC bridge is unavailable.");
  }

  return (await window.budgetit.invoke("import.preview", input)) as ImportPreviewResult;
}

async function commitImport(input: {
  mode: "expenses" | "actuals";
  filePath: string;
  templateName?: string;
  useSavedTemplate?: boolean;
  saveTemplate?: boolean;
}): Promise<ImportCommitResult> {
  if (!window.budgetit) {
    throw new Error("IPC bridge is unavailable.");
  }

  return (await window.budgetit.invoke("import.commit", input)) as ImportCommitResult;
}

async function queryReport(payload: unknown): Promise<unknown> {
  if (!window.budgetit) {
    throw new Error("IPC bridge is unavailable.");
  }
  return window.budgetit.invoke("reports.query", payload);
}

export function App() {
  const [settings, setSettings] = useState<RuntimeSettings>(defaultSettings);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("Loaded defaults");
  const [vendors, setVendors] = useState<Array<{ id: string; name: string }>>([]);
  const [services, setServices] = useState<Array<{ id: string; vendorId: string; name: string }>>([]);
  const [contracts, setContracts] = useState<Array<{ id: string; serviceId: string; contractNumber: string }>>([]);
  const [expenses, setExpenses] = useState<
    Array<{ id: string; name: string; amountMinor: number; status: "planned" | "approved" | "committed" | "actual" | "cancelled" }>
  >([]);
  const [recurrences, setRecurrences] = useState<
    Array<{ id: string; expenseId: string; frequency: "monthly" | "quarterly" | "yearly"; dayOfMonth: number }>
  >([]);
  const [dimensions, setDimensions] = useState<
    Array<{ id: string; name: string; mode: "single_select" | "multi_select"; required: boolean }>
  >([]);
  const [tags, setTags] = useState<Array<{ id: string; dimensionId: string; name: string }>>([]);
  const [assignments, setAssignments] = useState<
    Array<{ entityType: "expense_line"; entityId: string; dimensionId: string; tagId: string }>
  >([]);
  const [scenarios, setScenarios] = useState<
    Array<{ id: string; name: string; approval: "draft" | "reviewed" | "approved"; locked: boolean; parentId?: string }>
  >([{ id: "baseline", name: "Baseline", approval: "approved", locked: false }]);
  const [vendorName, setVendorName] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [contractNumber, setContractNumber] = useState("");
  const [expenseName, setExpenseName] = useState("");
  const [expenseAmountMinor, setExpenseAmountMinor] = useState("0");
  const [recurrenceDay, setRecurrenceDay] = useState("1");
  const [dimensionName, setDimensionName] = useState("");
  const [dimensionMode, setDimensionMode] = useState<"single_select" | "multi_select">("single_select");
  const [dimensionRequired, setDimensionRequired] = useState(false);
  const [tagName, setTagName] = useState("");
  const [selectedFilterTagId, setSelectedFilterTagId] = useState("");
  const [scenarioName, setScenarioName] = useState("");
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [alertLoading, setAlertLoading] = useState(false);
  const [sendingTeamsTest, setSendingTeamsTest] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState(false);
  const [backupPathInput, setBackupPathInput] = useState("");
  const [manifestPathInput, setManifestPathInput] = useState("");
  const [restoreSummary, setRestoreSummary] = useState<RestoreSummary | null>(null);
  const [importFilePath, setImportFilePath] = useState("");
  const [importMode, setImportMode] = useState<"expenses" | "actuals">("expenses");
  const [importTemplateName, setImportTemplateName] = useState("default-expense-import");
  const [importBusy, setImportBusy] = useState(false);
  const [importPreviewResult, setImportPreviewResult] = useState<ImportPreviewResult | null>(null);
  const [importCommitResult, setImportCommitResult] = useState<ImportCommitResult | null>(null);
  const [replacementPlanIdInput, setReplacementPlanIdInput] = useState("");
  const [replacementDetail, setReplacementDetail] = useState<ReplacementDetail | null>(null);
  const [activeAlertEntity, setActiveAlertEntity] = useState<{
    alertEventId: string;
    entityType: string;
    entityId: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const [nextSettingsResponse, nextAlerts] = await Promise.all([getSettings(), listAlerts()]);
      if (cancelled) {
        return;
      }
      setSettings({
        startWithWindows: nextSettingsResponse.startWithWindows,
        minimizeToTray: nextSettingsResponse.minimizeToTray,
        teamsEnabled: nextSettingsResponse.teamsEnabled,
        teamsWebhookUrl: nextSettingsResponse.teamsWebhookUrl
      });
      setAlerts(nextAlerts);
      setRestoreSummary(nextSettingsResponse.lastRestoreSummary ?? null);
      setStatus("Runtime settings loaded");
    };

    const unsubscribe = window.budgetit?.onAlertNavigate?.((payload) => {
      setActiveAlertEntity(payload);
      setStatus(`Navigated to ${payload.entityType}:${payload.entityId}`);
    });

    void (async () => {
      await load();
    })();

    return () => {
      cancelled = true;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  async function onSave(): Promise<void> {
    setSaving(true);
    const next = await saveSettings(settings);
    setSettings(next);
    setSaving(false);
    setStatus("Runtime settings saved");
  }

  async function onSendTeamsTest(): Promise<void> {
    setSendingTeamsTest(true);
    try {
      const result = await sendTeamsTestAlert();
      if (result.ok) {
        setStatus("Teams test notification sent");
      } else {
        setStatus(`Teams test failed (${result.health.status})`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Teams test failed (${message})`);
    } finally {
      setSendingTeamsTest(false);
    }
  }

  async function onRestoreBackup(): Promise<void> {
    setRestoringBackup(true);
    try {
      const summary = await restoreBackup(backupPathInput, manifestPathInput);
      setRestoreSummary(summary);
      setStatus("Backup restore completed");
      await refreshAlerts();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Backup restore failed (${message})`);
    } finally {
      setRestoringBackup(false);
    }
  }

  async function onPreviewImport(): Promise<void> {
    setImportBusy(true);
    try {
      const result = await previewImport({
        mode: importMode,
        filePath: importFilePath,
        templateName: importTemplateName,
        useSavedTemplate: true,
        saveTemplate: true
      });
      setImportPreviewResult(result);
      setImportCommitResult(null);
      setStatus(
        `Import preview: ${result.acceptedCount} accepted, ${result.rejectedCount} rejected (${result.duplicateCount} duplicates)`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Import preview failed (${message})`);
    } finally {
      setImportBusy(false);
    }
  }

  async function onCommitImport(): Promise<void> {
    setImportBusy(true);
    try {
      const result = await commitImport({
        mode: importMode,
        filePath: importFilePath,
        templateName: importTemplateName,
        useSavedTemplate: true,
        saveTemplate: true
      });
      setImportCommitResult(result);
      if (importMode === "actuals") {
        setStatus(
          `Actuals commit: ${result.insertedCount} inserted, ${result.matchedCount ?? 0} matched, ${result.unmatchedCount ?? 0} unmatched`
        );
      } else {
        setStatus(
          `Import commit: ${result.insertedCount} inserted, ${result.rejectedCount} rejected (${result.duplicateCount} duplicates)`
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Import commit failed (${message})`);
    } finally {
      setImportBusy(false);
    }
  }

  async function onLoadReplacementDetail(): Promise<void> {
    try {
      const detail = (await queryReport({
        query: "replacement.detail",
        servicePlanId: replacementPlanIdInput
      })) as ReplacementDetail;
      setReplacementDetail(detail);
      setStatus(`Loaded replacement detail for ${detail.servicePlan.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Failed to load replacement detail (${message})`);
    }
  }

  function nextId(prefix: string): string {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  async function refreshAlerts(): Promise<void> {
    setAlertLoading(true);
    const nextAlerts = await listAlerts();
    setAlerts(nextAlerts);
    setAlertLoading(false);
  }

  function getSnoozeUntilIsoDate(days: number): string {
    const value = new Date();
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
  }

  const filteredExpenseIds =
    selectedFilterTagId.length > 0
      ? assignments
          .filter((entry) => entry.tagId === selectedFilterTagId && entry.entityType === "expense_line")
          .map((entry) => entry.entityId)
      : expenses.map((entry) => entry.id);

  return (
    <main className="app-shell">
      <header>
        <h1>BudgetIT</h1>
        <p>Tray and startup defaults are configurable.</p>
      </header>

      <section className="settings-panel">
        <label>
          <input
            type="checkbox"
            checked={settings.startWithWindows}
            onChange={(event) => {
              setSettings((current) => ({
                ...current,
                startWithWindows: event.target.checked
              }));
            }}
          />
          Start with Windows
        </label>

        <label>
          <input
            type="checkbox"
            checked={settings.minimizeToTray}
            onChange={(event) => {
              setSettings((current) => ({
                ...current,
                minimizeToTray: event.target.checked
              }));
            }}
          />
          Minimize to tray on close
        </label>

        <label>
          <input
            type="checkbox"
            checked={settings.teamsEnabled}
            onChange={(event) => {
              setSettings((current) => ({
                ...current,
                teamsEnabled: event.target.checked
              }));
            }}
          />
          Enable Teams webhook alerts
        </label>

        <label>
          Teams webhook URL
          <input
            type="text"
            value={settings.teamsWebhookUrl}
            onChange={(event) => {
              setSettings((current) => ({
                ...current,
                teamsWebhookUrl: event.target.value
              }));
            }}
            placeholder="https://..."
          />
        </label>

        <button type="button" disabled={saving} onClick={() => void onSave()}>
          {saving ? "Saving..." : "Save runtime settings"}
        </button>
        <button type="button" disabled={sendingTeamsTest} onClick={() => void onSendTeamsTest()}>
          {sendingTeamsTest ? "Sending..." : "Send Teams test"}
        </button>

        <div className="crud-form">
          <input
            type="text"
            value={backupPathInput}
            onChange={(event) => setBackupPathInput(event.target.value)}
            placeholder="Backup file path"
          />
          <input
            type="text"
            value={manifestPathInput}
            onChange={(event) => setManifestPathInput(event.target.value)}
            placeholder="Manifest file path"
          />
          <button type="button" disabled={restoringBackup} onClick={() => void onRestoreBackup()}>
            {restoringBackup ? "Restoring..." : "Restore backup"}
          </button>
        </div>
        {restoreSummary ? <p className="status">{formatRestoreBanner(restoreSummary)}</p> : null}
        <div className="crud-form">
          <select value={importMode} onChange={(event) => setImportMode(event.target.value as "expenses" | "actuals")}>
            <option value="expenses">Expenses</option>
            <option value="actuals">Actuals</option>
          </select>
          <input
            type="text"
            value={importFilePath}
            onChange={(event) => setImportFilePath(event.target.value)}
            placeholder="Import CSV/XLSX path"
          />
          <input
            type="text"
            value={importTemplateName}
            onChange={(event) => setImportTemplateName(event.target.value)}
            placeholder="Mapping template name"
          />
          <button type="button" disabled={importBusy} onClick={() => void onPreviewImport()}>
            {importBusy ? "Working..." : "Preview import"}
          </button>
          <button type="button" disabled={importBusy} onClick={() => void onCommitImport()}>
            {importBusy ? "Working..." : "Commit import"}
          </button>
        </div>
        {importPreviewResult ? (
          <p className="status">
            Preview rows: {importPreviewResult.totalRows}; accepted {importPreviewResult.acceptedCount}; rejected{" "}
            {importPreviewResult.rejectedCount}
          </p>
        ) : null}
        {importCommitResult ? (
          <p className="status">
            Commit inserted {importCommitResult.insertedCount}; duplicates skipped{" "}
            {importCommitResult.skippedDuplicateCount ?? importCommitResult.duplicateCount}
          </p>
        ) : null}
        {importMode === "actuals" && importCommitResult?.matchRate !== undefined ? (
          <p className="status">Actual match rate: {(importCommitResult.matchRate * 100).toFixed(1)}%</p>
        ) : null}
        {importMode === "actuals" && importCommitResult?.unmatchedForReview?.[0] ? (
          <p className="status">
            First unmatched actual: {importCommitResult.unmatchedForReview[0].transactionDate} $
            {(importCommitResult.unmatchedForReview[0].amountMinor / 100).toFixed(2)}
          </p>
        ) : null}
        {(importPreviewResult?.errors[0] ?? importCommitResult?.errors[0]) ? (
          <p className="status">
            First import error (row {(importPreviewResult?.errors[0] ?? importCommitResult?.errors[0])?.rowNumber}):{" "}
            {(importPreviewResult?.errors[0] ?? importCommitResult?.errors[0])?.message}
          </p>
        ) : null}
        <div className="crud-form">
          <input
            type="text"
            value={replacementPlanIdInput}
            onChange={(event) => setReplacementPlanIdInput(event.target.value)}
            placeholder="Service plan id for replacement detail"
          />
          <button type="button" onClick={() => void onLoadReplacementDetail()}>
            Load replacement detail
          </button>
        </div>
        {replacementDetail ? (
          <p className="status">
            Replacement candidates: {replacementDetail.aggregation.candidateCount}; avg score{" "}
            {replacementDetail.aggregation.averageWeightedScore}; best {replacementDetail.aggregation.bestCandidateId ?? "none"}
          </p>
        ) : null}
        <p className="status">{status}</p>
      </section>

      <section className="crud-card">
        <h2>Alert Center</h2>
        <button type="button" disabled={alertLoading} onClick={() => void refreshAlerts()}>
          {alertLoading ? "Refreshing..." : "Refresh alerts"}
        </button>
        {activeAlertEntity ? (
          <p className="status">
            Focused entity: {activeAlertEntity.entityType}:{activeAlertEntity.entityId}
          </p>
        ) : null}
        <ul>
          {alerts.map((alert) => (
            <li key={alert.id}>
              <span>
                {alert.message} [{alert.status}] due {alert.fireAt}
                {alert.snoozedUntil ? ` (snoozed until ${alert.snoozedUntil})` : ""}
              </span>
              <button
                type="button"
                onClick={() =>
                  void (async () => {
                    await acknowledgeAlert(alert.id);
                    await refreshAlerts();
                  })()
                }
              >
                Ack
              </button>
              <button
                type="button"
                onClick={() =>
                  void (async () => {
                    await snoozeAlert(alert.id, getSnoozeUntilIsoDate(7));
                    await refreshAlerts();
                  })()
                }
              >
                Snooze 7d
              </button>
              <button
                type="button"
                onClick={() =>
                  void (async () => {
                    await unsnoozeAlert(alert.id);
                    await refreshAlerts();
                  })()
                }
              >
                Unsnooze
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="crud-grid">
        <article className="crud-card">
          <h2>Vendors</h2>
          <div className="crud-form">
            <input value={vendorName} onChange={(event) => setVendorName(event.target.value)} placeholder="Vendor name" />
            <button
              type="button"
              onClick={() => {
                if (!vendorName.trim()) return;
                setVendors((current) => [...current, { id: nextId("vendor"), name: vendorName.trim() }]);
                setVendorName("");
              }}
            >
              Add vendor
            </button>
          </div>
          <ul>
            {vendors.map((vendor) => (
              <li key={vendor.id}>
                <span>{vendor.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    const nextName = window.prompt("Edit vendor name", vendor.name);
                    if (!nextName) return;
                    setVendors((current) =>
                      current.map((entry) => (entry.id === vendor.id ? { ...entry, name: nextName.trim() } : entry))
                    );
                  }}
                >
                  Edit
                </button>
                <button type="button" onClick={() => setVendors((current) => current.filter((entry) => entry.id !== vendor.id))}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </article>

        <article className="crud-card">
          <h2>Scenarios</h2>
          <div className="crud-form">
            <input
              value={scenarioName}
              onChange={(event) => setScenarioName(event.target.value)}
              placeholder="Scenario name"
            />
            <button
              type="button"
              onClick={() => {
                if (!scenarioName.trim()) return;
                setScenarios((current) => [
                  ...current,
                  {
                    id: nextId("scenario"),
                    name: scenarioName.trim(),
                    approval: "draft",
                    locked: false,
                    parentId: current[0]?.id
                  }
                ]);
                setScenarioName("");
              }}
            >
              Clone from first scenario
            </button>
          </div>
          <ul>
            {scenarios.map((scenario) => (
              <li key={scenario.id}>
                <span>
                  {scenario.name} [{scenario.approval}] {scenario.locked ? "(locked)" : ""}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setScenarios((current) =>
                      current.map((entry) => {
                        if (entry.id !== scenario.id || entry.locked) return entry;
                        if (entry.approval === "draft") return { ...entry, approval: "reviewed" };
                        if (entry.approval === "reviewed") return { ...entry, approval: "approved" };
                        return entry;
                      })
                    )
                  }
                >
                  Advance approval
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setScenarios((current) =>
                      current.map((entry) => (entry.id === scenario.id ? { ...entry, locked: true } : entry))
                    )
                  }
                >
                  Lock
                </button>
              </li>
            ))}
          </ul>
        </article>

        <article className="crud-card">
          <h2>Services</h2>
          <div className="crud-form">
            <input value={serviceName} onChange={(event) => setServiceName(event.target.value)} placeholder="Service name" />
            <button
              type="button"
              onClick={() => {
                if (!serviceName.trim()) return;
                const vendorId = vendors[0]?.id ?? "vendor-unassigned";
                setServices((current) => [...current, { id: nextId("service"), vendorId, name: serviceName.trim() }]);
                setServiceName("");
              }}
            >
              Add service
            </button>
          </div>
          <ul>
            {services.map((service) => (
              <li key={service.id}>
                <span>{service.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    const nextName = window.prompt("Edit service name", service.name);
                    if (!nextName) return;
                    setServices((current) =>
                      current.map((entry) => (entry.id === service.id ? { ...entry, name: nextName.trim() } : entry))
                    );
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setServices((current) => current.filter((entry) => entry.id !== service.id))}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </article>

        <article className="crud-card">
          <h2>Contracts</h2>
          <div className="crud-form">
            <input
              value={contractNumber}
              onChange={(event) => setContractNumber(event.target.value)}
              placeholder="Contract number"
            />
            <button
              type="button"
              onClick={() => {
                if (!contractNumber.trim()) return;
                const serviceId = services[0]?.id ?? "service-unassigned";
                setContracts((current) => [
                  ...current,
                  { id: nextId("contract"), serviceId, contractNumber: contractNumber.trim() }
                ]);
                setContractNumber("");
              }}
            >
              Add contract
            </button>
          </div>
          <ul>
            {contracts.map((contract) => (
              <li key={contract.id}>
                <span>{contract.contractNumber}</span>
                <button
                  type="button"
                  onClick={() => {
                    const nextNumber = window.prompt("Edit contract number", contract.contractNumber);
                    if (!nextNumber) return;
                    setContracts((current) =>
                      current.map((entry) =>
                        entry.id === contract.id ? { ...entry, contractNumber: nextNumber.trim() } : entry
                      )
                    );
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setContracts((current) => current.filter((entry) => entry.id !== contract.id))}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </article>

        <article className="crud-card">
          <h2>Expenses</h2>
          <div className="crud-form">
            <input value={expenseName} onChange={(event) => setExpenseName(event.target.value)} placeholder="Expense name" />
            <input
              value={expenseAmountMinor}
              onChange={(event) => setExpenseAmountMinor(event.target.value)}
              placeholder="Amount minor units"
            />
            <button
              type="button"
              onClick={() => {
                const amountMinor = Number.parseInt(expenseAmountMinor, 10);
                if (!expenseName.trim() || Number.isNaN(amountMinor)) return;
                setExpenses((current) => [
                  ...current,
                  { id: nextId("expense"), name: expenseName.trim(), amountMinor, status: "planned" }
                ]);
                setExpenseName("");
                setExpenseAmountMinor("0");
              }}
            >
              Add expense
            </button>
          </div>
          <ul>
            {expenses.map((expense) => (
              <li key={expense.id}>
                <span>
                  {expense.name} (${(expense.amountMinor / 100).toFixed(2)}) [{expense.status}]
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setExpenses((current) =>
                      current.map((entry) =>
                        entry.id === expense.id
                          ? { ...entry, status: entry.status === "planned" ? "approved" : "planned" }
                          : entry
                      )
                    );
                  }}
                >
                  Edit
                </button>
                <button type="button" onClick={() => setExpenses((current) => current.filter((entry) => entry.id !== expense.id))}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </article>

        <article className="crud-card">
          <h2>Recurrence Rules</h2>
          <div className="crud-form">
            <input value={recurrenceDay} onChange={(event) => setRecurrenceDay(event.target.value)} placeholder="Day of month" />
            <button
              type="button"
              onClick={() => {
                const expenseId = expenses[0]?.id;
                const dayOfMonth = Number.parseInt(recurrenceDay, 10);
                if (!expenseId || Number.isNaN(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) return;
                setRecurrences((current) => [
                  ...current,
                  { id: nextId("recurrence"), expenseId, frequency: "monthly", dayOfMonth }
                ]);
              }}
            >
              Add recurrence
            </button>
          </div>
          <ul>
            {recurrences.map((recurrence) => (
              <li key={recurrence.id}>
                <span>{recurrence.frequency} on day {recurrence.dayOfMonth}</span>
                <button
                  type="button"
                  onClick={() => {
                    const nextDay = window.prompt("Edit day of month", String(recurrence.dayOfMonth));
                    const parsed = Number.parseInt(nextDay ?? "", 10);
                    if (Number.isNaN(parsed) || parsed < 1 || parsed > 31) return;
                    setRecurrences((current) =>
                      current.map((entry) =>
                        entry.id === recurrence.id ? { ...entry, dayOfMonth: parsed } : entry
                      )
                    );
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setRecurrences((current) => current.filter((entry) => entry.id !== recurrence.id))}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </article>

        <article className="crud-card">
          <h2>Dimensions & Tags</h2>
          <div className="crud-form">
            <input
              value={dimensionName}
              onChange={(event) => setDimensionName(event.target.value)}
              placeholder="Dimension name"
            />
            <select value={dimensionMode} onChange={(event) => setDimensionMode(event.target.value as "single_select" | "multi_select")}>
              <option value="single_select">single_select</option>
              <option value="multi_select">multi_select</option>
            </select>
            <label>
              <input
                type="checkbox"
                checked={dimensionRequired}
                onChange={(event) => setDimensionRequired(event.target.checked)}
              />
              Required
            </label>
            <button
              type="button"
              onClick={() => {
                if (!dimensionName.trim()) return;
                setDimensions((current) => [
                  ...current,
                  {
                    id: nextId("dimension"),
                    name: dimensionName.trim(),
                    mode: dimensionMode,
                    required: dimensionRequired
                  }
                ]);
                setDimensionName("");
                setDimensionRequired(false);
              }}
            >
              Add dimension
            </button>
          </div>

          <div className="crud-form">
            <input value={tagName} onChange={(event) => setTagName(event.target.value)} placeholder="Tag name" />
            <button
              type="button"
              onClick={() => {
                const dimensionId = dimensions[0]?.id;
                if (!dimensionId || !tagName.trim()) return;
                setTags((current) => [...current, { id: nextId("tag"), dimensionId, name: tagName.trim() }]);
                setTagName("");
              }}
            >
              Add tag
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              const expenseId = expenses[0]?.id;
              const tag = tags[0];
              if (!expenseId || !tag) return;

              const dimension = dimensions.find((entry) => entry.id === tag.dimensionId);
              if (!dimension) return;

              setAssignments((current) => {
                const sameDimensionAssignments = current.filter(
                  (entry) =>
                    entry.entityType === "expense_line" &&
                    entry.entityId === expenseId &&
                    entry.dimensionId === tag.dimensionId
                );

                if (dimension.mode === "single_select" && sameDimensionAssignments.length > 0) {
                  return current;
                }

                const exists = current.some(
                  (entry) =>
                    entry.entityType === "expense_line" &&
                    entry.entityId === expenseId &&
                    entry.tagId === tag.id
                );

                if (exists) {
                  return current;
                }

                return [
                  ...current,
                  {
                    entityType: "expense_line",
                    entityId: expenseId,
                    dimensionId: tag.dimensionId,
                    tagId: tag.id
                  }
                ];
              });
            }}
          >
            Assign first tag to first expense
          </button>

          <select value={selectedFilterTagId} onChange={(event) => setSelectedFilterTagId(event.target.value)}>
            <option value="">No filter</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>

          <ul>
            {expenses
              .filter((expense) => filteredExpenseIds.includes(expense.id))
              .map((expense) => (
                <li key={expense.id}>
                  <span>{expense.name}</span>
                </li>
              ))}
          </ul>
        </article>
      </section>
    </main>
  );
}
