import type { ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { AlertsPage } from "../features/alerts/AlertsPage";
import { ContractsPage } from "../features/contracts/ContractsPage";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { DeveloperToolsPage } from "../features/developer/DeveloperToolsPage";
import { ExpensesPage } from "../features/expenses/ExpensesPage";
import { ImportPage } from "../features/import/ImportPage";
import { NlqPage } from "../features/nlq/NlqPage";
import { ReportsPage } from "../features/reports/ReportsPage";
import { ScenariosPage } from "../features/scenarios/ScenariosPage";
import { ServicesPage } from "../features/services/ServicesPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { TagsPage } from "../features/tags/TagsPage";
import { VendorsPage } from "../features/vendors/VendorsPage";

export type AppRouteConfig = {
  key: string;
  path: string;
  label: string;
  nav: boolean;
  element: ReactElement;
};

export const APP_ROUTES: AppRouteConfig[] = [
  {
    key: "dashboard",
    path: "/dashboard",
    label: "Dashboard",
    nav: true,
    element: <DashboardPage />
  },
  {
    key: "expenses",
    path: "/expenses",
    label: "Expenses",
    nav: true,
    element: <ExpensesPage />
  },
  {
    key: "services",
    path: "/services",
    label: "Services",
    nav: true,
    element: <ServicesPage />
  },
  {
    key: "contracts",
    path: "/contracts",
    label: "Contracts",
    nav: true,
    element: <ContractsPage />
  },
  {
    key: "vendors",
    path: "/vendors",
    label: "Vendors",
    nav: true,
    element: <VendorsPage />
  },
  {
    key: "tags",
    path: "/tags",
    label: "Tags & Dimensions",
    nav: true,
    element: <TagsPage />
  },
  {
    key: "scenarios",
    path: "/scenarios",
    label: "Scenarios",
    nav: true,
    element: <ScenariosPage />
  },
  {
    key: "alerts",
    path: "/alerts",
    label: "Alerts",
    nav: true,
    element: <AlertsPage />
  },
  {
    key: "import",
    path: "/import",
    label: "Import",
    nav: true,
    element: <ImportPage />
  },
  {
    key: "reports",
    path: "/reports",
    label: "Reports",
    nav: true,
    element: <ReportsPage />
  },
  {
    key: "nlq",
    path: "/nlq",
    label: "NLQ",
    nav: true,
    element: <NlqPage />
  },
  {
    key: "settings",
    path: "/settings",
    label: "Settings",
    nav: true,
    element: <SettingsPage />
  },
  {
    key: "developer",
    path: "/developer",
    label: "Developer Tools",
    nav: false,
    element: <DeveloperToolsPage />
  }
];

export const NAV_ROUTES = APP_ROUTES.filter((route) => route.nav);

export function resolveRouteLabel(pathname: string): string {
  const directMatch = APP_ROUTES.find((route) => route.path === pathname);
  if (directMatch) {
    return directMatch.label;
  }

  const prefixMatch = APP_ROUTES.find(
    (route) => pathname.startsWith(`${route.path}/`)
  );
  return prefixMatch?.label ?? "BudgetIT";
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate replace to="/dashboard" />} />
      {APP_ROUTES.map((route) => (
        <Route key={route.key} path={route.path} element={route.element} />
      ))}
      <Route path="*" element={<Navigate replace to="/dashboard" />} />
    </Routes>
  );
}

