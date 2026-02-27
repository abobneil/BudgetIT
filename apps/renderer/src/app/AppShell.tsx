import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PropsWithChildren } from "react";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Input,
  Select,
  Text
} from "@fluentui/react-components";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import { CONTRACT_RECORDS, SERVICE_RECORDS } from "../features/services/service-contract-data";
import { INITIAL_VENDOR_RECORDS } from "../features/vendors/vendor-data";
import { useScenarioContext } from "../features/scenarios/ScenarioContext";
import { createBackup } from "../lib/ipcClient";
import { useFeedback } from "../ui/feedback";
import {
  COMMAND_REGISTRY,
  KEYBOARD_SHORTCUT_MAP,
  resolvePaletteCommands,
  type CommandActionId,
  type CommandEntry
} from "./command-palette-model";
import { NAV_ROUTES, resolveRouteLabel } from "./routes";
import "./AppShell.css";

type GlobalSearchEntry = {
  id: string;
  label: string;
  route: string;
  keywords: string[];
};

const GLOBAL_SEARCH_ENTRIES: GlobalSearchEntry[] = [
  ...INITIAL_VENDOR_RECORDS.map((vendor) => ({
    id: `vendor-${vendor.id}`,
    label: `Vendor: ${vendor.name}`,
    route: `/vendors?vendor=${encodeURIComponent(vendor.id)}`,
    keywords: [vendor.name, "vendor"]
  })),
  ...SERVICE_RECORDS.map((service) => ({
    id: `service-${service.id}`,
    label: `Service: ${service.name}`,
    route: `/services?service=${encodeURIComponent(service.id)}`,
    keywords: [service.name, service.vendorName, "service"]
  })),
  ...CONTRACT_RECORDS.map((contract) => ({
    id: `contract-${contract.id}`,
    label: `Contract: ${contract.contractNumber}`,
    route: `/contracts?contract=${encodeURIComponent(contract.id)}`,
    keywords: [contract.contractNumber, contract.providerName, "contract"]
  })),
  {
    id: "expense-exp-1",
    label: "Expense: Cloud Compute",
    route: "/expenses?expense=exp-1",
    keywords: ["cloud", "expense"]
  },
  {
    id: "expense-exp-2",
    label: "Expense: Endpoint Security",
    route: "/expenses?expense=exp-2",
    keywords: ["security", "expense"]
  },
  {
    id: "expense-exp-3",
    label: "Expense: Analytics Suite",
    route: "/expenses?expense=exp-3",
    keywords: ["analytics", "expense"]
  }
];

function resolveGlobalSearchEntries(query: string): GlobalSearchEntry[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return GLOBAL_SEARCH_ENTRIES.slice(0, 10);
  }
  return GLOBAL_SEARCH_ENTRIES
    .filter(
      (entry) =>
        entry.label.toLowerCase().includes(normalized) ||
        entry.keywords.some((keyword) => keyword.toLowerCase().includes(normalized))
    )
    .slice(0, 10);
}

function findCommandByActionId(actionId: CommandActionId): CommandEntry | undefined {
  return COMMAND_REGISTRY.find(
    (entry) => entry.intent.kind === "action" && entry.intent.actionId === actionId
  );
}

