import React from "react";
import ReactDOM from "react-dom/client";
import { FluentProvider } from "@fluentui/react-components";
import { BrowserRouter } from "react-router-dom";

import { AppShell } from "./app/AppShell";
import { AppRoutes } from "./app/routes";
import { ScenarioProvider } from "./features/scenarios/ScenarioContext";
import { FeedbackProvider } from "./ui/feedback";
import "./App.css";
import { budgetItLightTheme } from "./ui/theme";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ScenarioProvider>
      <FluentProvider theme={budgetItLightTheme}>
        <FeedbackProvider>
          <BrowserRouter>
            <AppShell>
              <AppRoutes />
            </AppShell>
          </BrowserRouter>
        </FeedbackProvider>
      </FluentProvider>
    </ScenarioProvider>
  </React.StrictMode>
);

