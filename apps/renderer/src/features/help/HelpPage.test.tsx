/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { FluentProvider } from "@fluentui/react-components";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getHelpDocument } from "../../lib/ipcClient";
import { QUICK_START_CHECKLIST_STORAGE_KEY } from "../../lib/machineLocalState";
import { budgetItLightTheme } from "../../ui/theme";
import { HelpPage } from "./HelpPage";

vi.mock("../../lib/ipcClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/ipcClient")>();
  return {
    ...actual,
    getHelpDocument: vi.fn()
  };
});

const getHelpDocumentMock = vi.mocked(getHelpDocument);

const BASE_HELP_MARKDOWN = `
# BudgetIT Help System

## Quick Start (First Launch)
### First 10 minutes
- Open **Settings**
- Create backup

## 2) Dashboard
Dashboard content paragraph.

## 6) Vendors Workspace
Vendor setup guidance paragraph.
`.trim();

function renderHelp(path: string) {
  return render(
    <FluentProvider theme={budgetItLightTheme}>
      <MemoryRouter initialEntries={[path]}>
        <LocationProbe />
        <Routes>
          <Route path="/help" element={<HelpPage />} />
        </Routes>
      </MemoryRouter>
    </FluentProvider>
  );
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="current-location">{`${location.pathname}${location.search}`}</div>;
}