export function AppShell({ children }: PropsWithChildren) {
  const location = useLocation();
  const navigate = useNavigate();
  const { notify } = useFeedback();
  const pageTitle = resolveRouteLabel(location.pathname);
  const { scenarios, selectedScenarioId, selectScenario } = useScenarioContext();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [keyboardHelpOpen, setKeyboardHelpOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [commandCursor, setCommandCursor] = useState(0);
  const [globalSearchValue, setGlobalSearchValue] = useState("");
  const [commandBusy, setCommandBusy] = useState(false);
  const paletteInputRef = useRef<HTMLInputElement | null>(null);
  const globalSearchRef = useRef<HTMLInputElement | null>(null);

  const paletteCommands = useMemo(
    () => resolvePaletteCommands(commandQuery),
    [commandQuery]
  );
  const globalSearchEntries = useMemo(
    () => resolveGlobalSearchEntries(globalSearchValue),
    [globalSearchValue]
  );

  useEffect(() => {
    if (!commandPaletteOpen) {
      return;
    }
    setCommandCursor(0);
    const timeout = window.setTimeout(() => {
      paletteInputRef.current?.focus();
    }, 0);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [commandPaletteOpen]);

  useEffect(() => {
    setCommandCursor(0);
  }, [commandQuery]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isMeta = event.ctrlKey || event.metaKey;
      if (isMeta && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        globalSearchRef.current?.focus();
        return;
      }
      if (event.key === "Escape") {
        if (commandPaletteOpen) {
          event.preventDefault();
          setCommandPaletteOpen(false);
        }
        if (keyboardHelpOpen) {
          event.preventDefault();
          setKeyboardHelpOpen(false);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [commandPaletteOpen, keyboardHelpOpen]);

  async function executeCommand(command: CommandEntry): Promise<void> {
    setCommandPaletteOpen(false);

    try {
      if (command.intent.kind === "route") {
        navigate(command.intent.to);
        notify({
          tone: "success",
          message: `Opened ${command.label.replace(/^Go to /, "")}.`
        });
        return;
      }

      setCommandBusy(true);
      switch (command.intent.actionId) {
        case "new-expense":
          navigate("/expenses?action=create");
          notify({ tone: "success", message: "Create Expense command executed." });
          break;
        case "run-import":
          navigate("/import");
          notify({ tone: "success", message: "Import workspace opened." });
          break;
        case "open-alerts":
          navigate("/alerts?tab=dueSoon");
          notify({ tone: "success", message: "Alerts inbox opened." });
          break;
        case "backup-now": {
          const created = await createBackup();
          notify({
            tone: "success",
            message: `Backup created: ${created.backupPath}`
          });
          break;
        }
        case "open-shortcuts":
          setKeyboardHelpOpen(true);
          notify({ tone: "info", message: "Keyboard shortcut help opened." });
          break;
        default:
          notify({ tone: "error", message: "Unknown command action." });
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      notify({ tone: "error", message: `Command failed: ${detail}` });
    } finally {
      setCommandBusy(false);
    }
  }

  function handlePaletteInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>): void {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCommandCursor((current) => Math.min(current + 1, paletteCommands.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setCommandCursor((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const selected = paletteCommands[commandCursor] ?? paletteCommands[0];
      if (selected) {
        void executeCommand(selected);
      }
    }
  }

  function handleGlobalSearchEnter(): void {
    const normalized = globalSearchValue.trim().toLowerCase();
    if (!normalized) {
      return;
    }
    const selected =
      globalSearchEntries.find((entry) => entry.label.toLowerCase() === normalized) ??
      globalSearchEntries[0];
    if (!selected) {
      notify({ tone: "error", message: "No matching entity was found." });
      return;
    }
    navigate(selected.route);
    notify({ tone: "success", message: `Opened ${selected.label}.` });
  }

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
            list="global-search-options"
            placeholder="Search entities (Ctrl+Shift+F)"
            ref={globalSearchRef}
            type="search"
            value={globalSearchValue}
            onChange={(_event, data) => setGlobalSearchValue(data.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleGlobalSearchEnter();
              }
            }}
          />
          <datalist id="global-search-options">
            {globalSearchEntries.map((entry) => (
              <option key={entry.id} value={entry.label} />
            ))}
          </datalist>
          <Button
            appearance="secondary"
            className="desktop-shell__toolbar-button"
            onClick={() => setCommandPaletteOpen(true)}
            type="button"
          >
            Command Palette
          </Button>
          <Button
            appearance="secondary"
            className="desktop-shell__toolbar-button"
            disabled={commandBusy}
            onClick={() => {
              const command = findCommandByActionId("new-expense");
              if (command) {
                void executeCommand(command);
              }
            }}
            type="button"
          >
            Create
          </Button>
        </header>
        <main className="desktop-shell__page">{children}</main>
      </div>

      <Dialog
        open={commandPaletteOpen}
        onOpenChange={(_event, data) => setCommandPaletteOpen(data.open)}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Command Palette</DialogTitle>
            <DialogContent>
              <Input
                aria-label="Command palette input"
                placeholder="Type a command..."
                ref={paletteInputRef}
                value={commandQuery}
                onChange={(_event, data) => setCommandQuery(data.value)}
                onKeyDown={handlePaletteInputKeyDown}
              />
              <ul
                className="desktop-shell__command-list"
                aria-label="Command results"
                role="listbox"
              >
                {paletteCommands.slice(0, 8).map((command, index) => (
                  <li key={command.id} role="option" aria-selected={index === commandCursor}>
                    <button
                      className={
                        index === commandCursor
                          ? "desktop-shell__command-row desktop-shell__command-row--active"
                          : "desktop-shell__command-row"
                      }
                      onClick={() => {
                        void executeCommand(command);
                      }}
                      type="button"
                    >
                      <span>{command.label}</span>
                      {command.shortcut ? (
                        <span className="desktop-shell__command-shortcut">{command.shortcut}</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
              <Text className="desktop-shell__command-hint">
                {`${KEYBOARD_SHORTCUT_MAP.palettePrevious}/${KEYBOARD_SHORTCUT_MAP.paletteNext} to navigate, ${KEYBOARD_SHORTCUT_MAP.executeCommand} to run.`}
              </Text>
            </DialogContent>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <Dialog
        open={keyboardHelpOpen}
        onOpenChange={(_event, data) => setKeyboardHelpOpen(data.open)}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Keyboard Map</DialogTitle>
            <DialogContent>
              <ul className="desktop-shell__keyboard-map">
                <li>{`${KEYBOARD_SHORTCUT_MAP.openPalette}: Open command palette`}</li>
                <li>{`${KEYBOARD_SHORTCUT_MAP.focusGlobalSearch}: Focus global search`}</li>
                <li>{`${KEYBOARD_SHORTCUT_MAP.closeDialog}: Close active dialog`}</li>
                <li>{`${KEYBOARD_SHORTCUT_MAP.executeCommand}: Execute selected command`}</li>
                <li>{`${KEYBOARD_SHORTCUT_MAP.palettePrevious}/${KEYBOARD_SHORTCUT_MAP.paletteNext}: Move through command list`}</li>
              </ul>
            </DialogContent>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
