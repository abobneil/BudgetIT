/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { FluentProvider } from "@fluentui/react-components";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  commitImport,
  deleteImportTemplate,
  isIpcAvailable,
  listImportTemplates,
  previewImport
} from "../../lib/ipcClient";
import { budgetItLightTheme } from "../../ui/theme";
import { ImportPage } from "./ImportPage";

vi.mock("../../lib/ipcClient", () => ({
  isIpcAvailable: vi.fn(),
  listImportTemplates: vi.fn(),
  deleteImportTemplate: vi.fn(),
  previewImport: vi.fn(),
  commitImport: vi.fn()
}));

const isIpcAvailableMock = vi.mocked(isIpcAvailable);
const listImportTemplatesMock = vi.mocked(listImportTemplates);
const deleteImportTemplateMock = vi.mocked(deleteImportTemplate);
const previewImportMock = vi.mocked(previewImport);
const commitImportMock = vi.mocked(commitImport);

function renderImportPage() {
  return render(
    <FluentProvider theme={budgetItLightTheme}>
      <MemoryRouter>
        <ImportPage />
      </MemoryRouter>
    </FluentProvider>
  );
}

describe("ImportPage", () => {
  beforeEach(() => {
    isIpcAvailableMock.mockReset();
    listImportTemplatesMock.mockReset();
    deleteImportTemplateMock.mockReset();
    previewImportMock.mockReset();
    commitImportMock.mockReset();
    isIpcAvailableMock.mockReturnValue(true);
    listImportTemplatesMock.mockResolvedValue({
      version: 2,
      templates: []
    });
    deleteImportTemplateMock.mockResolvedValue({
      ok: true,
      deleted: true,
      remaining: 0
    });
    previewImportMock.mockResolvedValue({
      totalRows: 6,
      acceptedCount: 4,
      rejectedCount: 1,
      duplicateCount: 1,
      templateApplied: "actuals-template",
      templateSaved: "actuals-template",
      errors: [
        {
          rowNumber: 3,
          code: "validation",
          field: "amount",
          message: "Amount is required"
        },
        {
          rowNumber: 5,
          code: "duplicate",
          field: "row",
          message: "Duplicate row fingerprint"
        }
      ]
    });
    commitImportMock.mockResolvedValue({
      totalRows: 6,
      acceptedCount: 4,
      rejectedCount: 1,
      duplicateCount: 1,
      insertedCount: 4,
      skippedDuplicateCount: 1,
      matchedCount: 3,
      unmatchedCount: 1,
      matchRate: 0.75,
      unmatchedForReview: [
        {
          id: "txn-1",
          transactionDate: "2026-02-10",
          amountMinor: 84000,
          description: "Unmapped purchase"
        }
      ],
      errors: []
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("sends preview and commit IPC payloads with selected template and options", async () => {
    renderImportPage();
    await waitFor(() => {
      expect(listImportTemplatesMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByLabelText("Import mode"), {
      target: { value: "actuals" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    fireEvent.change(screen.getByLabelText("Import file path"), {
      target: { value: "C:\\imports\\actuals.xlsx" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    fireEvent.change(screen.getByLabelText("Mapping template"), {
      target: { value: "actuals-template" }
    });
    fireEvent.click(screen.getByLabelText("Use saved template"));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    fireEvent.click(screen.getByRole("button", { name: "Run preview" }));
    await waitFor(() => {
      expect(previewImportMock).toHaveBeenCalledWith({
        mode: "actuals",
        filePath: "C:\\imports\\actuals.xlsx",
        templateName: "actuals-template",
        templatePack: undefined,
        useSavedTemplate: false,
        saveTemplate: true,
        requireFinanceMetadata: false
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Commit import" }));

    await waitFor(() => {
      expect(commitImportMock).toHaveBeenCalledWith({
        mode: "actuals",
        filePath: "C:\\imports\\actuals.xlsx",
        templateName: "actuals-template",
        templatePack: undefined,
        useSavedTemplate: false,
        saveTemplate: true,
        requireFinanceMetadata: false
      });
    });
  });

  it("runs full wizard and displays accepted/rejected/duplicate and unmatched queue counts", async () => {
    renderImportPage();

    fireEvent.change(screen.getByLabelText("Import mode"), {
      target: { value: "actuals" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.change(screen.getByLabelText("Import file path"), {
      target: { value: "C:\\imports\\sample.xlsx" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    fireEvent.click(screen.getByRole("button", { name: "Run preview" }));
    expect(await screen.findByText("Accepted: 4")).toBeInTheDocument();
    expect(screen.getByText("Rejected: 1")).toBeInTheDocument();
    expect(screen.getByText("Duplicates: 1")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Error filter"), {
      target: { value: "duplicate" }
    });
    expect(screen.getByText(/Duplicate row fingerprint/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Commit import" }));
    const commitSummary = await screen.findByTestId("import-commit-summary");
    expect(commitSummary).toHaveTextContent("Accepted: 4");
    expect(commitSummary).toHaveTextContent("Rejected: 1");
    expect(commitSummary).toHaveTextContent("Duplicates: 1");
    expect(commitSummary).toHaveTextContent("Matched: 3");
    expect(commitSummary).toHaveTextContent("Unmatched: 1");
    expect(screen.getByText(/2026-02-10/i)).toBeInTheDocument();
  });
});
