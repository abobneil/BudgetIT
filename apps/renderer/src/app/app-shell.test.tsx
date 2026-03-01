/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { FluentProvider } from "@fluentui/react-components";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { budgetItLightTheme } from "../ui/theme";
import { AppShell } from "./AppShell";
import { AppRoutes } from "./routes";

function renderAt(path: string) {
  return render(
    <FluentProvider theme={budgetItLightTheme}>
      <MemoryRouter initialEntries={[path]}>
        <AppShell>
          <AppRoutes />
        </AppShell>
      </MemoryRouter>
    </FluentProvider>
  );
}

describe("AppShell", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders primary nav and route outlet", () => {
    renderAt("/dashboard");

    expect(screen.getByLabelText("Primary navigation")).toBeInTheDocument();
    expect(screen.getByTestId("page-title")).toHaveTextContent("Dashboard");
    expect(screen.getByTestId("topbar-search-region")).toBeInTheDocument();
    expect(screen.getByTestId("topbar-actions-region")).toBeInTheDocument();
    expect(screen.getByLabelText("Global search")).toBeInTheDocument();
    expect(screen.getByLabelText("Scenario selector")).toBeInTheDocument();
    expect(screen.getByTestId("scenario-select-wrap")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Help" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Command Palette" })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create" })).not.toBeInTheDocument();
    expect(screen.getByText("Loading dashboard...")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Alerts" })).toBeInTheDocument();
  });

  it("updates page title when route changes", () => {
    renderAt("/dashboard");
    expect(screen.getByTestId("page-title")).toHaveTextContent("Dashboard");
    cleanup();
    renderAt("/alerts");

    expect(screen.getByTestId("page-title")).toHaveTextContent("Alerts");
    expect(
      screen.getByText("Actionable inbox for due, snoozed, and acknowledged alerts.")
    ).toBeInTheDocument();
  });

  it("hides navigation and topbar controls on the help route", async () => {
    renderAt("/help");

    expect(screen.queryByLabelText("Primary navigation")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Global search")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Command Palette" })
    ).not.toBeInTheDocument();
    expect(await screen.findByText("Help Center")).toBeInTheDocument();
  });
});
