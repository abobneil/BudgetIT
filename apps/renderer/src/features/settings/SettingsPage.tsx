import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Input,
  Switch,
  Text,
  Title3
} from "@fluentui/react-components";

import { formatRestoreBanner, type RestoreSummary } from "../../restore-banner";
import {
  MACHINE_LOCAL_STATE_DECISION_SUMMARY,
  reconcileMachineLocalStateAfterRestore
} from "../../lib/machineLocalState";
import {
  createCostCenter,
  createGlAccount,
  createBackup,
  defaultSettings,
  getDatabaseSecurityStatus,
  getScenarioSettings,
  getSettings,
  getTechCatalogStatus,
  isIpcAvailable,
  listApprovalRecords,
  listAuditRecords,
  listCostCenters,
  listGlAccounts,
  listNotificationEndpoints,
  materializeForecast,
  pickDirectoryPath,
  pickFilePath,
  rekeyDatabase,
  resetDatabase,
  restoreBackup,
  runDiagnostics,
  saveSettings,
  sendTeamsTestAlert,
  syncTechCatalog,
  updateScenarioSettings,
  updateCostCenter,
  updateGlAccount,
  verifyBackup,
  type ApprovalRecord,
  type BackupVerifyResult,
  type CostCenterRecord,
  type DatabaseResetResult,
  type DatabaseSecurityStatus,
  type GlAccountRecord,
  type MaintenanceDiagnosticsResult,
  type NotificationEndpointRecord,
  type RuntimeSettings,
  type TechCatalogStatus
} from "../../lib/ipcClient";
import { ConfirmDialog, InlineError, LoadingState, PageHeader } from "../../ui/primitives";
import { useScenarioContext } from "../scenarios/ScenarioContext";
import {
  computeSettingsSectionDirtyState,
  hasDirtySections,
  validateSettingsDraft
} from "./settings-model";
import { useFeedback, type FeedbackTone } from "../../ui/feedback";
import "./SettingsPage.css";

const DEFAULT_BACKUP_DESTINATION = "";