describe("HelpPage", () => {
  const scrollIntoViewMock = vi.fn();

  beforeEach(() => {
    getHelpDocumentMock.mockReset();
    scrollIntoViewMock.mockReset();
    window.localStorage.clear();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoViewMock
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders selected topic markdown content instead of raw markdown text", async () => {
    getHelpDocumentMock.mockResolvedValue({
      markdown: BASE_HELP_MARKDOWN,
      sourcePath: "docs/help-system.md"
    });

    const view = renderHelp("/help?topic=quick-start");

    expect(
      await screen.findByRole("heading", { name: "Quick Start (First Launch)" })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Help Center" })).toBeInTheDocument();
    expect(screen.getByLabelText("Selected help topic")).toBeInTheDocument();
    expect(view.container.querySelector(".help-page__header")).toBeInTheDocument();
    expect(screen.queryByLabelText("Filter help topics")).not.toBeInTheDocument();
    expect(screen.queryByText("Choose Help Topic")).not.toBeInTheDocument();
    expect(screen.queryByText(/^Guide section:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Source:/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "Use this first-run guide to learn the dual-window workflow and set up BudgetIT safely."
      )
    ).not.toBeInTheDocument();
    expect(
      screen.getByText((_content, element) => element?.textContent?.trim() === "Open Settings")
    ).toBeInTheDocument();
    const helpTopicContent = screen.getByTestId("help-topic-content");
    expect(helpTopicContent).toBeInTheDocument();
    expect(helpTopicContent.tagName).toBe("SECTION");
    expect(screen.queryByText("## Quick Start (First Launch)")).not.toBeInTheDocument();
    expect(view.container.querySelector(".help-page__prose")).not.toBeInTheDocument();
  });

  it("updates rendered section when the selected topic changes", async () => {
    getHelpDocumentMock.mockResolvedValue({
      markdown: BASE_HELP_MARKDOWN,
      sourcePath: "docs/help-system.md"
    });

    renderHelp("/help?topic=quick-start");
    await screen.findByRole("heading", { name: "Quick Start (First Launch)" });

    fireEvent.change(screen.getByLabelText("Selected help topic"), {
      target: { value: "dashboard-overview" }
    });

    expect(await screen.findByRole("heading", { name: "2) Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Dashboard content paragraph.")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Quick Start (First Launch)" })
    ).not.toBeInTheDocument();
  });

  it("falls back to the full document when section heading is missing", async () => {
    getHelpDocumentMock.mockResolvedValue({
      markdown: "# BudgetIT Help\n\n## Something Else\nFallback body.",
      sourcePath: "docs/help-system.md"
    });

    renderHelp("/help?topic=quick-start");

    expect(
      await screen.findByText(
        /Couldn't find "Quick Start \(First Launch\)" in the guide/
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Something Else" })).toBeInTheDocument();
    expect(screen.getByText("Fallback body.")).toBeInTheDocument();
  });

  it("shows an inline error when the document load fails", async () => {
    getHelpDocumentMock.mockRejectedValue(new Error("IPC unavailable"));

    renderHelp("/help?topic=quick-start");

    expect(
      await screen.findByText("Failed to load help document: IPC unavailable")
    ).toBeInTheDocument();
  });

  it("scrolls to requested anchor heading when anchor query is provided", async () => {
    getHelpDocumentMock.mockResolvedValue({
      markdown: BASE_HELP_MARKDOWN,
      sourcePath: "docs/help-system.md"
    });

    renderHelp("/help?topic=quick-start&anchor=first-10-minutes");
    await screen.findByRole("heading", { name: "Quick Start (First Launch)" });

    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalled();
    });
  });

  it("renders quick-start checklist and journey links", async () => {
    getHelpDocumentMock.mockResolvedValue({
      markdown: BASE_HELP_MARKDOWN,
      sourcePath: "docs/help-system.md"
    });

    renderHelp("/help?topic=quick-start");
    await screen.findByRole("heading", { name: "Quick Start (First Launch)" });

    expect(
      screen.getByRole("heading", { name: "First-Session Journey" })
    ).toBeInTheDocument();
    expect(screen.getByText("0/6 setup milestones complete")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Step 1: Vendors setup" })).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", {
        name: "Configure startup/tray/runtime settings in Settings."
      })
    ).toBeInTheDocument();
  });

  it("persists quick-start checklist completion in local storage", async () => {
    getHelpDocumentMock.mockResolvedValue({
      markdown: BASE_HELP_MARKDOWN,
      sourcePath: "docs/help-system.md"
    });

    const { unmount } = renderHelp("/help?topic=quick-start");
    const settingsCheckbox = await screen.findByRole("checkbox", {
      name: "Configure startup/tray/runtime settings in Settings."
    });

    fireEvent.click(settingsCheckbox);
    await waitFor(() => {
      expect(screen.getByText("1/6 setup milestones complete")).toBeInTheDocument();
    });

    expect(window.localStorage.getItem(QUICK_START_CHECKLIST_STORAGE_KEY)).toContain(
      '"configure-settings":true'
    );

    unmount();
    renderHelp("/help?topic=quick-start");
    expect(
      await screen.findByRole("checkbox", {
        name: "Configure startup/tray/runtime settings in Settings."
      })
    ).toBeChecked();
  });

  it("opens quick-start journey links by switching topic query", async () => {
    getHelpDocumentMock.mockResolvedValue({
      markdown: BASE_HELP_MARKDOWN,
      sourcePath: "docs/help-system.md"
    });

    renderHelp("/help?topic=quick-start");
    await screen.findByRole("heading", { name: "Quick Start (First Launch)" });

    fireEvent.click(screen.getByRole("button", { name: "Step 1: Vendors setup" }));

    expect(await screen.findByRole("heading", { name: "6) Vendors Workspace" })).toBeInTheDocument();
    expect(screen.getByText("Vendor setup guidance paragraph.")).toBeInTheDocument();
  });

  it("supports help search index jump results from generated topic metadata", async () => {
    getHelpDocumentMock.mockResolvedValue({
      markdown: BASE_HELP_MARKDOWN,
      sourcePath: "docs/help-system.md"
    });

    renderHelp("/help?topic=quick-start");
    await screen.findByRole("heading", { name: "Quick Start (First Launch)" });

    fireEvent.change(screen.getByLabelText("Search help index"), {
      target: { value: "dashboard" }
    });

    const jumpResults = screen.getByLabelText("Help jump results");
    fireEvent.click(within(jumpResults).getByRole("button", { name: /^Dashboard/ }));
    expect(await screen.findByRole("heading", { name: "2) Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Dashboard content paragraph.")).toBeInTheDocument();
  });

  it("seeds search input from q and shows source context when provided", async () => {
    getHelpDocumentMock.mockResolvedValue({
      markdown: BASE_HELP_MARKDOWN,
      sourcePath: "docs/help-system.md"
    });

    renderHelp("/help?topic=quick-start&q=dashboard&context=reports%3Aworkspace");
    await screen.findByRole("heading", { name: "Quick Start (First Launch)" });

    expect(screen.getByLabelText("Search help index")).toHaveValue("dashboard");
    expect(screen.getByText("Context: reports:workspace")).toBeInTheDocument();
    expect(screen.getByLabelText("Help jump results")).toBeInTheDocument();
  });

  it("clears seeded q when selecting a topic from dropdown", async () => {
    getHelpDocumentMock.mockResolvedValue({
      markdown: BASE_HELP_MARKDOWN,
      sourcePath: "docs/help-system.md"
    });

    renderHelp("/help?topic=quick-start&q=dashboard");
    await screen.findByRole("heading", { name: "Quick Start (First Launch)" });
    expect(screen.getByLabelText("Search help index")).toHaveValue("dashboard");

    fireEvent.change(screen.getByLabelText("Selected help topic"), {
      target: { value: "dashboard-overview" }
    });

    expect(await screen.findByRole("heading", { name: "2) Dashboard" })).toBeInTheDocument();
    expect(screen.getByLabelText("Search help index")).toHaveValue("");
  });

  it("applies a topic default anchor when selecting a form topic from the dropdown", async () => {
    getHelpDocumentMock.mockResolvedValue({
      markdown: `
# BudgetIT Help System

## Quick Start (First Launch)
### First 10 minutes
- Start here

## 3) Expenses Workspace
### Overview
Workspace body.

### Create/Edit Expense form
Form body.
      `.trim(),
      sourcePath: "docs/help-system.md"
    });

    renderHelp("/help?topic=quick-start");
    await screen.findByRole("heading", { name: "Quick Start (First Launch)" });

    fireEvent.change(screen.getByLabelText("Selected help topic"), {
      target: { value: "expenses-form" }
    });

    expect(await screen.findByRole("heading", { name: "3) Expenses Workspace" })).toBeInTheDocument();
    expect(screen.getByTestId("current-location")).toHaveTextContent(
      "/help?topic=expenses-form&anchor=createedit-expense-form"
    );
  });

  it("applies a topic default anchor when opening a jump result", async () => {
    getHelpDocumentMock.mockResolvedValue({
      markdown: `
# BudgetIT Help System

## Quick Start (First Launch)
### First 10 minutes
- Start here

## 3) Expenses Workspace
### Overview
Workspace body.

### Create/Edit Expense form
Form body.
      `.trim(),
      sourcePath: "docs/help-system.md"
    });

    renderHelp("/help?topic=quick-start");
    await screen.findByRole("heading", { name: "Quick Start (First Launch)" });

    fireEvent.change(screen.getByLabelText("Search help index"), {
      target: { value: "expense form" }
    });

    const jumpResults = screen.getByLabelText("Help jump results");
    fireEvent.click(within(jumpResults).getByRole("button", { name: /^Expense Form/ }));

    expect(await screen.findByRole("heading", { name: "3) Expenses Workspace" })).toBeInTheDocument();
    expect(screen.getByTestId("current-location")).toHaveTextContent(
      "/help?topic=expenses-form&anchor=createedit-expense-form"
    );
  });
});
