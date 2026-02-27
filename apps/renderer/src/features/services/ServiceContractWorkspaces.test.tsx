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
import { afterEach, describe, expect, it } from "vitest";

import { AppShell } from "../../app/AppShell";
import { AppRoutes } from "../../app/routes";
import { budgetItLightTheme } from "../../ui/theme";

function renderWorkspace(initialPath: string) {
  return render(
    <FluentProvider theme={budgetItLightTheme}>
      <MemoryRouter initialEntries={[initialPath]}>
        <AppShell>
          <AppRoutes />
        </AppShell>
      </MemoryRouter>
    </FluentProvider>
  );
}

describe("service and contract workspaces", () => {
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
      within(serviceRow).getByRole("button", { name: "Open contract" })
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

    await screen.findByRole("button", { name: "Open contract CTR-CLOUD-OPS-07" });
    fireEvent.click(
      screen.getByRole("button", { name: "Open contract CTR-CLOUD-OPS-07" })
    );

    await waitFor(() => {
      expect(screen.getByTestId("page-title")).toHaveTextContent("Contracts");
    });

    fireEvent.click(screen.getByRole("button", { name: "Open related alert" }));

    await waitFor(() => {
      expect(screen.getByTestId("page-title")).toHaveTextContent("Alerts");
    });
    expect(screen.getByText("Alerts Inbox")).toBeInTheDocument();
  });

  it("opens replacement path from contracts workspace", async () => {
    renderWorkspace("/contracts?contract=ctr-cloud-ops");

    await screen.findByText("Contract Detail");
    fireEvent.click(screen.getByRole("button", { name: "Open replacement workspace" }));

    await waitFor(() => {
      expect(screen.getByTestId("page-title")).toHaveTextContent("Reports");
    });
    expect(
      screen.getByText(
        "Report gallery and configurable reporting workspace with export orchestration are planned in U11."
      )
    ).toBeInTheDocument();
  });
});
