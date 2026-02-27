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
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  acknowledgeAlert,
  listAlerts,
  onAlertNavigate,
  snoozeAlert,
  type AlertRecord
} from "../../lib/ipcClient";
import { budgetItLightTheme } from "../../ui/theme";
import { AlertsPage } from "./AlertsPage";

vi.mock("../../lib/ipcClient", () => ({
  listAlerts: vi.fn(),
  acknowledgeAlert: vi.fn(),
  snoozeAlert: vi.fn(),
  onAlertNavigate: vi.fn(),
  queryReport: vi.fn(),
  exportReport: vi.fn()
}));

const fixtureAlerts: AlertRecord[] = [
  {
    id: "alert-1",
    entityType: "contract",
    entityId: "contract-1",
    fireAt: "2026-03-03",
    status: "pending",
    snoozedUntil: null,
    message: "Renewal due in 5 days"
  },
  {
    id: "alert-2",
    entityType: "contract",
    entityId: "contract-2",
    fireAt: "2026-03-18",
    status: "snoozed",
    snoozedUntil: "2026-03-10",
    message: "Notice window opens soon"
  },
  {
    id: "alert-3",
    entityType: "vendor",
    entityId: "vendor-3",
    fireAt: "2026-05-04",
    status: "acked",
    snoozedUntil: null,
    message: "[HIGH] Deadline reached for cancellation"
  }
];

const listAlertsMock = vi.mocked(listAlerts);
const acknowledgeAlertMock = vi.mocked(acknowledgeAlert);
const snoozeAlertMock = vi.mocked(snoozeAlert);
const onAlertNavigateMock = vi.mocked(onAlertNavigate);

function renderAlertsPage(initialPath: string = "/alerts") {
  return render(
    <FluentProvider theme={budgetItLightTheme}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/alerts" element={<AlertsPage />} />
        </Routes>
      </MemoryRouter>
    </FluentProvider>
  );
}

describe("AlertsPage", () => {
  beforeEach(() => {
    listAlertsMock.mockReset();
    acknowledgeAlertMock.mockReset();
    snoozeAlertMock.mockReset();
    onAlertNavigateMock.mockReset();

    listAlertsMock.mockResolvedValue(fixtureAlerts);
    onAlertNavigateMock.mockReturnValue(() => {});
  });

  afterEach(() => {
    cleanup();
  });

  it("persists tab state from URL and mutates list state after ack", async () => {
    acknowledgeAlertMock.mockImplementation(async (alertEventId: string) => ({
      ...fixtureAlerts.find((alert) => alert.id === alertEventId)!,
      status: "acked",
      snoozedUntil: null
    }));

    renderAlertsPage("/alerts?tab=snoozed");

    await screen.findAllByText("Notice window opens soon");
    expect(screen.getByRole("tab", { name: /Snoozed/ })).toHaveAttribute("aria-selected", "true");

    fireEvent.click(screen.getByRole("button", { name: "Ack" }));

    await waitFor(() => {
      expect(acknowledgeAlertMock).toHaveBeenCalledWith("alert-2");
    });
    expect(await screen.findByText("No alerts in this tab")).toBeInTheDocument();
  });

  it("runs snooze quick action and updates alert state", async () => {
    snoozeAlertMock.mockImplementation(async (alertEventId: string, snoozedUntil: string) => ({
      ...fixtureAlerts.find((alert) => alert.id === alertEventId)!,
      status: "snoozed",
      snoozedUntil
    }));

    renderAlertsPage("/alerts?tab=dueSoon");
    await screen.findAllByText("Renewal due in 5 days");

    fireEvent.click(screen.getByRole("button", { name: "Snooze until +7d" }));
    await waitFor(() => {
      expect(snoozeAlertMock).toHaveBeenCalledWith(
        "alert-1",
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
      );
    });
    expect(await screen.findByText("No alerts in this tab")).toBeInTheDocument();
  });

  it("focuses the correct alert after notification deep-link callback", async () => {
    onAlertNavigateMock.mockImplementation(() => () => {});

    renderAlertsPage("/alerts?tab=all");
    await screen.findAllByText("Renewal due in 5 days");

    const navigateListener = onAlertNavigateMock.mock.calls[0]?.[0] as
      | ((payload: { alertEventId: string; entityType: string; entityId: string }) => void)
      | undefined;

    if (!navigateListener) {
      throw new Error("Expected alert navigation listener to be registered.");
    }

    navigateListener({
      alertEventId: "alert-2",
      entityType: "contract",
      entityId: "contract-2"
    });

    await waitFor(() => {
      expect(screen.getByText("Related entity: contract:contract-2")).toBeInTheDocument();
    });
    expect(screen.getAllByText("Notice window opens soon").length).toBeGreaterThan(0);
    expect(screen.getByRole("tab", { name: /All/ })).toHaveAttribute("aria-selected", "true");
  });
});
