import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Input,
  Spinner,
  Switch,
  Text,
  Title3
} from "@fluentui/react-components";

import { formatRestoreBanner, type RestoreSummary } from "../../restore-banner";
import {
  createBackup,
  defaultSettings,
  getDatabaseSecurityStatus,
  getSettings,
  materializeForecast,
  rekeyDatabase,
  restoreBackup,
  runDiagnostics,
  saveSettings,
  sendTeamsTestAlert,
  verifyBackup,
  type BackupVerifyResult,
  type DatabaseSecurityStatus,
  type MaintenanceDiagnosticsResult,
  type RuntimeSettings
} from "../../lib/ipcClient";
import { ConfirmDialog, InlineError, PageHeader } from "../../ui/primitives";
import { useScenarioContext } from "../scenarios/ScenarioContext";
import {
  computeSettingsSectionDirtyState,
  hasDirtySections,
  validateSettingsDraft
} from "./settings-model";
import "./SettingsPage.css";

const DEFAULT_BACKUP_DESTINATION = "C:\\Backups\\BudgetIT";

export function SettingsPage() {
  const { selectedScenarioId } = useScenarioContext();
  const [baselineSettings, setBaselineSettings] = useState<RuntimeSettings>(defaultSettings);
  const [draftSettings, setDraftSettings] = useState<RuntimeSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [savingRuntime, setSavingRuntime] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [sendingTeamsTest, setSendingTeamsTest] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState(false);
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
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [openRekeyDialog, setOpenRekeyDialog] = useState(false);
  const [openMaterializeDialog, setOpenMaterializeDialog] = useState(false);
  const [openDiagnosticsDialog, setOpenDiagnosticsDialog] = useState(false);

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
      setStatus("Settings loaded.");
    } catch (loadError) {
      const detail = loadError instanceof Error ? loadError.message : String(loadError);
      setError(`Failed to load settings center: ${detail}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSettingsCenter();
  }, []);

  async function applyRuntimeSettings(): Promise<void> {
    setError(null);
    setStatus(null);
    setSavingRuntime(true);
    try {
      const saved = await saveSettings(draftSettings);
      setDraftSettings(saved);
      setBaselineSettings(saved);
      setStatus("Runtime settings saved.");
    } catch (saveError) {
      const detail = saveError instanceof Error ? saveError.message : String(saveError);
      setError(`Failed to save runtime settings: ${detail}`);
    } finally {
      setSavingRuntime(false);
    }
  }

  async function applyNotificationSettings(): Promise<void> {
    if (validation.notifications.length > 0) {
      setError(validation.notifications[0]);
      return;
    }

    setError(null);
    setStatus(null);
    setSavingNotifications(true);
    try {
      const saved = await saveSettings(draftSettings);
      setDraftSettings(saved);
      setBaselineSettings(saved);
      setStatus("Notification settings saved.");
    } catch (saveError) {
      const detail = saveError instanceof Error ? saveError.message : String(saveError);
      setError(`Failed to save notification settings: ${detail}`);
    } finally {
      setSavingNotifications(false);
    }
  }

  async function handleSendTeamsTest(): Promise<void> {
    if (sectionDirty.notifications) {
      setError("Save notification settings before sending a Teams test.");
      return;
    }

    setError(null);
    setStatus(null);
    setSendingTeamsTest(true);
    try {
      const result = await sendTeamsTestAlert();
      if (result.ok) {
        setStatus("Teams test notification sent.");
      } else {
        setStatus(`Teams test failed (${result.health.status}).`);
      }
    } catch (sendError) {
      const detail = sendError instanceof Error ? sendError.message : String(sendError);
      setError(`Teams test failed: ${detail}`);
    } finally {
      setSendingTeamsTest(false);
    }
  }

  async function handleCreateBackup(): Promise<void> {
    const destination = backupDestination.trim();
    if (!destination) {
      setError("Backup destination is required.");
      return;
    }

    setError(null);
    setStatus(null);
    setBackupBusy(true);
    try {
      const created = await createBackup({ destinationDir: destination });
      setBackupPathInput(created.backupPath);
      setManifestPathInput(created.manifestPath);
      setVerifyBackupPathInput(created.backupPath);
      setVerifyManifestPathInput(created.manifestPath);
      setStatus(`Backup created: ${created.backupPath}`);
    } catch (backupError) {
      const detail = backupError instanceof Error ? backupError.message : String(backupError);
      setError(`Backup creation failed: ${detail}`);
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
      setStatus(result.ok ? "Backup verification passed." : "Backup verification failed.");
    } catch (verifyError) {
      const detail = verifyError instanceof Error ? verifyError.message : String(verifyError);
      setError(`Backup verification failed: ${detail}`);
    } finally {
      setBackupBusy(false);
    }
  }

  async function handleRestoreBackup(): Promise<void> {
    if (validation.backupRestore.length > 0) {
      setError(validation.backupRestore[0]);
      return;
    }
    const backupPath = backupPathInput.trim();
    const manifestPath = manifestPathInput.trim();
    if (!backupPath || !manifestPath) {
      setError("Provide both backup and manifest paths before restoring.");
      return;
    }

    setError(null);
    setStatus(null);
    setRestoringBackup(true);
    try {
      const restored = await restoreBackup(backupPath, manifestPath);
      setRestoreSummary(restored);
      setStatus("Backup restore completed.");
    } catch (restoreError) {
      const detail = restoreError instanceof Error ? restoreError.message : String(restoreError);
      setError(`Backup restore failed: ${detail}`);
    } finally {
      setRestoringBackup(false);
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
      setStatus(`Database key rotated at ${result.rotatedAt}.`);
    } catch (rekeyError) {
      const detail = rekeyError instanceof Error ? rekeyError.message : String(rekeyError);
      setError(`Database re-key failed: ${detail}`);
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
      setStatus(
        `Forecast materialized: ${result.generatedCount} occurrences generated for ${result.scenarioId}.`
      );
    } catch (materializeError) {
      const detail = materializeError instanceof Error ? materializeError.message : String(materializeError);
      setError(`Forecast materialization failed: ${detail}`);
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
      setStatus("Diagnostics captured.");
    } catch (diagnosticsError) {
      const detail = diagnosticsError instanceof Error ? diagnosticsError.message : String(diagnosticsError);
      setError(`Diagnostics failed: ${detail}`);
    } finally {
      setMaintenanceBusy(null);
    }
  }

  if (loading) {
    return (
      <section className="settings-page settings-page--loading">
        <Spinner label="Loading settings..." />
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
            Reload settings
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
            label="Start with Windows"
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
            {savingRuntime ? "Saving..." : "Save runtime settings"}
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
              {savingNotifications ? "Saving..." : "Save notifications"}
            </Button>
            <Button
              appearance="secondary"
              disabled={sendingTeamsTest || draftSettings.teamsEnabled === false}
              onClick={() => void handleSendTeamsTest()}
            >
              {sendingTeamsTest ? "Sending..." : "Send Teams test"}
            </Button>
          </div>
        </Card>

        <Card className="settings-card settings-card--full">
          <Title3>Backup & Restore</Title3>
          <div className="settings-card__field-row">
            <Input
              aria-label="Backup destination directory"
              value={backupDestination}
              onChange={(_event, data) => setBackupDestination(data.value)}
              placeholder="C:\\Backups\\BudgetIT"
            />
            <Button disabled={backupBusy} onClick={() => void handleCreateBackup()}>
              {backupBusy ? "Working..." : "Create backup"}
            </Button>
          </div>

          <div className="settings-card__field-row">
            <Input
              aria-label="Restore backup path"
              value={backupPathInput}
              onChange={(_event, data) => setBackupPathInput(data.value)}
              placeholder="Backup .db path"
            />
            <Input
              aria-label="Restore manifest path"
              value={manifestPathInput}
              onChange={(_event, data) => setManifestPathInput(data.value)}
              placeholder="Manifest .json path"
            />
            <Button disabled={restoringBackup} onClick={() => void handleRestoreBackup()}>
              {restoringBackup ? "Restoring..." : "Restore backup"}
            </Button>
          </div>

          <div className="settings-card__field-row">
            <Input
              aria-label="Verify backup path"
              value={verifyBackupPathInput}
              onChange={(_event, data) => setVerifyBackupPathInput(data.value)}
              placeholder="Backup .db path (optional)"
            />
            <Input
              aria-label="Verify manifest path"
              value={verifyManifestPathInput}
              onChange={(_event, data) => setVerifyManifestPathInput(data.value)}
              placeholder="Manifest .json path (optional)"
            />
            <Button disabled={backupBusy} onClick={() => void handleVerifyBackup()}>
              {backupBusy ? "Working..." : "Verify backup"}
            </Button>
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
            {rekeyBusy ? "Re-keying..." : "Re-key database"}
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
                : "Re-materialize forecast"}
            </Button>
            <Button
              appearance="secondary"
              disabled={maintenanceBusy !== null}
              onClick={() => setOpenDiagnosticsDialog(true)}
            >
              {maintenanceBusy === "diagnostics" ? "Collecting..." : "Run diagnostics"}
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
        confirmLabel="Rotate key"
      />
      <ConfirmDialog
        open={openMaterializeDialog}
        title="Re-materialize forecast?"
        message="This regenerates forecast occurrences for the selected scenario."
        onOpenChange={setOpenMaterializeDialog}
        onConfirm={() => void handleMaterializeConfirm()}
        confirmLabel="Re-materialize"
      />
      <ConfirmDialog
        open={openDiagnosticsDialog}
        title="Run maintenance diagnostics?"
        message="This collects database integrity and backup-health diagnostics."
        onOpenChange={setOpenDiagnosticsDialog}
        onConfirm={() => void handleDiagnosticsConfirm()}
        confirmLabel="Run diagnostics"
      />
    </section>
  );
}
