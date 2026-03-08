/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { FluentProvider } from "@fluentui/react-components";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "../../app/AppShell";
import { AppRoutes } from "../../app/routes";
import {
  createBackup,
  getDatabaseSecurityStatus,
  getScenarioSettings,
  getSettings,
  isIpcAvailable,
  listApprovalRecords,
  listAuditRecords,
  listScenarios,
  listCostCenters,
  listGlAccounts,
  listNotificationEndpoints,
  materializeForecast,
  pickDirectoryPath,
  pickFilePath,
  rekeyDatabase,
  restoreBackup,
  runDiagnostics,
  saveSettings,
  sendTeamsTestAlert,
  verifyBackup
} from "../../lib/ipcClient";
import { DASHBOARD_LAYOUT_STORAGE_KEY } from "../../lib/machineLocalState";
import { budgetItLightTheme } from "../../ui/theme";
import { ScenarioProvider } from "../scenarios/ScenarioContext";
import { SettingsPage } from "./SettingsPage";

vi.mock("../../lib/ipcClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/ipcClient")>();
  return {
    ...actual,
    getSettings: vi.fn(),
    isIpcAvailable: vi.fn(),
    saveSettings: vi.fn(),
    getDatabaseSecurityStatus: vi.fn(),
    getScenarioSettings: vi.fn(),
    listCostCenters: vi.fn(),
    listGlAccounts: vi.fn(),
    listScenarios: vi.fn(),
    listApprovalRecords: vi.fn(),
    listAuditRecords: vi.fn(),
    listNotificationEndpoints: vi.fn(),
    sendTeamsTestAlert: vi.fn(),
    createBackup: vi.fn(),
    verifyBackup: vi.fn(),
    restoreBackup: vi.fn(),
    pickDirectoryPath: vi.fn(),
    pickFilePath: vi.fn(),
    rekeyDatabase: vi.fn(),
    materializeForecast: vi.fn(),
    runDiagnostics: vi.fn()
  };
});

const getSettingsMock = vi.mocked(getSettings);
const isIpcAvailableMock = vi.mocked(isIpcAvailable);
const saveSettingsMock = vi.mocked(saveSettings);
const getDatabaseSecurityStatusMock = vi.mocked(getDatabaseSecurityStatus);
const getScenarioSettingsMock = vi.mocked(getScenarioSettings);
const sendTeamsTestAlertMock = vi.mocked(sendTeamsTestAlert);
const listCostCentersMock = vi.mocked(listCostCenters);
const listGlAccountsMock = vi.mocked(listGlAccounts);
const listScenariosMock = vi.mocked(listScenarios);
const listApprovalRecordsMock = vi.mocked(listApprovalRecords);
const listAuditRecordsMock = vi.mocked(listAuditRecords);
const listNotificationEndpointsMock = vi.mocked(listNotificationEndpoints);
const createBackupMock = vi.mocked(createBackup);
const verifyBackupMock = vi.mocked(verifyBackup);
const restoreBackupMock = vi.mocked(restoreBackup);
const pickDirectoryPathMock = vi.mocked(pickDirectoryPath);
const pickFilePathMock = vi.mocked(pickFilePath);
const rekeyDatabaseMock = vi.mocked(rekeyDatabase);
const materializeForecastMock = vi.mocked(materializeForecast);
const runDiagnosticsMock = vi.mocked(runDiagnostics);

function renderSettingsPage() {
  return render(
    <ScenarioProvider>
      <FluentProvider theme={budgetItLightTheme}>
        <MemoryRouter>
          <SettingsPage />
        </MemoryRouter>
      </FluentProvider>
    </ScenarioProvider>
  );
}

function renderSettingsRoute() {
  return render(
    <ScenarioProvider>
      <FluentProvider theme={budgetItLightTheme}>
        <MemoryRouter initialEntries={["/settings"]}>
          <AppShell>
            <AppRoutes />
          </AppShell>
        </MemoryRouter>
      </FluentProvider>
    </ScenarioProvider>
  );
}

