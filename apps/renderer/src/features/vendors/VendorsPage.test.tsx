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
import { ScenarioProvider } from "../scenarios/ScenarioContext";
import * as ipcClient from "../../lib/ipcClient";
import { budgetItLightTheme } from "../../ui/theme";
import { VendorsPage } from "./VendorsPage";
import { INITIAL_VENDOR_RECORDS } from "./vendor-data";

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

function renderVendorsPage() {
  return render(
    <FluentProvider theme={budgetItLightTheme}>
      <MemoryRouter initialEntries={["/vendors"]}>
        <ScenarioProvider>
          <VendorsPage />
        </ScenarioProvider>
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

describe("VendorsPage", () => {
  beforeEach(() => {
    openHelpWindowSpy.mockReset();
    openHelpWindowSpy.mockResolvedValue({ ok: true });
  });

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

    fireEvent.click(within(awsRow).getByRole("button", { name: "Open Services" }));
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
    fireEvent.click(within(awsRowAgain).getByRole("button", { name: "Open Expenses" }));
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
      await addOwnerFromField("Vendor owner", "Security Operations");
      fireEvent.change(screen.getByLabelText("Vendor annual spend"), {
        target: { value: "500.00" }
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
        screen.getByRole("button", { name: "Open Service Cloud Platform" })
      );
      await waitFor(() => {
        expect(screen.getByTestId("page-title")).toHaveTextContent("Services");
      });
      const servicesTable = screen.getByRole("table", { name: "Services table" });
      expect(within(servicesTable).getByText("Cloud Platform")).toBeInTheDocument();
    },
    15000
  );

  it(
    "opens the vendor form guide from the drawer",
    async () => {
      renderWorkspace("/vendors");

      await screen.findByText("Vendors Workspace");
      fireEvent.click(screen.getByRole("button", { name: "Create Vendor" }));
      fireEvent.click(screen.getByRole("button", { name: "Vendor Form Guide" }));

      await waitFor(() => {
        expect(openHelpWindowSpy).toHaveBeenCalledWith({
          topic: "vendors-form",
          anchor: "createedit-vendor-form",
          q: "vendor form",
          context: "vendors:form"
        });
      });
      expect(screen.getByRole("button", { name: "Vendor Form Guide" })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Help Center" })).not.toBeInTheDocument();
      expect(screen.getByTestId("current-location")).not.toHaveTextContent("/help");
    },
    15000
  );

  it("shows vendor catalog suggestions in a scrollable list capped to 4 visible rows", async () => {
    vi.spyOn(ipcClient, "isIpcAvailable").mockReturnValue(true);
    vi.spyOn(ipcClient, "listScenarios").mockResolvedValue([
      {
        id: "scenario-default",
        name: "Default",
        approvalStatus: "draft",
        isLocked: false,
        parentScenarioId: null,
        createdAt: "2026-03-08T00:00:00.000Z",
        updatedAt: "2026-03-08T00:00:00.000Z"
      }
    ]);
    vi.spyOn(ipcClient, "listVendors").mockResolvedValue(
      INITIAL_VENDOR_RECORDS.map((vendor) => ({
        id: vendor.id,
        name: vendor.name,
        website: null,
        notes: null,
        ownerId: vendor.ownerId,
        owner: vendor.owner,
        annualSpendMinor: vendor.annualSpendMinor,
        status: vendor.status,
        risk: vendor.risk,
        createdAt: "2026-03-08T00:00:00.000Z",
        updatedAt: "2026-03-08T00:00:00.000Z",
        deletedAt: null
      }))
    );
    vi.spyOn(ipcClient, "listOwners").mockResolvedValue(
      Array.from(
        new Map(
          INITIAL_VENDOR_RECORDS.map((vendor) => [
            vendor.ownerId,
            {
              id: vendor.ownerId,
              name: vendor.owner,
              archivedAt: null,
              createdAt: "2026-03-08T00:00:00.000Z",
              updatedAt: "2026-03-08T00:00:00.000Z",
              vendorCount: 1,
              serviceCount: 0,
              contractCount: 0
            }
          ])
        ).values()
      )
    );
    vi.spyOn(ipcClient, "listServices").mockResolvedValue([]);
    vi.spyOn(ipcClient, "listContracts").mockResolvedValue([]);
    vi.spyOn(ipcClient, "listTechCatalogEntries").mockResolvedValue(
      Array.from({ length: 12 }, (_, index) => ({
        id: `catalog-vendor-${index + 1}`,
        name: `Catalog Vendor ${String(index + 1).padStart(2, "0")}`,
        categories: ["software_vendor" as const],
        website: null,
        aliases: [],
        notes: null
      }))
    );

    renderVendorsPage();

    fireEvent.click(await screen.findByRole("button", { name: "Create Vendor" }));

    const vendorNameInput = screen.getByLabelText("Vendor name");
    fireEvent.focus(vendorNameInput);
    fireEvent.change(vendorNameInput, { target: { value: "Catalog Vendor" } });

    const listbox = await screen.findByRole("listbox", { name: "Vendor suggestions" });
    expect(listbox).toHaveAttribute("data-visible-limit", "4");
    expect(within(listbox).getAllByRole("option")).toHaveLength(12);

    fireEvent.mouseDown(within(listbox).getByRole("button", { name: "Catalog Vendor 01" }));
    expect(vendorNameInput).toHaveValue("Catalog Vendor 01");
    await waitFor(() => {
      expect(
        screen.queryByRole("listbox", { name: "Vendor suggestions" })
      ).not.toBeInTheDocument();
    });
  });

  it("filters vendors by shared owner directory options", async () => {
    renderVendorsPage();

    await screen.findByText("Vendors Workspace");
    fireEvent.change(screen.getByLabelText("Filter vendors by owner"), {
      target: { value: INITIAL_VENDOR_RECORDS[0].ownerId }
    });

    const vendorsTable = screen.getByRole("table", { name: "Vendors table" });
    expect(within(vendorsTable).getByText("Okta")).toBeInTheDocument();
    expect(within(vendorsTable).queryByText("AWS")).not.toBeInTheDocument();
  });
});
