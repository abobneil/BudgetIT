import React from "react";
import ReactDOM from "react-dom/client";
import { FluentProvider } from "@fluentui/react-components";
import { BrowserRouter } from "react-router-dom";

import { AppShell } from "./app/AppShell";
import { AppRoutes } from "./app/routes";
import "./App.css";
import { budgetItLightTheme } from "./ui/theme";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <FluentProvider theme={budgetItLightTheme}>
      <BrowserRouter>
        <AppShell>
          <AppRoutes />
        </AppShell>
      </BrowserRouter>
    </FluentProvider>
  </React.StrictMode>
);

