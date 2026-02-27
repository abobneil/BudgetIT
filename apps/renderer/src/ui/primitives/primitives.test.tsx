/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { FluentProvider } from "@fluentui/react-components";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { budgetItThemes } from "../theme";
import {
  EmptyState,
  EntityTable,
  InlineError,
  PageHeader,
  StatusChip
} from "./index";

afterEach(() => {
  cleanup();
});

describe("design primitives", () => {
  it("render under light, dark, and high-contrast themes", () => {
    for (const theme of Object.values(budgetItThemes)) {
      const { unmount } = render(
        <FluentProvider theme={theme}>
          <PageHeader title="Expenses" subtitle="Manage recurring costs" />
          <StatusChip label="Planned" tone="info" />
          <EntityTable
            columns={[
              { id: "name", header: "Name", renderCell: (row: { name: string }) => row.name },
              { id: "amount", header: "Amount", renderCell: (row: { amount: string }) => row.amount }
            ]}
            rows={[{ name: "SaaS License", amount: "$100.00" }]}
            getRowId={(row) => row.name}
          />
          <InlineError message="Unable to load expenses." />
          <EmptyState title="No alerts" description="You're all caught up." />
        </FluentProvider>
      );

      expect(screen.getByText("Expenses")).toBeInTheDocument();
      expect(screen.getByText("Planned")).toBeInTheDocument();
      expect(screen.getByText("SaaS License")).toBeInTheDocument();
      expect(screen.getByText("Unable to load expenses.")).toBeInTheDocument();
      expect(screen.getByText("No alerts")).toBeInTheDocument();
      expect(screen.getByText("You're all caught up.")).toBeInTheDocument();

      unmount();
    }
  });

  it("captures a stable primitive render snapshot", () => {
    const view = render(
      <FluentProvider theme={budgetItThemes.light}>
        <PageHeader title="Snapshot Header" subtitle="Primitive baseline" />
        <StatusChip label="Approved" tone="success" />
      </FluentProvider>
    );

    expect(view.container.firstChild).toMatchSnapshot();
  });
});
