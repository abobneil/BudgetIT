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

import { INITIAL_VENDOR_RECORDS } from "../features/vendors/vendor-data";
import { useScenarioContext } from "../features/scenarios/ScenarioContext";
import {
  createBackup,
  getSettings,
  isIpcAvailable,
  listContracts,
  listExpenses,
  listServices,
  listVendors,
  openHelpWindow
} from "../lib/ipcClient";
import {
  buildContractRoute,
  buildExpenseRoute,
  buildServiceRoute,
  buildVendorRoute
} from "./entity-routes";
import { reconcileMachineLocalStateAfterRestore } from "../lib/machineLocalState";
import { useFeedback } from "../ui/feedback";
import {
  KEYBOARD_SHORTCUT_MAP,
  resolvePaletteCommands,
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

type ContextHelpPayload = {
  topic: string;
  anchor?: string;
};

const FALLBACK_GLOBAL_SEARCH_ENTRIES: GlobalSearchEntry[] = [
  ...INITIAL_VENDOR_RECORDS.map((vendor) => ({
    id: `vendor-${vendor.id}`,
    label: `Vendor: ${vendor.name}`,
    route: buildVendorRoute(vendor.id),
    keywords: [vendor.name, "vendor"]
  }))
];

function filterGlobalSearchEntries(
  entries: GlobalSearchEntry[],
  query: string
): GlobalSearchEntry[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return entries.slice(0, 10);
  }
  return entries
    .filter(
      (entry) =>
        entry.label.toLowerCase().includes(normalized) ||
        entry.keywords.some((keyword) => keyword.toLowerCase().includes(normalized))
    )
    .slice(0, 10);
}

function resolveContextHelpPayload(pathname: string): ContextHelpPayload {
  if (pathname.startsWith("/dashboard")) {
    return { topic: "dashboard-overview", anchor: "variance-kpi" };
  }
  if (pathname.startsWith("/expenses")) {
    return { topic: "expenses-workspace", anchor: "overview" };
  }
  if (pathname.startsWith("/services")) {
    return { topic: "services-workspace", anchor: "overview" };
  }
  if (pathname.startsWith("/contracts")) {
    return { topic: "contracts-workspace", anchor: "overview" };
  }
  if (pathname.startsWith("/vendors")) {
    return { topic: "vendors-workspace", anchor: "overview" };
  }
  if (pathname.startsWith("/tags")) {
    return { topic: "tags-workspace", anchor: "overview" };
  }
  if (pathname.startsWith("/scenarios")) {
    return { topic: "scenarios-workspace", anchor: "overview" };
  }
  if (pathname.startsWith("/alerts")) {
    return { topic: "alerts-inbox", anchor: "overview" };
  }
  if (pathname.startsWith("/import")) {
    return { topic: "import-wizard", anchor: "5-steps" };
  }
  if (pathname.startsWith("/reports")) {
    return { topic: "reports-workspace", anchor: "export-orchestration" };
  }
  if (pathname.startsWith("/replacement")) {
    return { topic: "services-workspace", anchor: "detail-tabs" };
  }
  if (pathname.startsWith("/nlq")) {
    return { topic: "nlq-workspace", anchor: "overview" };
  }
  if (pathname.startsWith("/settings")) {
    return { topic: "settings-center", anchor: "runtime" };
  }
  if (pathname.startsWith("/developer")) {
    return { topic: "developer-tools", anchor: "overview" };
  }
  return { topic: "quick-start" };
}

