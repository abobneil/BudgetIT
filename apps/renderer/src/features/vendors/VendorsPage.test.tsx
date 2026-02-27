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

describe("VendorsPage", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows linked counts and applies vendor filters across services and expenses pages", async () => {
    renderWorkspace("/vendors");

    await screen.findByText("Vendors Workspace");
    expect(screen.getByTestId("vendor-service-count-vend-aws")).toHaveTextContent("1");
    expect(screen.getByTestId("vendor-contract-count-vend-aws")).toHaveTextContent("1");

    const awsRow = screen.getByTestId("vendor-service-count-vend-aws").closest("tr");
    if (!awsRow) {
      throw new Error("Expected AWS vendor row.");
    }

    fireEvent.click(within(awsRow).getByRole("button", { name: "Open services" }));
    await waitFor(() => {
      expect(screen.getByTestId("page-title")).toHaveTextContent("Services");
    });
    const servicesTable = screen.getByRole("table", { name: "Services table" });
    expect(within(servicesTable).getByText("Cloud Platform")).toBeInTheDocument();
    expect(within(servicesTable).queryByText("Identity SSO")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Vendors" }));
    await screen.findByText("Vendors Workspace");

    const awsRowAgain = screen.getByTestId("vendor-service-count-vend-aws").closest("tr");
    if (!awsRowAgain) {
      throw new Error("Expected AWS vendor row after returning to vendors.");
    }
    fireEvent.click(within(awsRowAgain).getByRole("button", { name: "Open expenses" }));
    await waitFor(() => {
      expect(screen.getByTestId("page-title")).toHaveTextContent("Expenses");
    });
    const expensesTable = screen.getByRole("table", { name: "Expenses table" });
    expect(within(expensesTable).getByText("Cloud Compute")).toBeInTheDocument();
    expect(within(expensesTable).queryByText("Endpoint Security")).not.toBeInTheDocument();
  });

  it(
    "supports create+attach workflow and blocks unsafe delete while allowing archive",
    async () => {
      renderWorkspace("/vendors");

      await screen.findByText("Vendors Workspace");
      fireEvent.click(screen.getByRole("button", { name: "Create Vendor" }));

      fireEvent.change(screen.getByLabelText("Vendor name"), {
        target: { value: "Acme Security" }
      });
      fireEvent.change(screen.getByLabelText("Vendor owner"), {
        target: { value: "Security Operations" }
      });
      fireEvent.change(screen.getByLabelText("Vendor annual spend minor units"), {
        target: { value: "50000" }
      });
      fireEvent.change(screen.getByLabelText("Vendor linked service IDs"), {
        target: { value: "svc-cloud-platform" }
      });

      const createButtons = screen.getAllByRole("button", { name: "Create" });
      fireEvent.click(createButtons[createButtons.length - 1]);
      expect(await screen.findByText("Vendor Acme Security created.")).toBeInTheDocument();
      expect(
        screen.getByTestId("vendor-service-count-vend-acme-security")
      ).toHaveTextContent("1");

      const acmeRow = screen
        .getByTestId("vendor-service-count-vend-acme-security")
        .closest("tr");
      if (!acmeRow) {
        throw new Error("Expected Acme Security vendor row.");
      }

      fireEvent.click(within(acmeRow).getByRole("button", { name: "Delete" }));
      expect(
        await screen.findByText(
          "Cannot delete vendor while linked services or contracts exist."
        )
      ).toBeInTheDocument();

      fireEvent.click(within(acmeRow).getByRole("button", { name: "Archive" }));
      const archiveDialog = await screen.findByRole("dialog");
      fireEvent.click(
        within(archiveDialog).getByRole("button", { name: "Archive", hidden: true })
      );

      expect(await screen.findByText("Vendor Acme Security archived.")).toBeInTheDocument();

      fireEvent.click(
        screen.getByRole("button", { name: "Open service Cloud Platform" })
      );
      await waitFor(() => {
        expect(screen.getByTestId("page-title")).toHaveTextContent("Services");
      });
      const servicesTable = screen.getByRole("table", { name: "Services table" });
      expect(within(servicesTable).getByText("Cloud Platform")).toBeInTheDocument();
    },
    15000
  );
});
