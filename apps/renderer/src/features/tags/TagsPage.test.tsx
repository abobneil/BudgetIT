/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { FluentProvider } from "@fluentui/react-components";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  assignTag,
  isIpcAvailable,
  listDimensions,
  listExpenses,
  listTags
} from "../../lib/ipcClient";
import { budgetItLightTheme } from "../../ui/theme";
import { TagsPage } from "./TagsPage";

vi.mock("../../lib/ipcClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/ipcClient")>();
  return {
    ...actual,
    assignTag: vi.fn(),
    isIpcAvailable: vi.fn(),
    listDimensions: vi.fn(),
    listExpenses: vi.fn(),
    listTags: vi.fn()
  };
});

const isIpcAvailableMock = vi.mocked(isIpcAvailable);
const listDimensionsMock = vi.mocked(listDimensions);
const listTagsMock = vi.mocked(listTags);
const listExpensesMock = vi.mocked(listExpenses);
const assignTagMock = vi.mocked(assignTag);

function renderTagsPage() {
  return render(
    <FluentProvider theme={budgetItLightTheme}>
      <MemoryRouter>
        <TagsPage />
      </MemoryRouter>
    </FluentProvider>
  );
}

describe("TagsPage", () => {
  const tagRows = [
    {
      id: "tag-engineering",
      dimensionId: "dim-cost-center",
      name: "Engineering",
      parentTagId: null,
      createdAt: "2026-03-08T00:00:00.000Z",
      updatedAt: "2026-03-08T00:00:00.000Z",
      archivedAt: null
    },
    {
      id: "tag-security",
      dimensionId: "dim-cost-center",
      name: "Security",
      parentTagId: null,
      createdAt: "2026-03-08T00:00:00.000Z",
      updatedAt: "2026-03-08T00:00:00.000Z",
      archivedAt: null
    },
    {
      id: "tag-finance",
      dimensionId: "dim-cost-center",
      name: "Finance",
      parentTagId: null,
      createdAt: "2026-03-08T00:00:00.000Z",
      updatedAt: "2026-03-08T00:00:00.000Z",
      archivedAt: null
    }
  ];
  let assignments: Array<{
    id: string;
    entityType: string;
    entityId: string;
    dimensionId: string;
    tagId: string;
    createdAt: string;
  }>;

  beforeEach(() => {
    assignments = [];
    isIpcAvailableMock.mockReturnValue(true);
    listDimensionsMock.mockResolvedValue([
      {
        id: "dim-cost-center",
        name: "Cost Center",
        mode: "single_select",
        required: true,
        createdAt: "2026-03-08T00:00:00.000Z",
        updatedAt: "2026-03-08T00:00:00.000Z"
      }
    ]);
    listExpensesMock.mockResolvedValue([
      {
        id: "expense-endpoint",
        scenarioId: "baseline",
        serviceId: "svc-defender",
        contractId: "ctr-ms-sec",
        name: "Endpoint Security",
        expenseType: "recurring",
        status: "approved",
        amountMinor: 84000,
        currency: "USD",
        capexOpex: "opex",
        glAccountCode: null,
        costCenterCode: null,
        fundingSource: null,
        startDate: "2026-01-01",
        endDate: null,
        createdAt: "2026-03-08T00:00:00.000Z",
        updatedAt: "2026-03-08T00:00:00.000Z",
        deletedAt: null
      }
    ]);
    listTagsMock.mockImplementation(async () => ({
      tags: tagRows,
      assignments
    }));
    assignTagMock.mockImplementation(async (payload) => {
      const created = {
        id: `assign-${assignments.length + 1}`,
        entityType: payload.entityType,
        entityId: payload.entityId,
        dimensionId: payload.dimensionId,
        tagId: payload.tagId,
        createdAt: "2026-03-08T00:00:00.000Z"
      };
      assignments = [...assignments, created];
      return created;
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("completes an untagged queue item and increases completeness metric", async () => {
    renderTagsPage();

    expect(await screen.findByTestId("tag-completeness")).toHaveTextContent("0.0%");

    fireEvent.change(screen.getByLabelText("Queue tag expense-endpoint:dim-cost-center"), {
      target: { value: "tag-security" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Complete Queue Item" }));

    expect(await screen.findByText("Completed queue item for expense-endpoint.")).toBeInTheDocument();
    expect(screen.getByTestId("tag-completeness")).toHaveTextContent("100.0%");
  });
});