export function AppShell({ children }: PropsWithChildren) {
  const location = useLocation();
  const navigate = useNavigate();
  const { notify } = useFeedback();
  const pageTitle = resolveRouteLabel(location.pathname);
  const isHelpRoute = location.pathname === "/help";
  const { scenarios, selectedScenarioId, selectScenario } = useScenarioContext();
  const hasIpc = isIpcAvailable();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [keyboardHelpOpen, setKeyboardHelpOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [commandCursor, setCommandCursor] = useState(0);
  const [globalSearchValue, setGlobalSearchValue] = useState("");
  const [globalSearchSource, setGlobalSearchSource] = useState<GlobalSearchEntry[]>(
    FALLBACK_GLOBAL_SEARCH_ENTRIES
  );
  const paletteInputRef = useRef<HTMLInputElement | null>(null);
  const globalSearchRef = useRef<HTMLInputElement | null>(null);

  const paletteCommands = useMemo(
    () => resolvePaletteCommands(commandQuery),
    [commandQuery]
  );
  const globalSearchEntries = useMemo(
    () => filterGlobalSearchEntries(globalSearchSource, globalSearchValue),
    [globalSearchSource, globalSearchValue]
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
    let cancelled = false;

    if (!hasIpc) {
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      try {
        const settings = await getSettings();
        if (!cancelled) {
          reconcileMachineLocalStateAfterRestore(settings.lastRestoreSummary ?? null);
        }
      } catch {
        // Ignore reconciliation failures so shell startup is not blocked by settings IPC.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasIpc]);

  useEffect(() => {
    let cancelled = false;

    if (!hasIpc) {
      setGlobalSearchSource(FALLBACK_GLOBAL_SEARCH_ENTRIES);
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      try {
        const [vendors, services, contracts, expenses] = await Promise.all([
          listVendors(),
          listServices(),
          listContracts(),
          listExpenses({ scenarioId: selectedScenarioId })
        ]);

        if (cancelled) {
          return;
        }

        const vendorById = new Map(vendors.map((vendor) => [vendor.id, vendor]));
        const serviceById = new Map(services.map((service) => [service.id, service]));
        const entries: GlobalSearchEntry[] = [
          ...vendors.map((vendor) => ({
            id: `vendor-${vendor.id}`,
            label: `Vendor: ${vendor.name}`,
            route: buildVendorRoute(vendor.id),
            keywords: [vendor.name, vendor.owner ?? "", vendor.status, "vendor"]
          })),
          ...services.map((service) => ({
            id: `service-${service.id}`,
            label: `Service: ${service.name}`,
            route: buildServiceRoute(service.id),
            keywords: [
              service.name,
              vendorById.get(service.vendorId)?.name ?? service.vendorId,
              service.ownerTeam ?? "",
              "service"
            ]
          })),
          ...contracts.map((contract) => {
            const service = serviceById.get(contract.serviceId);
            const vendorName = service
              ? vendorById.get(service.vendorId)?.name ?? service.vendorId
              : contract.serviceId;
            return {
              id: `contract-${contract.id}`,
              label: `Contract: ${contract.contractNumber ?? contract.id}`,
              route: buildContractRoute(contract.id),
              keywords: [contract.contractNumber ?? contract.id, vendorName, "contract"]
            };
          }),
          ...expenses.map((expense) => {
            const service = serviceById.get(expense.serviceId);
            const vendorName = service
              ? vendorById.get(service.vendorId)?.name ?? service.vendorId
              : expense.serviceId;
            return {
              id: `expense-${expense.id}`,
              label: `Expense: ${expense.name}`,
              route: buildExpenseRoute(expense.id, selectedScenarioId),
              keywords: [expense.name, vendorName, service?.name ?? expense.serviceId, "expense"]
            };
          })
        ];

        setGlobalSearchSource(entries);
      } catch {
        if (!cancelled) {
          setGlobalSearchSource([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasIpc, selectedScenarioId]);

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
      if (event.key === "F1") {
        event.preventDefault();
        void openHelpWindow(resolveContextHelpPayload(location.pathname));
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
  }, [commandPaletteOpen, keyboardHelpOpen, location.pathname]);

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
        case "open-context-help":
          await openHelpWindow(resolveContextHelpPayload(location.pathname));
          notify({ tone: "info", message: "Contextual help opened." });
          break;
        default:
          notify({ tone: "error", message: "Unknown command action." });
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      notify({ tone: "error", message: `Command failed: ${detail}` });
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
    <div
      className={
        isHelpRoute ? "desktop-shell desktop-shell--help" : "desktop-shell"
      }
    >
      {!isHelpRoute ? (
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
      ) : null}
      <div
        className={
          isHelpRoute
            ? "desktop-shell__content desktop-shell__content--help"
            : "desktop-shell__content"
        }
      >
        {!isHelpRoute ? (
          <header className="desktop-shell__topbar">
            <div className="desktop-shell__topbar-main">
              <Text
                as="h1"
                className="desktop-shell__title"
                data-testid="page-title"
                weight="semibold"
                size={500}
              >
                {pageTitle}
              </Text>
            </div>
            <div className="desktop-shell__topbar-search" data-testid="topbar-search-region">
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
            </div>
            <div className="desktop-shell__topbar-actions" data-testid="topbar-actions-region">
              <div className="desktop-shell__scenario-group">
                <Text as="span" className="desktop-shell__scenario-label" size={200}>
                  Scenario
                </Text>
                <div className="desktop-shell__scenario-select-wrap" data-testid="scenario-select-wrap">
                  <Select
                    aria-label="Scenario selector"
                    className="desktop-shell__scenario-select"
                    value={selectedScenarioId}
                    onChange={(event) => selectScenario(event.target.value)}
                  >
                    {scenarios.map((scenario) => (
                      <option key={scenario.id} value={scenario.id}>
                        {scenario.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <Button
                appearance="secondary"
                className="desktop-shell__toolbar-button"
                onClick={() => {
                  void openHelpWindow(resolveContextHelpPayload(location.pathname));
                }}
                type="button"
              >
                Help
              </Button>
            </div>
          </header>
        ) : null}
        <main
          className={
            isHelpRoute
              ? "desktop-shell__page desktop-shell__page--help"
              : "desktop-shell__page"
          }
        >
          {children}
        </main>
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