export function SettingsPage() {
  const { selectedScenarioId, selectScenario } = useScenarioContext();
  const { notify } = useFeedback();
  const [baselineSettings, setBaselineSettings] = useState<RuntimeSettings>(defaultSettings);
  const [draftSettings, setDraftSettings] = useState<RuntimeSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [savingRuntime, setSavingRuntime] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [sendingTeamsTest, setSendingTeamsTest] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState(false);
  const [resettingDatabase, setResettingDatabase] = useState(false);
  const [rekeyBusy, setRekeyBusy] = useState(false);
  const [maintenanceBusy, setMaintenanceBusy] = useState<"materialize" | "diagnostics" | null>(
    null
  );

  const [backupDestination, setBackupDestination] = useState(DEFAULT_BACKUP_DESTINATION);
  const [backupPathInput, setBackupPathInput] = useState("");
  const [manifestPathInput, setManifestPathInput] = useState("");
  const [verifyBackupPathInput, setVerifyBackupPathInput] = useState("");
  const [verifyManifestPathInput, setVerifyManifestPathInput] = useState("");
  const [restoreSummary, setRestoreSummary] = useState<RestoreSummary | null>(null);
  const [backupVerifyResult, setBackupVerifyResult] = useState<BackupVerifyResult | null>(null);
  const [securityStatus, setSecurityStatus] = useState<DatabaseSecurityStatus | null>(null);
  const [diagnostics, setDiagnostics] = useState<MaintenanceDiagnosticsResult | null>(null);
  const [catalogStatus, setCatalogStatus] = useState<TechCatalogStatus | null>(null);
  const [scenarioSettings, setScenarioSettings] = useState<{
    fiscalYearStartMonth: string;
    horizonMonths: string;
    defaultCurrency: string;
  }>({
    fiscalYearStartMonth: "1",
    horizonMonths: "24",
    defaultCurrency: "USD"
  });
  const [financeRefsLoading, setFinanceRefsLoading] = useState(false);
  const [costCenters, setCostCenters] = useState<CostCenterRecord[]>([]);
  const [glAccounts, setGlAccounts] = useState<GlAccountRecord[]>([]);
  const [newCostCenterCode, setNewCostCenterCode] = useState("");
  const [newCostCenterName, setNewCostCenterName] = useState("");
  const [newGlAccountCode, setNewGlAccountCode] = useState("");
  const [newGlAccountName, setNewGlAccountName] = useState("");
  const [approvalRecords, setApprovalRecords] = useState<ApprovalRecord[]>([]);
  const [notificationEndpoints, setNotificationEndpoints] = useState<NotificationEndpointRecord[]>(
    []
  );
  const [auditRecords, setAuditRecords] = useState<
    Array<{ id: string; action: string; entityType: string; entityId: string; createdAt: string }>
  >([]);
  const [teamsTestEvidence, setTeamsTestEvidence] = useState<{
    testedAt: string;
    status: "ok" | "failed";
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [openRekeyDialog, setOpenRekeyDialog] = useState(false);
  const [openResetDialog, setOpenResetDialog] = useState(false);
  const [openMaterializeDialog, setOpenMaterializeDialog] = useState(false);
  const [openDiagnosticsDialog, setOpenDiagnosticsDialog] = useState(false);
  const [syncingCatalog, setSyncingCatalog] = useState(false);

  const sectionDirty = useMemo(
    () => computeSettingsSectionDirtyState(baselineSettings, draftSettings),
    [baselineSettings, draftSettings]
  );
  const validation = useMemo(
    () =>
      validateSettingsDraft(draftSettings, {
        backupPath: backupPathInput,
        manifestPath: manifestPathInput
      }),
    [backupPathInput, draftSettings, manifestPathInput]
  );

  function pushError(message: string): void {
    setError(message);
    notify({ tone: "error", message });
  }

  function pushStatus(message: string, tone: FeedbackTone = "success"): void {
    setStatus(message);
    notify({ tone, message });
  }

  async function browseDirectory(
    title: string,
    currentValue: string,
    onPick: (value: string) => void
  ): Promise<void> {
    const picked = await pickDirectoryPath({
      title,
      defaultPath: currentValue || undefined
    });
    if (picked) {
      onPick(picked);
    }
  }

  async function browseFile(
    title: string,
    currentValue: string,
    onPick: (value: string) => void,
    extensions: string[]
  ): Promise<void> {
    const picked = await pickFilePath({
      title,
      defaultPath: currentValue || undefined,
      filters: [{ name: "Files", extensions }]
    });
    if (picked) {
      onPick(picked);
    }
  }

  async function loadScenarioPlanningSettings(targetScenarioId: string = selectedScenarioId): Promise<void> {
    try {
      const current = await getScenarioSettings({ scenarioId: targetScenarioId });
      setScenarioSettings({
        fiscalYearStartMonth: String(current.fiscalYearStartMonth),
        horizonMonths: String(current.horizonMonths),
        defaultCurrency: current.defaultCurrency
      });
    } catch (loadError) {
      const detail = loadError instanceof Error ? loadError.message : String(loadError);
      pushError(`Failed to load scenario settings: ${detail}`);
    }
  }

  async function loadFinanceReferences(): Promise<void> {
    setFinanceRefsLoading(true);
    try {
      const [centers, gls] = await Promise.all([listCostCenters(), listGlAccounts()]);
      setCostCenters(centers);
      setGlAccounts(gls);
    } catch (loadError) {
      const detail = loadError instanceof Error ? loadError.message : String(loadError);
      pushError(`Failed to load finance reference data: ${detail}`);
    } finally {
      setFinanceRefsLoading(false);
    }
  }

  async function loadAuditEvidence(targetScenarioId: string = selectedScenarioId): Promise<void> {
    try {
      const [approvals, audit] = await Promise.all([
        listApprovalRecords({ scenarioId: targetScenarioId, limit: 20 }),
        listAuditRecords({ limit: 20 })
      ]);
      setApprovalRecords(approvals);
      setAuditRecords(
        audit.map((entry) => ({
          id: entry.id,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          createdAt: entry.createdAt
        }))
      );
    } catch (loadError) {
      const detail = loadError instanceof Error ? loadError.message : String(loadError);
      pushError(`Failed to load approval/audit evidence: ${detail}`);
    }
  }

  async function loadNotificationEvidence(): Promise<void> {
    if (!isIpcAvailable()) {
      setNotificationEndpoints([]);
      return;
    }
    try {
      const endpoints = await listNotificationEndpoints({
        endpointType: "teams",
        limit: 20
      });
      setNotificationEndpoints(endpoints);
    } catch (loadError) {
      const detail = loadError instanceof Error ? loadError.message : String(loadError);
      pushError(`Failed to load notification endpoint health: ${detail}`);
    }
  }

  async function loadTechCatalog(): Promise<void> {
    try {
      const nextStatus = await getTechCatalogStatus();
      setCatalogStatus(nextStatus);
    } catch (loadError) {
      const detail = loadError instanceof Error ? loadError.message : String(loadError);
      pushError(`Failed to load tech catalog status: ${detail}`);
    }
  }

  async function loadSettingsCenter(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const [settingsResponse, nextSecurityStatus] = await Promise.all([
        getSettings(),
        getDatabaseSecurityStatus()
      ]);

      const runtime: RuntimeSettings = {
        startWithWindows: settingsResponse.startWithWindows,
        minimizeToTray: settingsResponse.minimizeToTray,
        teamsEnabled: settingsResponse.teamsEnabled,
        teamsWebhookUrl: settingsResponse.teamsWebhookUrl
      };
      setBaselineSettings(runtime);
      setDraftSettings(runtime);
      setRestoreSummary(settingsResponse.lastRestoreSummary ?? null);
      setSecurityStatus(nextSecurityStatus);
      await Promise.all([
        loadScenarioPlanningSettings(),
        loadFinanceReferences(),
        loadAuditEvidence(),
        loadNotificationEvidence(),
        loadTechCatalog()
      ]);
      pushStatus("Settings loaded.", "info");
    } catch (loadError) {
      const detail = loadError instanceof Error ? loadError.message : String(loadError);
      pushError(`Failed to load settings center: ${detail}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSettingsCenter();
  }, []);

  useEffect(() => {
    void (async () => {
      await Promise.all([loadScenarioPlanningSettings(), loadAuditEvidence()]);
    })();
  }, [selectedScenarioId]);

  async function applyRuntimeSettings(): Promise<void> {
    setError(null);
    setStatus(null);
    setSavingRuntime(true);
    try {
      const saved = await saveSettings(draftSettings);
      setDraftSettings(saved);
      setBaselineSettings(saved);
      pushStatus("Runtime settings saved.");
    } catch (saveError) {
      const detail = saveError instanceof Error ? saveError.message : String(saveError);
      pushError(`Failed to save runtime settings: ${detail}`);
    } finally {
      setSavingRuntime(false);
    }
  }

  async function applyNotificationSettings(): Promise<void> {
    if (validation.notifications.length > 0) {
      pushError(validation.notifications[0]);
      return;
    }

    setError(null);
    setStatus(null);
    setSavingNotifications(true);
    try {
      const saved = await saveSettings(draftSettings);
      setDraftSettings(saved);
      setBaselineSettings(saved);
      pushStatus("Notification settings saved.");
    } catch (saveError) {
      const detail = saveError instanceof Error ? saveError.message : String(saveError);
      pushError(`Failed to save notification settings: ${detail}`);
    } finally {
      setSavingNotifications(false);
    }
  }

  async function handleSendTeamsTest(): Promise<void> {
    if (sectionDirty.notifications) {
      pushError("Save notification settings before sending a Teams test.");
      return;
    }

    setError(null);
    setStatus(null);
    setSendingTeamsTest(true);
    try {
      const result = await sendTeamsTestAlert();
      if (result.ok) {
        pushStatus("Teams test notification sent.");
        setTeamsTestEvidence({
          testedAt: new Date().toISOString(),
          status: "ok"
        });
      } else {
        pushStatus(`Teams test failed (${result.health.status}).`, "warning");
        setTeamsTestEvidence({
          testedAt: new Date().toISOString(),
          status: "failed"
        });
      }
      await loadNotificationEvidence();
    } catch (sendError) {
      const detail = sendError instanceof Error ? sendError.message : String(sendError);
      pushError(`Teams test failed: ${detail}`);
      setTeamsTestEvidence({
        testedAt: new Date().toISOString(),
        status: "failed"
      });
    } finally {
      setSendingTeamsTest(false);
    }
  }

  async function handleForceCatalogSync(): Promise<void> {
    setError(null);
    setStatus(null);
    setSyncingCatalog(true);
    try {
      const nextStatus = await syncTechCatalog({ force: true });
      setCatalogStatus(nextStatus);
      if (nextStatus.lastError) {
        pushStatus(`Catalog sync completed with warning: ${nextStatus.lastError}`, "warning");
      } else {
        pushStatus("Tech catalog synced.");
      }
    } catch (syncError) {
      const detail = syncError instanceof Error ? syncError.message : String(syncError);
      pushError(`Tech catalog sync failed: ${detail}`);
    } finally {
      setSyncingCatalog(false);
    }
  }

  async function handleCreateBackup(): Promise<void> {
    const destination = backupDestination.trim();
    setError(null);
    setStatus(null);
    setBackupBusy(true);
    try {
      const created = await createBackup(
        destination.length > 0 ? { destinationDir: destination } : undefined
      );
      setBackupPathInput(created.backupPath);
      setManifestPathInput(created.manifestPath);
      setVerifyBackupPathInput(created.backupPath);
      setVerifyManifestPathInput(created.manifestPath);
      pushStatus(`Backup created: ${created.backupPath}`);
    } catch (backupError) {
      const detail = backupError instanceof Error ? backupError.message : String(backupError);
      pushError(`Backup creation failed: ${detail}`);
    } finally {
      setBackupBusy(false);
    }
  }

  async function handleVerifyBackup(): Promise<void> {
    setError(null);
    setStatus(null);
    setBackupBusy(true);
    try {
      const result = await verifyBackup({
        backupPath: verifyBackupPathInput.trim() || undefined,
        manifestPath: verifyManifestPathInput.trim() || undefined
      });
      setBackupVerifyResult(result);
      pushStatus(
        result.ok ? "Backup verification passed." : "Backup verification failed.",
        result.ok ? "success" : "warning"
      );
    } catch (verifyError) {
      const detail = verifyError instanceof Error ? verifyError.message : String(verifyError);
      pushError(`Backup verification failed: ${detail}`);
    } finally {
      setBackupBusy(false);
    }
  }

  async function handleRestoreBackup(): Promise<void> {
    if (validation.backupRestore.length > 0) {
      pushError(validation.backupRestore[0]);
      return;
    }
    const backupPath = backupPathInput.trim();
    const manifestPath = manifestPathInput.trim();
    if (!backupPath || !manifestPath) {
      pushError("Provide both backup and manifest paths before restoring.");
      return;
    }

    setError(null);
    setStatus(null);
    setRestoringBackup(true);
    try {
      const restored = await restoreBackup(backupPath, manifestPath);
      const clearedKeys = reconcileMachineLocalStateAfterRestore(restored);
      setRestoreSummary(restored);
      pushStatus(
        clearedKeys.length > 0
          ? "Backup restore completed. Machine-local UI state was reset for compatibility."
          : "Backup restore completed."
      );
    } catch (restoreError) {
      const detail = restoreError instanceof Error ? restoreError.message : String(restoreError);
      pushError(`Backup restore failed: ${detail}`);
    } finally {
      setRestoringBackup(false);
    }
  }

  async function handleResetDatabaseConfirm(): Promise<void> {
    setError(null);
    setStatus(null);
    setOpenResetDialog(false);
    setResettingDatabase(true);
    try {
      const result: DatabaseResetResult = await resetDatabase({
        backupDestinationDir: backupDestination.trim() || undefined
      });
      setBackupPathInput(result.backupPath);
      setManifestPathInput(result.manifestPath);
      setVerifyBackupPathInput(result.backupPath);
      setVerifyManifestPathInput(result.manifestPath);
      setBackupVerifyResult(null);
      setRestoreSummary(null);
      setDiagnostics(null);
      selectScenario("baseline");
      await Promise.all([
        loadScenarioPlanningSettings("baseline"),
        loadFinanceReferences(),
        loadAuditEvidence("baseline"),
        loadNotificationEvidence()
      ]);
      pushStatus(`Database reset complete. Backup saved to ${result.backupPath}.`);
    } catch (resetError) {
      const detail = resetError instanceof Error ? resetError.message : String(resetError);
      pushError(`Database reset failed: ${detail}`);
    } finally {
      setResettingDatabase(false);
    }
  }

  async function handleRekeyConfirm(): Promise<void> {
    setError(null);
    setStatus(null);
    setOpenRekeyDialog(false);
    setRekeyBusy(true);
    try {
      const result = await rekeyDatabase();
      const nextSecurity = await getDatabaseSecurityStatus();
      setSecurityStatus(nextSecurity);
      pushStatus(`Database key rotated at ${result.rotatedAt}.`);
    } catch (rekeyError) {
      const detail = rekeyError instanceof Error ? rekeyError.message : String(rekeyError);
      pushError(`Database re-key failed: ${detail}`);
    } finally {
      setRekeyBusy(false);
    }
  }

  async function handleMaterializeConfirm(): Promise<void> {
    setError(null);
    setStatus(null);
    setOpenMaterializeDialog(false);
    setMaintenanceBusy("materialize");
    try {
      const result = await materializeForecast({
        scenarioId: selectedScenarioId,
        horizonMonths: 24
      });
      pushStatus(
        `Forecast materialized: ${result.generatedCount} occurrences generated for ${result.scenarioId}.`
      );
    } catch (materializeError) {
      const detail = materializeError instanceof Error ? materializeError.message : String(materializeError);
      pushError(`Forecast materialization failed: ${detail}`);
    } finally {
      setMaintenanceBusy(null);
    }
  }

  async function handleDiagnosticsConfirm(): Promise<void> {
    setError(null);
    setStatus(null);
    setOpenDiagnosticsDialog(false);
    setMaintenanceBusy("diagnostics");
    try {
      const result = await runDiagnostics({ scenarioId: selectedScenarioId });
      setDiagnostics(result);
      pushStatus("Diagnostics captured.");
    } catch (diagnosticsError) {
      const detail = diagnosticsError instanceof Error ? diagnosticsError.message : String(diagnosticsError);
      pushError(`Diagnostics failed: ${detail}`);
    } finally {
      setMaintenanceBusy(null);
    }
  }

  async function handleSaveScenarioSettings(): Promise<void> {
    const fiscalYearStartMonth = Number.parseInt(scenarioSettings.fiscalYearStartMonth, 10);
    const horizonMonths = Number.parseInt(scenarioSettings.horizonMonths, 10);
    if (Number.isNaN(fiscalYearStartMonth) || fiscalYearStartMonth < 1 || fiscalYearStartMonth > 12) {
      pushError("Fiscal year start month must be between 1 and 12.");
      return;
    }
    if (Number.isNaN(horizonMonths) || horizonMonths < 1 || horizonMonths > 60) {
      pushError("Horizon months must be between 1 and 60.");
      return;
    }

    try {
      const updated = await updateScenarioSettings({
        scenarioId: selectedScenarioId,
        fiscalYearStartMonth,
        horizonMonths,
        defaultCurrency: scenarioSettings.defaultCurrency
      });
      setScenarioSettings({
        fiscalYearStartMonth: String(updated.fiscalYearStartMonth),
        horizonMonths: String(updated.horizonMonths),
        defaultCurrency: updated.defaultCurrency
      });
      pushStatus("Scenario planning settings saved.");
    } catch (saveError) {
      const detail = saveError instanceof Error ? saveError.message : String(saveError);
      pushError(`Failed to save scenario planning settings: ${detail}`);
    }
  }

  async function handleCreateCostCenter(): Promise<void> {
    const code = newCostCenterCode.trim();
    const name = newCostCenterName.trim();
    if (!code || !name) {
      pushError("Cost center code and name are required.");
      return;
    }
    try {
      await createCostCenter({ code, name, active: true });
      setNewCostCenterCode("");
      setNewCostCenterName("");
      await loadFinanceReferences();
      pushStatus(`Cost center ${code} created.`);
    } catch (saveError) {
      const detail = saveError instanceof Error ? saveError.message : String(saveError);
      pushError(`Failed to create cost center: ${detail}`);
    }
  }

  async function handleCreateGlAccount(): Promise<void> {
    const code = newGlAccountCode.trim();
    const name = newGlAccountName.trim();
    if (!code || !name) {
      pushError("GL account code and name are required.");
      return;
    }
    try {
      await createGlAccount({ code, name, active: true });
      setNewGlAccountCode("");
      setNewGlAccountName("");
      await loadFinanceReferences();
      pushStatus(`GL account ${code} created.`);
    } catch (saveError) {
      const detail = saveError instanceof Error ? saveError.message : String(saveError);
      pushError(`Failed to create GL account: ${detail}`);
    }
  }

  async function toggleCostCenterActive(entry: CostCenterRecord): Promise<void> {
    try {
      await updateCostCenter({
        code: entry.code,
        name: entry.name,
        active: !entry.active
      });
      await loadFinanceReferences();
    } catch (saveError) {
      const detail = saveError instanceof Error ? saveError.message : String(saveError);
      pushError(`Failed to update cost center: ${detail}`);
    }
  }

  async function toggleGlAccountActive(entry: GlAccountRecord): Promise<void> {
    try {
      await updateGlAccount({
        code: entry.code,
        name: entry.name,
        active: !entry.active
      });
      await loadFinanceReferences();
    } catch (saveError) {
      const detail = saveError instanceof Error ? saveError.message : String(saveError);
      pushError(`Failed to update GL account: ${detail}`);
    }
  }

  if (loading) {
    return (
      <section className="settings-page settings-page--loading">
        <LoadingState label="Loading settings..." />
      </section>
    );
  }

  return (
    <section className="settings-page">
      <PageHeader
        title="Settings Center"
        subtitle="Runtime, notifications, backup/restore, security, and maintenance operations."
        actions={
          <Button appearance="secondary" onClick={() => void loadSettingsCenter()}>
            Reload Settings
          </Button>
        }
      />

      {error ? <InlineError message={error} /> : null}
      {status ? <Text>{status}</Text> : null}
      {validation.notifications.length > 0 ? (
        <Text>{validation.notifications[0]}</Text>
      ) : null}

      <section className="settings-grid">
        <Card className="settings-card">
          <div className="settings-card__header">
            <Title3>Runtime</Title3>
            {sectionDirty.runtime ? (
              <Badge appearance="filled" color="warning">
                Unsaved
              </Badge>
            ) : (
              <Badge appearance="tint" color="success">
                Saved
              </Badge>
            )}
          </div>
          <Switch
            label="Start on system login"
            checked={draftSettings.startWithWindows}
            onChange={(_event, data) =>
              setDraftSettings((current) => ({
                ...current,
                startWithWindows: Boolean(data.checked)
              }))
            }
          />
          <Switch
            label="Minimize to tray on close"
            checked={draftSettings.minimizeToTray}
            onChange={(_event, data) =>
              setDraftSettings((current) => ({
                ...current,
                minimizeToTray: Boolean(data.checked)
              }))
            }
          />
          <Button
            appearance="primary"
            disabled={!sectionDirty.runtime || savingRuntime}
            onClick={() => void applyRuntimeSettings()}
          >
            {savingRuntime ? "Saving..." : "Save Runtime Settings"}
          </Button>
        </Card>

        <Card className="settings-card">
          <div className="settings-card__header">
            <Title3>Notifications</Title3>
            {sectionDirty.notifications ? (
              <Badge appearance="filled" color="warning">
                Unsaved
              </Badge>
            ) : (
              <Badge appearance="tint" color="success">
                Saved
              </Badge>
            )}
          </div>
          <Switch
            label="Enable Teams webhook channel"
            checked={draftSettings.teamsEnabled}
            onChange={(_event, data) =>
              setDraftSettings((current) => ({
                ...current,
                teamsEnabled: Boolean(data.checked)
              }))
            }
          />
          <Input
            aria-label="Teams webhook URL"
            value={draftSettings.teamsWebhookUrl}
            onChange={(_event, data) =>
              setDraftSettings((current) => ({
                ...current,
                teamsWebhookUrl: data.value
              }))
            }
            placeholder="https://..."
          />
          <div className="settings-card__actions">
            <Button
              appearance="primary"
              disabled={
                savingNotifications ||
                validation.notifications.length > 0 ||
                !sectionDirty.notifications
              }
              onClick={() => void applyNotificationSettings()}
            >
              {savingNotifications ? "Saving..." : "Save Notifications"}
            </Button>
            <Button
              appearance="secondary"
              disabled={sendingTeamsTest || draftSettings.teamsEnabled === false}
              onClick={() => void handleSendTeamsTest()}
            >
              {sendingTeamsTest ? "Sending..." : "Send Teams Test"}
            </Button>
          </div>
        </Card>

        <Card className="settings-card">
          <Title3>Tech Catalog</Title3>
          <Text size={200}>
            Repo-backed provider catalog for software, hardware, ISP, and cellular vendors.
          </Text>
          <Text>{`Source: ${catalogStatus?.sourceUrl || "Desktop sync unavailable."}`}</Text>
          <Text>{`Entries: ${catalogStatus?.entryCount ?? 0}`}</Text>
          <Text>{`Catalog updated: ${catalogStatus?.catalogUpdatedAt || "unknown"}`}</Text>
          <Text>{`Last checked: ${catalogStatus?.checkedAt ?? "never"}`}</Text>
          <Text>{`Last synced: ${catalogStatus?.lastSyncedAt ?? "never"}`}</Text>
          <Text>{`Using fallback catalog: ${catalogStatus?.usingFallback ? "yes" : "no"}`}</Text>
          <Text>{`Software vendors: ${
            catalogStatus?.countsByCategory.software_vendor ?? 0
          } | Hardware vendors: ${
            catalogStatus?.countsByCategory.hardware_vendor ?? 0
          } | ISPs: ${catalogStatus?.countsByCategory.isp ?? 0} | Cellular: ${
            catalogStatus?.countsByCategory.cellular_provider ?? 0
          }`}</Text>
          {catalogStatus?.lastError ? (
            <Text>{`Last sync warning: ${catalogStatus.lastError}`}</Text>
          ) : (
            <Text size={200}>Catalog checks run automatically every 24 hours.</Text>
          )}
          <Button
            appearance="secondary"
            disabled={!isIpcAvailable() || syncingCatalog}
            onClick={() => void handleForceCatalogSync()}
          >
            {syncingCatalog ? "Syncing..." : "Force Sync Catalog"}
          </Button>
        </Card>

        <Card className="settings-card settings-card--full">
          <Title3>Backup & Restore</Title3>
          <div className="settings-backup">
            <section className="settings-backup__section">
              <div className="settings-backup__section-header">
                <Text weight="semibold">Create backup</Text>
                <Text size={200}>Write a database backup and manifest to a target directory.</Text>
              </div>
              <div className="settings-backup__row settings-backup__row--create">
                <div className="settings-backup__field">
                  <Text className="settings-backup__label" size={200} weight="medium">
                    Destination directory
                  </Text>
                  <Input
                    aria-label="Backup destination directory"
                    value={backupDestination}
                    onChange={(_event, data) => setBackupDestination(data.value)}
                    placeholder="Leave blank to use system default"
                  />
                </div>
                <Button
                  appearance="secondary"
                  disabled={!isIpcAvailable() || backupBusy}
                  onClick={() =>
                    void browseDirectory(
                      "Choose backup destination",
                      backupDestination,
                      setBackupDestination
                    )
                  }
                >
                  Browse…
                </Button>
                <Button disabled={backupBusy} onClick={() => void handleCreateBackup()}>
                  {backupBusy ? "Working..." : "Create Backup"}
                </Button>
              </div>
            </section>

            <section className="settings-backup__section">
              <div className="settings-backup__section-header">
                <Text weight="semibold">Restore backup</Text>
                <Text size={200}>Restore from a backup database and its manifest file.</Text>
              </div>
              <div className="settings-backup__row settings-backup__row--restore">
                <div className="settings-backup__field">
                  <Text className="settings-backup__label" size={200} weight="medium">
                    Backup path
                  </Text>
                  <Input
                    aria-label="Restore backup path"
                    value={backupPathInput}
                    onChange={(_event, data) => setBackupPathInput(data.value)}
                    placeholder="Backup .db path"
                  />
                </div>
                <Button
                  appearance="secondary"
                  disabled={!isIpcAvailable() || restoringBackup}
                  onClick={() =>
                    void browseFile(
                      "Choose backup database",
                      backupPathInput,
                      setBackupPathInput,
                      ["db", "sqlite", "sqlite3"]
                    )
                  }
                >
                  Backup…
                </Button>
                <div className="settings-backup__field">
                  <Text className="settings-backup__label" size={200} weight="medium">
                    Manifest path
                  </Text>
                  <Input
                    aria-label="Restore manifest path"
                    value={manifestPathInput}
                    onChange={(_event, data) => setManifestPathInput(data.value)}
                    placeholder="Manifest .json path"
                  />
                </div>
                <Button
                  appearance="secondary"
                  disabled={!isIpcAvailable() || restoringBackup}
                  onClick={() =>
                    void browseFile(
                      "Choose backup manifest",
                      manifestPathInput,
                      setManifestPathInput,
                      ["json"]
                    )
                  }
                >
                  Manifest…
                </Button>
                <Button disabled={restoringBackup} onClick={() => void handleRestoreBackup()}>
                  {restoringBackup ? "Restoring..." : "Restore Backup"}
                </Button>
              </div>
            </section>

            <section className="settings-backup__section">
              <div className="settings-backup__section-header">
                <Text weight="semibold">Verify backup integrity</Text>
                <Text size={200}>Run checksum and manifest validation before restore.</Text>
              </div>
              <div className="settings-backup__row settings-backup__row--restore">
                <div className="settings-backup__field">
                  <Text className="settings-backup__label" size={200} weight="medium">
                    Backup path (optional)
                  </Text>
                  <Input
                    aria-label="Verify backup path"
                    value={verifyBackupPathInput}
                    onChange={(_event, data) => setVerifyBackupPathInput(data.value)}
                    placeholder="Backup .db path (optional)"
                  />
                </div>
                <Button
                  appearance="secondary"
                  disabled={!isIpcAvailable() || backupBusy}
                  onClick={() =>
                    void browseFile(
                      "Choose backup database to verify",
                      verifyBackupPathInput,
                      setVerifyBackupPathInput,
                      ["db", "sqlite", "sqlite3"]
                    )
                  }
                >
                  Backup…
                </Button>
                <div className="settings-backup__field">
                  <Text className="settings-backup__label" size={200} weight="medium">
                    Manifest path (optional)
                  </Text>
                  <Input
                    aria-label="Verify manifest path"
                    value={verifyManifestPathInput}
                    onChange={(_event, data) => setVerifyManifestPathInput(data.value)}
                    placeholder="Manifest .json path (optional)"
                  />
                </div>
                <Button
                  appearance="secondary"
                  disabled={!isIpcAvailable() || backupBusy}
                  onClick={() =>
                    void browseFile(
                      "Choose backup manifest to verify",
                      verifyManifestPathInput,
                      setVerifyManifestPathInput,
                      ["json"]
                    )
                  }
                >
                  Manifest…
                </Button>
                <Button disabled={backupBusy} onClick={() => void handleVerifyBackup()}>
                  {backupBusy ? "Working..." : "Verify Backup"}
                </Button>
              </div>
            </section>

            <section className="settings-backup__section">
              <div className="settings-backup__section-header">
                <Text weight="semibold">Backup then reset database</Text>
                <Text size={200}>
                  Creates a fresh backup and clears the current database, including vendors.
                </Text>
              </div>
              <div className="settings-card__actions">
                <Text size={200}>
                  Uses the destination directory above when provided, otherwise the default backup folder.
                </Text>
                <Button
                  appearance="secondary"
                  disabled={!isIpcAvailable() || resettingDatabase || backupBusy || restoringBackup}
                  onClick={() => setOpenResetDialog(true)}
                >
                  {resettingDatabase ? "Resetting..." : "Backup Then Reset"}
                </Button>
              </div>
            </section>
          </div>

          {restoreSummary ? (
            <Text data-testid="restore-asof-banner">{formatRestoreBanner(restoreSummary)}</Text>
          ) : null}
          {backupVerifyResult ? (
            <Text data-testid="backup-integrity-status">
              {backupVerifyResult.ok
                ? `Integrity verified at ${backupVerifyResult.lastVerifiedAt ?? "unknown time"}.`
                : `Integrity verification failed: ${backupVerifyResult.error ?? "unknown error"}`}
            </Text>
          ) : null}
          <Text size={200}>
            Encrypted backups cover database-backed records. {MACHINE_LOCAL_STATE_DECISION_SUMMARY}
          </Text>
        </Card>

        <Card className="settings-card">
          <Title3>Security</Title3>
          <Text>{`Safe storage available: ${
            securityStatus?.safeStorageAvailable ? "yes" : "no"
          }`}</Text>
          <Text>{`Database key present: ${securityStatus?.keyPresent ? "yes" : "no"}`}</Text>
          <Text>{`Database path: ${securityStatus?.databasePath ?? "unknown"}`}</Text>
          <Button
            appearance="secondary"
            disabled={rekeyBusy}
            onClick={() => setOpenRekeyDialog(true)}
          >
            {rekeyBusy ? "Re-Keying..." : "Re-Key Database"}
          </Button>
        </Card>

        <Card className="settings-card">
          <Title3>Maintenance</Title3>
          <Text>{`Scenario context: ${selectedScenarioId}`}</Text>
          <div className="settings-card__actions">
            <Button
              appearance="secondary"
              disabled={maintenanceBusy !== null}
              onClick={() => setOpenMaterializeDialog(true)}
            >
              {maintenanceBusy === "materialize"
                ? "Materializing..."
                : "Re-Materialize Forecast"}
            </Button>
            <Button
              appearance="secondary"
              disabled={maintenanceBusy !== null}
              onClick={() => setOpenDiagnosticsDialog(true)}
            >
              {maintenanceBusy === "diagnostics" ? "Collecting..." : "Run Diagnostics"}
            </Button>
          </div>
          {diagnostics ? (
            <div className="settings-card__diagnostics">
              <Text>{`Integrity: ${diagnostics.database.integrity}`}</Text>
              <Text>{`Schema version: ${diagnostics.database.schemaVersion}`}</Text>
              <Text>{`Forecast stale: ${diagnostics.database.forecastStale ? "yes" : "no"}`}</Text>
              <Text>{`Last backup: ${diagnostics.backup.lastBackupAt ?? "none"}`}</Text>
              <Text>{`Last verified: ${diagnostics.backup.lastVerifiedAt ?? "none"}`}</Text>
              <Text>{`Expense rows: ${diagnostics.counts.expense_line ?? 0}`}</Text>
            </div>
          ) : null}
        </Card>

        <Card className="settings-card">
          <Title3>Scenario Planning</Title3>
          <Text>{`Scenario context: ${selectedScenarioId}`}</Text>
          <Input
            aria-label="Fiscal year start month"
            type="number"
            min="1"
            max="12"
            value={scenarioSettings.fiscalYearStartMonth}
            onChange={(_event, data) =>
              setScenarioSettings((current) => ({
                ...current,
                fiscalYearStartMonth: data.value
              }))
            }
          />
          <Input
            aria-label="Scenario horizon months"
            type="number"
            min="1"
            max="60"
            value={scenarioSettings.horizonMonths}
            onChange={(_event, data) =>
              setScenarioSettings((current) => ({
                ...current,
                horizonMonths: data.value
              }))
            }
          />
          <Input
            aria-label="Scenario default currency"
            value={scenarioSettings.defaultCurrency}
            onChange={(_event, data) =>
              setScenarioSettings((current) => ({
                ...current,
                defaultCurrency: data.value.toUpperCase()
              }))
            }
          />
          <Button appearance="secondary" onClick={() => void handleSaveScenarioSettings()}>
            Save Scenario Settings
          </Button>
        </Card>

        <Card className="settings-card settings-card--full">
          <Title3>Finance Reference Data</Title3>
          {financeRefsLoading ? <Text>Loading reference data...</Text> : null}
          <div className="settings-card__actions">
            <Input
              aria-label="New cost center code"
              value={newCostCenterCode}
              onChange={(_event, data) => setNewCostCenterCode(data.value)}
              placeholder="Cost center code"
            />
            <Input
              aria-label="New cost center name"
              value={newCostCenterName}
              onChange={(_event, data) => setNewCostCenterName(data.value)}
              placeholder="Cost center name"
            />
            <Button appearance="secondary" onClick={() => void handleCreateCostCenter()}>
              Add Cost Center
            </Button>
          </div>
          <ul>
            {costCenters.map((entry) => (
              <li key={entry.code}>
                <Text>{`${entry.code} - ${entry.name} (${entry.active ? "active" : "inactive"})`}</Text>
                <Button
                  size="small"
                  appearance="secondary"
                  onClick={() => void toggleCostCenterActive(entry)}
                >
                  Toggle Active
                </Button>
              </li>
            ))}
          </ul>
          <div className="settings-card__actions">
            <Input
              aria-label="New GL account code"
              value={newGlAccountCode}
              onChange={(_event, data) => setNewGlAccountCode(data.value)}
              placeholder="GL account code"
            />
            <Input
              aria-label="New GL account name"
              value={newGlAccountName}
              onChange={(_event, data) => setNewGlAccountName(data.value)}
              placeholder="GL account name"
            />
            <Button appearance="secondary" onClick={() => void handleCreateGlAccount()}>
              Add GL Account
            </Button>
          </div>
          <ul>
            {glAccounts.map((entry) => (
              <li key={entry.code}>
                <Text>{`${entry.code} - ${entry.name} (${entry.active ? "active" : "inactive"})`}</Text>
                <Button
                  size="small"
                  appearance="secondary"
                  onClick={() => void toggleGlAccountActive(entry)}
                >
                  Toggle Active
                </Button>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="settings-card settings-card--full">
          <Title3>Operational Evidence</Title3>
          <Text weight="semibold">Teams endpoint health</Text>
          <Text>
            {teamsTestEvidence
              ? `${teamsTestEvidence.status} at ${teamsTestEvidence.testedAt}`
              : "No test evidence captured in this session."}
          </Text>
          {notificationEndpoints.length === 0 ? (
            <Text>No persisted endpoint health records.</Text>
          ) : (
            <ul>
              {notificationEndpoints.map((entry) => (
                <li key={entry.id}>
                  <Text>{`${entry.endpointType} | ${entry.enabled ? "enabled" : "disabled"} | ${
                    entry.lastTestResult ?? "untested"
                  } | ${entry.lastTestAt ?? "no-test-time"}`}</Text>
                </li>
              ))}
            </ul>
          )}
          <Text weight="semibold">Recent approvals</Text>
          {approvalRecords.length === 0 ? (
            <Text>No approval records found.</Text>
          ) : (
            <ul>
              {approvalRecords.map((entry) => (
                <li key={entry.id}>
                  <Text>{`${entry.createdAt} | ${entry.entityType}:${entry.entityId} | ${entry.action}`}</Text>
                </li>
              ))}
            </ul>
          )}
          <Text weight="semibold">Recent audit log</Text>
          {auditRecords.length === 0 ? (
            <Text>No audit records found.</Text>
          ) : (
            <ul>
              {auditRecords.map((entry) => (
                <li key={entry.id}>
                  <Text>{`${entry.createdAt} | ${entry.action} | ${entry.entityType}:${entry.entityId}`}</Text>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {hasDirtySections(sectionDirty) ? (
        <Text>There are unsaved runtime/notification changes.</Text>
      ) : null}

      <ConfirmDialog
        open={openRekeyDialog}
        title="Re-key encrypted database?"
        message="This rotates the local encryption key. Continue only if you are ready to update recovery handling."
        onOpenChange={setOpenRekeyDialog}
        onConfirm={() => void handleRekeyConfirm()}
        confirmLabel="Rotate Key"
      />
      <ConfirmDialog
        open={openResetDialog}
        title="Backup and reset database?"
        message="This creates a backup and clears the current database, including vendors, services, contracts, expenses, tags, scenarios, approvals, and other database content."
        onOpenChange={setOpenResetDialog}
        onConfirm={() => void handleResetDatabaseConfirm()}
        confirmLabel="Backup Then Reset"
      />
      <ConfirmDialog
        open={openMaterializeDialog}
        title="Re-materialize forecast?"
        message="This regenerates forecast occurrences for the selected scenario."
        onOpenChange={setOpenMaterializeDialog}
        onConfirm={() => void handleMaterializeConfirm()}
        confirmLabel="Re-Materialize"
      />
      <ConfirmDialog
        open={openDiagnosticsDialog}
        title="Run maintenance diagnostics?"
        message="This collects database integrity and backup-health diagnostics."
        onOpenChange={setOpenDiagnosticsDialog}
        onConfirm={() => void handleDiagnosticsConfirm()}
        confirmLabel="Run Diagnostics"
      />
    </section>
  );
}
