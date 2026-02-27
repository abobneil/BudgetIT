export type CommandActionId =
  | "new-expense"
  | "run-import"
  | "open-alerts"
  | "backup-now"
  | "open-shortcuts";

export type CommandIntent =
  | {
      kind: "route";
      to: string;
    }
  | {
      kind: "action";
      actionId: CommandActionId;
    };

export type CommandEntry = {
  id: string;
  label: string;
  keywords: string[];
  shortcut?: string;
  intent: CommandIntent;
};

export const KEYBOARD_SHORTCUT_MAP = {
  openPalette: "Ctrl+K",
  focusGlobalSearch: "Ctrl+Shift+F",
  closeDialog: "Escape",
  executeCommand: "Enter",
  paletteNext: "ArrowDown",
  palettePrevious: "ArrowUp"
} as const;

export const COMMAND_REGISTRY: CommandEntry[] = [
  { id: "route-dashboard", label: "Go to Dashboard", keywords: ["home", "overview"], intent: { kind: "route", to: "/dashboard" } },
  { id: "route-expenses", label: "Go to Expenses", keywords: ["costs", "spend"], intent: { kind: "route", to: "/expenses" } },
  { id: "route-services", label: "Go to Services", keywords: ["lifecycle", "service"], intent: { kind: "route", to: "/services" } },
  { id: "route-contracts", label: "Go to Contracts", keywords: ["renewals", "notice"], intent: { kind: "route", to: "/contracts" } },
  { id: "route-vendors", label: "Go to Vendors", keywords: ["suppliers", "providers"], intent: { kind: "route", to: "/vendors" } },
  { id: "route-tags", label: "Go to Tags & Dimensions", keywords: ["dimensions", "taxonomy"], intent: { kind: "route", to: "/tags" } },
  { id: "route-scenarios", label: "Go to Scenarios", keywords: ["baseline", "forecast"], intent: { kind: "route", to: "/scenarios" } },
  { id: "route-alerts", label: "Go to Alerts", keywords: ["inbox", "notifications"], intent: { kind: "route", to: "/alerts" } },
  { id: "route-import", label: "Go to Import", keywords: ["csv", "xlsx", "wizard"], intent: { kind: "route", to: "/import" } },
  { id: "route-reports", label: "Go to Reports", keywords: ["exports", "dashboards"], intent: { kind: "route", to: "/reports" } },
  { id: "route-nlq", label: "Go to NLQ", keywords: ["natural language", "query"], intent: { kind: "route", to: "/nlq" } },
  { id: "route-settings", label: "Go to Settings", keywords: ["preferences", "configuration"], intent: { kind: "route", to: "/settings" } },
  {
    id: "action-new-expense",
    label: "New Expense",
    keywords: ["create", "expense", "add"],
    shortcut: "N",
    intent: { kind: "action", actionId: "new-expense" }
  },
  {
    id: "action-run-import",
    label: "Run Import",
    keywords: ["import", "wizard", "actuals"],
    intent: { kind: "action", actionId: "run-import" }
  },
  {
    id: "action-open-alerts",
    label: "Open Alerts Inbox",
    keywords: ["alerts", "inbox", "due"],
    intent: { kind: "action", actionId: "open-alerts" }
  },
  {
    id: "action-backup-now",
    label: "Backup Now",
    keywords: ["backup", "resilience", "create backup"],
    intent: { kind: "action", actionId: "backup-now" }
  },
  {
    id: "action-open-shortcuts",
    label: "Show Keyboard Shortcuts",
    keywords: ["help", "keyboard", "shortcuts"],
    intent: { kind: "action", actionId: "open-shortcuts" }
  }
];

export function resolvePaletteCommands(
  query: string,
  registry: CommandEntry[] = COMMAND_REGISTRY
): CommandEntry[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return registry;
  }

  return registry
    .map((command) => ({
      command,
      score: getMatchScore(command, normalized)
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.command);
}

function getMatchScore(command: CommandEntry, query: string): number {
  if (command.label.toLowerCase() === query) {
    return 100;
  }
  if (command.label.toLowerCase().startsWith(query)) {
    return 80;
  }
  if (command.label.toLowerCase().includes(query)) {
    return 60;
  }
  if (command.keywords.some((keyword) => keyword.toLowerCase().includes(query))) {
    return 40;
  }
  return 0;
}
