import React from "react";
import ReactDOM from "react-dom/client";
import { FluentProvider } from "@fluentui/react-components";
import { HashRouter } from "react-router-dom";

import { AppShell } from "./app/AppShell";
import { AppRoutes } from "./app/routes";
import { ScenarioProvider } from "./features/scenarios/ScenarioContext";
import { FeedbackProvider } from "./ui/feedback";
import "./App.css";
import { budgetItThemes } from "./ui/theme";

type ThemeName = keyof typeof budgetItThemes;

function resolveSystemTheme(): ThemeName {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "dark";
  }

  if (window.matchMedia("(forced-colors: active)").matches) {
    return "highContrast";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribeThemeChanges(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => undefined;
  }

  const colorSchemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const forcedColorsQuery = window.matchMedia("(forced-colors: active)");

  if (typeof colorSchemeQuery.addEventListener === "function") {
    colorSchemeQuery.addEventListener("change", onChange);
    forcedColorsQuery.addEventListener("change", onChange);
    return () => {
      colorSchemeQuery.removeEventListener("change", onChange);
      forcedColorsQuery.removeEventListener("change", onChange);
    };
  }

  colorSchemeQuery.addListener(onChange);
  forcedColorsQuery.addListener(onChange);
  return () => {
    colorSchemeQuery.removeListener(onChange);
    forcedColorsQuery.removeListener(onChange);
  };
}

function AppRoot() {
  const [themeName, setThemeName] = React.useState<ThemeName>(() => resolveSystemTheme());

  React.useEffect(() => {
    const updateTheme = () => {
      setThemeName(resolveSystemTheme());
    };
    updateTheme();
    return subscribeThemeChanges(updateTheme);
  }, []);

  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", themeName);
  }, [themeName]);

  return (
    <ScenarioProvider>
      <FluentProvider
        theme={budgetItThemes[themeName]}
        className={`budgetit-theme budgetit-theme--${themeName}`}
      >
        <FeedbackProvider>
          <HashRouter>
            <AppShell>
              <AppRoutes />
            </AppShell>
          </HashRouter>
        </FeedbackProvider>
      </FluentProvider>
    </ScenarioProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppRoot />
  </React.StrictMode>
);

