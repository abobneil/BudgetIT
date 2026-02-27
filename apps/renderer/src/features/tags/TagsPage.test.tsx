/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { FluentProvider } from "@fluentui/react-components";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { budgetItLightTheme } from "../../ui/theme";
import { TagsPage } from "./TagsPage";

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
  afterEach(() => {
    cleanup();
  });

  it("completes an untagged queue item and increases completeness metric", async () => {
    renderTagsPage();

    expect(screen.getByTestId("tag-completeness")).toHaveTextContent("66.7%");

    fireEvent.change(screen.getByLabelText("Queue tag expense-endpoint:dim-cost-center"), {
      target: { value: "tag-security" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Complete queue item" }));

    expect(await screen.findByText("Completed queue item for expense-endpoint.")).toBeInTheDocument();
    expect(screen.getByTestId("tag-completeness")).toHaveTextContent("100.0%");
  });
});
