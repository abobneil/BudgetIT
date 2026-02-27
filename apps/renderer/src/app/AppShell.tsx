import type { PropsWithChildren } from "react";
import { Button, Input, Select, Text } from "@fluentui/react-components";
import { NavLink, useLocation } from "react-router-dom";

import { useScenarioContext } from "../features/scenarios/ScenarioContext";
import { NAV_ROUTES, resolveRouteLabel } from "./routes";
import "./AppShell.css";

export function AppShell({ children }: PropsWithChildren) {
  const location = useLocation();
  const pageTitle = resolveRouteLabel(location.pathname);
  const { scenarios, selectedScenarioId, selectScenario } = useScenarioContext();

  return (
    <div className="desktop-shell">
      <aside className="desktop-shell__nav" aria-label="Primary navigation">
        <p className="desktop-shell__brand">BudgetIT</p>
        {NAV_ROUTES.map((route) => (
          <NavLink
            key={route.path}
            to={route.path}
            className={({ isActive }) =>
              isActive
                ? "desktop-shell__link desktop-shell__link--active"
                : "desktop-shell__link"
            }
          >
            {route.label}
          </NavLink>
        ))}
      </aside>
      <div className="desktop-shell__content">
        <header className="desktop-shell__topbar">
          <Text
            as="h1"
            className="desktop-shell__title"
            data-testid="page-title"
            weight="semibold"
            size={500}
          >
            {pageTitle}
          </Text>
          <Select
            aria-label="Scenario selector"
            className="desktop-shell__toolbar-select"
            value={selectedScenarioId}
            onChange={(event) => selectScenario(event.target.value)}
          >
            {scenarios.map((scenario) => (
              <option key={scenario.id} value={scenario.id}>
                {scenario.name}
              </option>
            ))}
          </Select>
          <Input
            aria-label="Global search"
            className="desktop-shell__toolbar-input"
            placeholder="Search (Ctrl+K)"
            type="search"
          />
          <Button appearance="secondary" className="desktop-shell__toolbar-button" type="button">
            Create
          </Button>
        </header>
        <main className="desktop-shell__page">{children}</main>
      </div>
    </div>
  );
}

