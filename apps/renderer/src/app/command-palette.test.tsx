/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { FluentProvider } from "@fluentui/react-components";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "./AppShell";
import { AppRoutes } from "./routes";
import { budgetItLightTheme } from "../ui/theme";
import { createBackup } from "../lib/ipcClient";
import { ScenarioProvider } from "../features/scenarios/ScenarioContext";

vi.mock("../lib/ipcClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/ipcClient")>();
  return {
    ...actual,
    createBackup: vi.fn()
  };
});

const createBackupMock = vi.mocked(createBackup);

function renderWorkspace(initialPath = "/dashboard") {
  return render(
    <ScenarioProvider>
      <FluentProvider theme={budgetItLightTheme}>
        <MemoryRouter initialEntries={[initialPath]}>
          <AppShell>
            <AppRoutes />
          </AppShell>
        </MemoryRouter>
      </FluentProvider>
    </ScenarioProvider>
  );
}

describe("command palette and keyboard navigation", () => {
  beforeEach(() => {
    createBackupMock.mockReset();
    createBackupMock.mockResolvedValue({
      backupPath: "C:\\Backups\\BudgetIT\\backup.db",
      manifestPath: "C:\\Backups\\BudgetIT\\backup.manifest.json",
      manifest: {
        createdAt: "2026-02-27T18:00:00.000Z",
        sourceLastMutationAt: "2026-02-27T17:55:00.000Z",
        schemaVersion: 1,
        checksumSha256: "deadbeef",
        destinationKind: "local_or_external"
      }
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("finds and executes action and route commands from palette search", async () => {
    renderWorkspace();

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const paletteInput = screen.getByLabelText("Command palette input");
    fireEvent.change(paletteInput, { target: { value: "backup now" } });
    fireEvent.keyDown(paletteInput, { key: "Enter" });

    await waitFor(() => {
      expect(createBackupMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Backup created: C:\\Backups\\BudgetIT\\backup.db"
    );

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const routeInput = screen.getByLabelText("Command palette input");
    fireEvent.change(routeInput, { target: { value: "go to alerts" } });
    fireEvent.keyDown(routeInput, { key: "Enter" });

    await waitFor(() => {
      expect(screen.getByTestId("page-title")).toHaveTextContent("Alerts");
    });
  });

  it("supports keyboard-only flow to open palette and create a new expense", async () => {
    renderWorkspace("/dashboard");

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const paletteInput = screen.getByLabelText("Command palette input");
    fireEvent.change(paletteInput, { target: { value: "new expense" } });
    fireEvent.keyDown(paletteInput, { key: "Enter" });

    await waitFor(() => {
      expect(screen.getByTestId("page-title")).toHaveTextContent("Expenses");
    });
    expect(await screen.findByLabelText("Expense name")).toBeInTheDocument();
  });

  it("navigates to entity workspaces from global search", async () => {
    renderWorkspace("/dashboard");

    fireEvent.change(screen.getByLabelText("Global search"), {
      target: { value: "Expense: Endpoint Security" }
    });
    fireEvent.keyDown(screen.getByLabelText("Global search"), { key: "Enter" });

    await waitFor(() => {
      expect(screen.getByTestId("page-title")).toHaveTextContent("Expenses");
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Opened Expense: Endpoint Security."
    );
  });
});
