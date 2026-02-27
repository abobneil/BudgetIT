import type { PropsWithChildren } from "react";
import { NavLink, useLocation } from "react-router-dom";

import { NAV_ROUTES, resolveRouteLabel } from "./routes";
import "./AppShell.css";

export function AppShell({ children }: PropsWithChildren) {
  const location = useLocation();
  const pageTitle = resolveRouteLabel(location.pathname);

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
          <h1 className="desktop-shell__title" data-testid="page-title">
            {pageTitle}
          </h1>
          <select
            aria-label="Scenario selector"
            className="desktop-shell__toolbar-select"
            defaultValue="baseline"
          >
            <option value="baseline">Baseline</option>
            <option value="draft">Draft</option>
            <option value="approved">Approved</option>
          </select>
          <input
            aria-label="Global search"
            className="desktop-shell__toolbar-input"
            placeholder="Search (Ctrl+K)"
            type="search"
          />
          <button className="desktop-shell__toolbar-button" type="button">
            Create
          </button>
        </header>
        <main className="desktop-shell__page">{children}</main>
      </div>
    </div>
  );
}

