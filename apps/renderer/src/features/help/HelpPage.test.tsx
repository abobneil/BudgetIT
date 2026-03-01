/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { FluentProvider } from "@fluentui/react-components";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getHelpDocument } from "../../lib/ipcClient";
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
`.trim();

function renderHelp(path: string) {
  return render(
    <FluentProvider theme={budgetItLightTheme}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/help" element={<HelpPage />} />
        </Routes>
      </MemoryRouter>
    </FluentProvider>
  );
}

describe("HelpPage", () => {
  const scrollIntoViewMock = vi.fn();

  beforeEach(() => {
    getHelpDocumentMock.mockReset();
    scrollIntoViewMock.mockReset();
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
});
