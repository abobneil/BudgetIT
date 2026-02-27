/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { FluentProvider } from "@fluentui/react-components";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "../../app/AppShell";
import { AppRoutes } from "../../app/routes";
import {
  createBackup,
  getDatabaseSecurityStatus,
  getSettings,
  materializeForecast,
  rekeyDatabase,
  restoreBackup,
  runDiagnostics,
  saveSettings,
  sendTeamsTestAlert,
  verifyBackup
} from "../../lib/ipcClient";
import { budgetItLightTheme } from "../../ui/theme";
import { ScenarioProvider } from "../scenarios/ScenarioContext";
import { SettingsPage } from "./SettingsPage";

vi.mock("../../lib/ipcClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/ipcClient")>();
  return {
    ...actual,
    getSettings: vi.fn(),
    saveSettings: vi.fn(),
    getDatabaseSecurityStatus: vi.fn(),
    sendTeamsTestAlert: vi.fn(),
    createBackup: vi.fn(),
    verifyBackup: vi.fn(),
    restoreBackup: vi.fn(),
    rekeyDatabase: vi.fn(),
    materializeForecast: vi.fn(),
    runDiagnostics: vi.fn()
  };
});

const getSettingsMock = vi.mocked(getSettings);
const saveSettingsMock = vi.mocked(saveSettings);
const getDatabaseSecurityStatusMock = vi.mocked(getDatabaseSecurityStatus);
const sendTeamsTestAlertMock = vi.mocked(sendTeamsTestAlert);
const createBackupMock = vi.mocked(createBackup);
const verifyBackupMock = vi.mocked(verifyBackup);
const restoreBackupMock = vi.mocked(restoreBackup);
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
    getSettingsMock.mockReset();
    saveSettingsMock.mockReset();
    getDatabaseSecurityStatusMock.mockReset();
    sendTeamsTestAlertMock.mockReset();
    createBackupMock.mockReset();
    verifyBackupMock.mockReset();
    restoreBackupMock.mockReset();
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
    saveSettingsMock.mockImplementation(async (settings) => settings);
    getDatabaseSecurityStatusMock.mockResolvedValue({
      databasePath: "C:\\Users\\tester\\AppData\\Roaming\\BudgetIT\\data\\budgetit.db",
      keyPresent: true,
      safeStorageAvailable: true
    });
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

    fireEvent.click(screen.getByRole("switch", { name: "Start with Windows" }));
    fireEvent.click(screen.getByRole("switch", { name: "Minimize to tray on close" }));
    fireEvent.click(screen.getByRole("button", { name: "Save runtime settings" }));

    await waitFor(() => {
      expect(saveSettingsMock).toHaveBeenCalledWith({
        startWithWindows: false,
        minimizeToTray: false,
        teamsEnabled: false,
        teamsWebhookUrl: ""
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "Reload settings" }));

    await waitFor(() => {
      expect(getSettingsMock).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByRole("switch", { name: "Start with Windows" })).not.toBeChecked();
    expect(screen.getByRole("switch", { name: "Minimize to tray on close" })).not.toBeChecked();
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

    fireEvent.click(screen.getByRole("switch", { name: "Start with Windows" }));
    fireEvent.click(screen.getByRole("switch", { name: "Minimize to tray on close" }));
    fireEvent.click(screen.getByRole("button", { name: "Save runtime settings" }));
    await waitFor(() => {
      expect(saveSettingsMock).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByLabelText("Restore backup path"), {
      target: { value: "C:\\Backups\\BudgetIT\\backup.db" }
    });
    fireEvent.change(screen.getByLabelText("Restore manifest path"), {
      target: { value: "C:\\Backups\\BudgetIT\\backup.manifest.json" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Restore backup" }));

    expect(await screen.findByTestId("restore-asof-banner")).toHaveTextContent(
      "Data current as of 2026-02-27T15:50:00.000Z (restored 2026-02-27T16:20:00.000Z)"
    );

    fireEvent.click(screen.getByRole("button", { name: "Reload settings" }));
    await waitFor(() => {
      expect(getSettingsMock).toHaveBeenCalledTimes(2);
    });

    expect(screen.getByRole("switch", { name: "Start with Windows" })).not.toBeChecked();
    expect(screen.getByRole("switch", { name: "Minimize to tray on close" })).not.toBeChecked();
    expect(screen.getByTestId("restore-asof-banner")).toHaveTextContent(
      "Data current as of 2026-02-27T15:50:00.000Z (restored 2026-02-27T16:20:00.000Z)"
    );
  });
});
