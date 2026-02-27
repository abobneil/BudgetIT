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
import { afterEach, describe, expect, it, vi } from "vitest";

import { budgetItLightTheme } from "../../ui/theme";
import { ExpensesPage } from "./ExpensesPage";

function renderExpensesPage() {
  return render(
    <FluentProvider theme={budgetItLightTheme}>
      <MemoryRouter>
        <ExpensesPage />
      </MemoryRouter>
    </FluentProvider>
  );
}

function getDataRows() {
  const rows = screen.getAllByRole("row");
  return rows.slice(1);
}

function getExpensesTable() {
  return screen.getByRole("table", { name: "Expenses table" });
}

describe("ExpensesPage", () => {
  afterEach(() => {
    cleanup();
  });

  it("applies search/filter and sort behavior to table rows", () => {
    renderExpensesPage();
    const table = getExpensesTable();

    fireEvent.change(screen.getByLabelText("Search expenses"), {
      target: { value: "cloud" }
    });
    expect(within(table).getByText("Cloud Compute")).toBeInTheDocument();
    expect(within(table).queryByText("Endpoint Security")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search expenses"), {
      target: { value: "" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Amount" }));

    const firstDataRow = getDataRows()[0];
    expect(within(firstDataRow).getByText("Endpoint Security")).toBeInTheDocument();
  });

  it("completes create/edit/delete via form and confirm dialogs without prompt()", async () => {
    const promptSpy = vi.spyOn(window, "prompt").mockImplementation(() => null);

    renderExpensesPage();
    const table = getExpensesTable();
    fireEvent.click(screen.getByRole("button", { name: "Create Expense" }));

    fireEvent.change(screen.getByLabelText("Expense name"), {
      target: { value: "Support Plan" }
    });
    fireEvent.change(screen.getByLabelText("Expense amount minor units"), {
      target: { value: "5000" }
    });
    fireEvent.change(screen.getByLabelText("Expense service"), {
      target: { value: "VendorX" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => {
      expect(within(table).getByText("Support Plan")).toBeInTheDocument();
    });

    const createdRow = getDataRows().find((row) => within(row).queryByText("Support Plan"));
    expect(createdRow).toBeDefined();
    fireEvent.click(within(createdRow as HTMLElement).getByRole("button", { name: "Edit" }));

    const nameInputs = screen.getAllByLabelText("Expense name");
    fireEvent.change(nameInputs[nameInputs.length - 1], {
      target: { value: "Support Plan Plus" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(within(table).getByText("Support Plan Plus")).toBeInTheDocument();
    });

    const editedRow = getDataRows().find((row) =>
      within(row).queryByText("Support Plan Plus")
    );
    expect(editedRow).toBeDefined();
    fireEvent.click(within(editedRow as HTMLElement).getByRole("button", { name: "Delete" }));

    const confirmButtons = screen.getAllByRole("button", { name: "Delete" });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => {
      expect(within(table).queryByText("Support Plan Plus")).not.toBeInTheDocument();
    });
    expect(promptSpy).not.toHaveBeenCalled();
    promptSpy.mockRestore();
  });

  it("applies bulk tag assignment and refreshes detail chips for selected rows", async () => {
    renderExpensesPage();

    const cloudRow = getDataRows().find((row) => within(row).queryByText("Cloud Compute"));
    const endpointRow = getDataRows().find((row) =>
      within(row).queryByText("Endpoint Security")
    );
    expect(cloudRow).toBeDefined();
    expect(endpointRow).toBeDefined();

    fireEvent.click(within(cloudRow as HTMLElement).getByRole("checkbox"));
    fireEvent.click(within(endpointRow as HTMLElement).getByRole("checkbox"));

    fireEvent.change(screen.getByLabelText("Bulk tag dimension"), {
      target: { value: "dim-cost-center" }
    });
    fireEvent.change(screen.getByLabelText("Bulk tag value"), {
      target: { value: "tag-security" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Bulk tag entry" }));

    expect(
      await screen.findByText("Applied Security in Cost Center to 2 expense(s).")
    ).toBeInTheDocument();
    expect(screen.getByText("Security ×")).toBeInTheDocument();

    const refreshedRows = getDataRows();
    const refreshedEndpointRow = refreshedRows.find((row) =>
      within(row).queryByText("Endpoint Security")
    );
    expect(refreshedEndpointRow).toBeDefined();
    fireEvent.click(
      within(refreshedEndpointRow as HTMLElement).getByText("Endpoint Security")
    );
    expect(screen.getByText("Vendor: Microsoft")).toBeInTheDocument();
    expect(
      within(refreshedEndpointRow as HTMLElement).getByText(/security, Security/i)
    ).toBeInTheDocument();
    expect(screen.getByText("Security ×")).toBeInTheDocument();
  });
});
