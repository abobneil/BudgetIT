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
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "../../app/AppShell";
import { AppRoutes } from "../../app/routes";
import * as ipcClient from "../../lib/ipcClient";
import { budgetItLightTheme } from "../../ui/theme";

const openHelpWindowSpy = vi.spyOn(ipcClient, "openHelpWindow");

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="current-location">{`${location.pathname}${location.search}`}</div>;
}

function renderWorkspace(initialPath: string) {
  return render(
    <FluentProvider theme={budgetItLightTheme}>
      <MemoryRouter initialEntries={[initialPath]}>
        <AppShell>
          <>
            <LocationProbe />
            <AppRoutes />
          </>
        </AppShell>
      </MemoryRouter>
    </FluentProvider>
  );
}

async function addOwnerFromField(label: string, ownerName: string): Promise<void> {
  const input = screen.getByLabelText(label);
  fireEvent.focus(input);
  fireEvent.change(input, {
    target: { value: ownerName }
  });
  fireEvent.mouseDown(screen.getByRole("button", { name: `Add "${ownerName}"` }));
  await waitFor(() => {
    expect(input).toHaveValue(ownerName);
  });
}

describe("service and contract workspaces", () => {
  beforeEach(() => {
    openHelpWindowSpy.mockReset();
    openHelpWindowSpy.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    cleanup();
  });

  it("keeps service-contract linkage counts consistent and opens linked contract", async () => {
    renderWorkspace("/services");

    await screen.findByText("Services Workspace");
    expect(
      screen.getByTestId("service-linked-count-svc-identity-sso")
    ).toHaveTextContent("2");

    const serviceRow = screen
      .getByTestId("service-linked-count-svc-identity-sso")
      .closest("tr");
    if (!serviceRow) {
      throw new Error("Expected Identity SSO table row.");
    }

    fireEvent.click(
      within(serviceRow).getByRole("button", { name: "Open Contract" })
    );

    await waitFor(() => {
      expect(screen.getByTestId("page-title")).toHaveTextContent("Contracts");
    });
    expect(screen.getByText("Contract Detail")).toBeInTheDocument();
    expect(screen.getAllByText("CTR-SSO-001").length).toBeGreaterThan(0);
    expect(
      screen.getByTestId("contract-linked-count-ctr-sso-main")
    ).toHaveTextContent("1");
  });

  it("supports service to contract to related alert navigation path", async () => {
    renderWorkspace("/services?service=svc-cloud-platform&tab=contracts");

    await screen.findByRole("button", { name: "Open Contract CTR-CLOUD-OPS-07" });
    fireEvent.click(
      screen.getByRole("button", { name: "Open Contract CTR-CLOUD-OPS-07" })
    );

    await waitFor(() => {
      expect(screen.getByTestId("page-title")).toHaveTextContent("Contracts");
    });

    fireEvent.click(screen.getByRole("button", { name: "Open Related Alert" }));

    await waitFor(() => {
      expect(screen.getByTestId("page-title")).toHaveTextContent("Alerts");
    });
    expect(screen.getByText("Alerts Inbox")).toBeInTheDocument();
  });

  it("opens replacement path from contracts workspace", async () => {
    renderWorkspace("/contracts?contract=ctr-cloud-ops");

    await screen.findByText("Contract Detail");
    fireEvent.click(screen.getByRole("button", { name: "Open Replacement Workspace" }));

    await waitFor(() => {
      expect(screen.getByTestId("page-title")).toHaveTextContent("Reports");
    });
    expect(screen.getByTestId("reports-scenario-context")).toHaveTextContent("Baseline");
  });

  it("opens the service form guide from the drawer", async () => {
    renderWorkspace("/services");

    await screen.findByText("Services Workspace");
    fireEvent.click(screen.getByRole("button", { name: "Create Service" }));
    fireEvent.click(screen.getByRole("button", { name: "Service Form Guide" }));

    await waitFor(() => {
      expect(openHelpWindowSpy).toHaveBeenCalledWith({
        topic: "services-form",
        anchor: "createedit-service-form",
        q: "service form",
        context: "services:form"
      });
    });
    expect(screen.getByRole("button", { name: "Service Form Guide" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Help Center" })).not.toBeInTheDocument();
    expect(screen.getByTestId("current-location")).not.toHaveTextContent("/help");
  });

  it("accepts decimal annual spend values in the service form", async () => {
    renderWorkspace("/services");

    await screen.findByText("Services Workspace");
    fireEvent.click(screen.getByRole("button", { name: "Create Service" }));

    fireEvent.change(screen.getByLabelText("Service name"), {
      target: { value: "Acme Monitoring" }
    });
    await addOwnerFromField("Service owner", "Platform Ops");
    fireEvent.change(screen.getByLabelText("Service annual spend"), {
      target: { value: "500.00" }
    });

    const createButtons = screen.getAllByRole("button", { name: "Create" });
    fireEvent.click(createButtons[createButtons.length - 1]);

    expect(await screen.findByText("Service Acme Monitoring created.")).toBeInTheDocument();
    expect(screen.getAllByText("Acme Monitoring").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$500.00").length).toBeGreaterThan(0);
  });

  it("opens the contract form guide from the drawer", async () => {
    renderWorkspace("/contracts");

    await screen.findByText("Contracts Workspace");
    fireEvent.click(screen.getByRole("button", { name: "Create Contract" }));
    fireEvent.click(screen.getByRole("button", { name: "Contract Form Guide" }));

    await waitFor(() => {
      expect(openHelpWindowSpy).toHaveBeenCalledWith({
        topic: "contracts-form",
        anchor: "createedit-contract-form",
        q: "contract form",
        context: "contracts:form"
      });
    });
    expect(screen.getByRole("button", { name: "Contract Form Guide" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Help Center" })).not.toBeInTheDocument();
    expect(screen.getByTestId("current-location")).not.toHaveTextContent("/help");
  });

  it("defaults contract owner from the selected service until manually changed", async () => {
    renderWorkspace("/contracts");

    await screen.findByText("Contracts Workspace");
    fireEvent.click(screen.getByRole("button", { name: "Create Contract" }));

    const ownerInput = screen.getByLabelText("Contract owner");
    expect(ownerInput).toHaveValue("Platform Engineering");

    fireEvent.change(screen.getByLabelText("Contract linked service"), {
      target: { value: "svc-identity-sso" }
    });
    await waitFor(() => {
      expect(ownerInput).toHaveValue("IT Operations");
    });

    fireEvent.focus(ownerInput);
    fireEvent.change(ownerInput, {
      target: { value: "Security Team" }
    });
    fireEvent.mouseDown(
      within(screen.getByRole("listbox", { name: "Owner options" })).getByRole("button", {
        name: /Security Team/i
      })
    );
    await waitFor(() => {
      expect(ownerInput).toHaveValue("Security Team");
    });

    fireEvent.change(screen.getByLabelText("Contract linked service"), {
      target: { value: "svc-cloud-platform" }
    });
    expect(ownerInput).toHaveValue("Security Team");
  });
});