describe("SettingsPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    getSettingsMock.mockReset();
    isIpcAvailableMock.mockReset();
    saveSettingsMock.mockReset();
    getDatabaseSecurityStatusMock.mockReset();
    getScenarioSettingsMock.mockReset();
    sendTeamsTestAlertMock.mockReset();
    listCostCentersMock.mockReset();
    listGlAccountsMock.mockReset();
    listScenariosMock.mockReset();
    listApprovalRecordsMock.mockReset();
    listAuditRecordsMock.mockReset();
    listNotificationEndpointsMock.mockReset();
    createBackupMock.mockReset();
    verifyBackupMock.mockReset();
    restoreBackupMock.mockReset();
    pickDirectoryPathMock.mockReset();
    pickFilePathMock.mockReset();
    rekeyDatabaseMock.mockReset();
    materializeForecastMock.mockReset();
    runDiagnosticsMock.mockReset();

    getSettingsMock.mockResolvedValue({
      startWithWindows: true,
      minimizeToTray: true,
      teamsEnabled: false,
      teamsWebhookUrl: "",
      lastRestoreSummary: null
    });
    isIpcAvailableMock.mockReturnValue(false);
    saveSettingsMock.mockImplementation(async (settings) => settings);
    getDatabaseSecurityStatusMock.mockResolvedValue({
      databasePath: "C:\\Users\\tester\\AppData\\Roaming\\BudgetIT\\data\\budgetit.db",
      keyPresent: true,
      safeStorageAvailable: true
    });
    getScenarioSettingsMock.mockResolvedValue({
      scenarioId: "baseline",
      fiscalYearStartMonth: 1,
      horizonMonths: 24,
      defaultCurrency: "USD",
      createdAt: "2026-02-27T10:00:00.000Z",
      updatedAt: "2026-02-27T10:00:00.000Z"
    });
    listCostCentersMock.mockResolvedValue([]);
    listGlAccountsMock.mockResolvedValue([]);
    listScenariosMock.mockResolvedValue([
      {
        id: "baseline",
        name: "Baseline",
        approvalStatus: "draft",
        isLocked: false,
        parentScenarioId: null,
        createdAt: "2026-02-27T10:00:00.000Z",
        updatedAt: "2026-02-27T10:00:00.000Z"
      }
    ]);
    listApprovalRecordsMock.mockResolvedValue([]);
    listAuditRecordsMock.mockResolvedValue([]);
    listNotificationEndpointsMock.mockResolvedValue([]);
    sendTeamsTestAlertMock.mockResolvedValue({
      ok: true,
      attempts: 1,
      statusCode: 200,
      health: { status: "healthy" }
    });
    createBackupMock.mockResolvedValue({
      backupPath: "C:\\Backups\\BudgetIT\\budgetit-backup.db",
      manifestPath: "C:\\Backups\\BudgetIT\\budgetit-backup.manifest.json",
      manifest: {
        createdAt: "2026-02-27T16:00:00.000Z",
        sourceLastMutationAt: "2026-02-27T15:00:00.000Z",
        schemaVersion: 1,
        checksumSha256: "deadbeef",
        destinationKind: "local_or_external"
      }
    });
    verifyBackupMock.mockResolvedValue({
      ok: true,
      lastVerifiedAt: "2026-02-27T16:10:00.000Z"
    });
    restoreBackupMock.mockResolvedValue({
      restoredAt: "2026-02-27T16:20:00.000Z",
      sourceLastMutationAt: "2026-02-27T15:50:00.000Z",
      schemaVersion: 1
    });
    pickDirectoryPathMock.mockResolvedValue(null);
    pickFilePathMock.mockResolvedValue(null);
    rekeyDatabaseMock.mockResolvedValue({
      ok: true,
      rotatedAt: "2026-02-27T16:30:00.000Z"
    });
    materializeForecastMock.mockResolvedValue({
      ok: true,
      generatedCount: 24,
      horizonMonths: 24,
      scenarioId: "baseline",
      generatedAt: "2026-02-27T16:35:00.000Z"
    });
    runDiagnosticsMock.mockResolvedValue({
      scenarioId: "baseline",
      generatedAt: "2026-02-27T16:40:00.000Z",
      database: {
        path: "C:\\Users\\tester\\AppData\\Roaming\\BudgetIT\\data\\budgetit.db",
        schemaVersion: 1,
        forecastStale: false,
        forecastGeneratedAt: "2026-02-27T16:36:00.000Z",
        lastMutationAt: "2026-02-27T16:36:00.000Z",
        integrity: "ok"
      },
      backup: {
        lastBackupAt: "2026-02-27T16:00:00.000Z",
        lastVerifiedAt: "2026-02-27T16:10:00.000Z"
      },
      counts: {
        expense_line: 12
      }
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("saves runtime settings and reflects updated values on reload", async () => {
    getSettingsMock
      .mockResolvedValueOnce({
        startWithWindows: true,
        minimizeToTray: true,
        teamsEnabled: false,
        teamsWebhookUrl: "",
        lastRestoreSummary: null
      })
      .mockResolvedValueOnce({
        startWithWindows: false,
        minimizeToTray: false,
        teamsEnabled: false,
        teamsWebhookUrl: "",
        lastRestoreSummary: null
      });

    renderSettingsPage();
    await screen.findByText("Settings Center");

    fireEvent.click(screen.getByRole("switch", { name: "Start on system login" }));
    fireEvent.click(screen.getByRole("switch", { name: "Minimize to tray on close" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Runtime Settings" }));

    await waitFor(() => {
      expect(saveSettingsMock).toHaveBeenCalledWith({
        startWithWindows: false,
        minimizeToTray: false,
        teamsEnabled: false,
        teamsWebhookUrl: ""
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "Reload Settings" }));

    await waitFor(() => {
      expect(getSettingsMock).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByRole("switch", { name: "Start on system login" })).not.toBeChecked();
    expect(screen.getByRole("switch", { name: "Minimize to tray on close" })).not.toBeChecked();
  });

  it("browses backup destination directory and populates the create-backup input", async () => {
    isIpcAvailableMock.mockReturnValue(true);
    pickDirectoryPathMock.mockResolvedValueOnce("C:\\Backups\\BudgetIT");

    renderSettingsPage();
    await screen.findByText("Settings Center");

    const createBackupRow = screen
      .getByLabelText("Backup destination directory")
      .closest(".settings-backup__row") as HTMLElement | null;
    if (!createBackupRow) {
      throw new Error("Expected create-backup row to be rendered.");
    }

    fireEvent.click(within(createBackupRow).getByRole("button", { name: "Browse…" }));

    await waitFor(() => {
      expect(pickDirectoryPathMock).toHaveBeenCalledWith({
        title: "Choose backup destination",
        defaultPath: undefined
      });
    });
    expect(screen.getByLabelText("Backup destination directory")).toHaveValue(
      "C:\\Backups\\BudgetIT"
    );
  });

  it("browses restore and verify files and populates the matching inputs", async () => {
    isIpcAvailableMock.mockReturnValue(true);
    pickFilePathMock
      .mockResolvedValueOnce("C:\\Backups\\BudgetIT\\restore.db")
      .mockResolvedValueOnce("C:\\Backups\\BudgetIT\\restore.manifest.json")
      .mockResolvedValueOnce("C:\\Backups\\BudgetIT\\verify.db")
      .mockResolvedValueOnce("C:\\Backups\\BudgetIT\\verify.manifest.json");

    renderSettingsPage();
    await screen.findByText("Settings Center");

    const restoreRow = screen
      .getByLabelText("Restore backup path")
      .closest(".settings-backup__row") as HTMLElement | null;
    if (!restoreRow) {
      throw new Error("Expected restore row to be rendered.");
    }
    fireEvent.click(within(restoreRow).getByRole("button", { name: "Backup…" }));
    fireEvent.click(within(restoreRow).getByRole("button", { name: "Manifest…" }));

    const verifyRow = screen
      .getByLabelText("Verify backup path")
      .closest(".settings-backup__row") as HTMLElement | null;
    if (!verifyRow) {
      throw new Error("Expected verify row to be rendered.");
    }
    fireEvent.click(within(verifyRow).getByRole("button", { name: "Backup…" }));
    fireEvent.click(within(verifyRow).getByRole("button", { name: "Manifest…" }));

    await waitFor(() => {
      expect(pickFilePathMock).toHaveBeenCalledTimes(4);
    });
    expect(pickFilePathMock).toHaveBeenNthCalledWith(1, {
      title: "Choose backup database",
      defaultPath: undefined,
      filters: [{ name: "Files", extensions: ["db", "sqlite", "sqlite3"] }]
    });
    expect(pickFilePathMock).toHaveBeenNthCalledWith(2, {
      title: "Choose backup manifest",
      defaultPath: undefined,
      filters: [{ name: "Files", extensions: ["json"] }]
    });
    expect(pickFilePathMock).toHaveBeenNthCalledWith(3, {
      title: "Choose backup database to verify",
      defaultPath: undefined,
      filters: [{ name: "Files", extensions: ["db", "sqlite", "sqlite3"] }]
    });
    expect(pickFilePathMock).toHaveBeenNthCalledWith(4, {
      title: "Choose backup manifest to verify",
      defaultPath: undefined,
      filters: [{ name: "Files", extensions: ["json"] }]
    });
    expect(screen.getByLabelText("Restore backup path")).toHaveValue(
      "C:\\Backups\\BudgetIT\\restore.db"
    );
    expect(screen.getByLabelText("Restore manifest path")).toHaveValue(
      "C:\\Backups\\BudgetIT\\restore.manifest.json"
    );
    expect(screen.getByLabelText("Verify backup path")).toHaveValue(
      "C:\\Backups\\BudgetIT\\verify.db"
    );
    expect(screen.getByLabelText("Verify manifest path")).toHaveValue(
      "C:\\Backups\\BudgetIT\\verify.manifest.json"
    );
  });

  it("persists startup/tray changes and shows restore as-of banner in routed workspace flow", async () => {
    getSettingsMock
      .mockResolvedValueOnce({
        startWithWindows: true,
        minimizeToTray: true,
        teamsEnabled: false,
        teamsWebhookUrl: "",
        lastRestoreSummary: null
      })
      .mockResolvedValueOnce({
        startWithWindows: false,
        minimizeToTray: false,
        teamsEnabled: false,
        teamsWebhookUrl: "",
        lastRestoreSummary: {
          restoredAt: "2026-02-27T16:20:00.000Z",
          sourceLastMutationAt: "2026-02-27T15:50:00.000Z",
          schemaVersion: 1
        }
      });

    renderSettingsRoute();
    await waitFor(() => {
      expect(screen.getByTestId("page-title")).toHaveTextContent("Settings");
    });

    fireEvent.click(screen.getByRole("switch", { name: "Start on system login" }));
    fireEvent.click(screen.getByRole("switch", { name: "Minimize to tray on close" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Runtime Settings" }));
    await waitFor(() => {
      expect(saveSettingsMock).toHaveBeenCalled();
    });

    window.localStorage.setItem(DASHBOARD_LAYOUT_STORAGE_KEY, JSON.stringify({ cards: [] }));

    fireEvent.change(screen.getByLabelText("Restore backup path"), {
      target: { value: "C:\\Backups\\BudgetIT\\backup.db" }
    });
    fireEvent.change(screen.getByLabelText("Restore manifest path"), {
      target: { value: "C:\\Backups\\BudgetIT\\backup.manifest.json" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Restore Backup" }));

    expect(await screen.findByTestId("restore-asof-banner")).toHaveTextContent(
      "Data current as of 2026-02-27T15:50:00.000Z (restored 2026-02-27T16:20:00.000Z)"
    );
    expect(window.localStorage.getItem(DASHBOARD_LAYOUT_STORAGE_KEY)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Reload Settings" }));
    await waitFor(() => {
      expect(getSettingsMock).toHaveBeenCalledTimes(2);
    });

    expect(screen.getByRole("switch", { name: "Start on system login" })).not.toBeChecked();
    expect(screen.getByRole("switch", { name: "Minimize to tray on close" })).not.toBeChecked();
    expect(screen.getByTestId("restore-asof-banner")).toHaveTextContent(
      "Data current as of 2026-02-27T15:50:00.000Z (restored 2026-02-27T16:20:00.000Z)"
    );
  });
});
