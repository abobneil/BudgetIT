import { contextBridge, ipcRenderer } from "electron";

const fallbackInvokeChannels = [
  "settings.get",
  "settings.update",
  "catalog.getStatus",
  "catalog.list",
  "catalog.sync",
  "help.open",
  "help.document.get",
  "dialog.pickFile",
  "dialog.pickDirectory",
  "app.exit",
  "db.open",
  "db.rekey",
  "db.reset",
  "backup.create",
  "backup.restore",
  "backup.verify",
  "alerts.list",
  "alerts.ack",
  "alerts.snooze",
  "alerts.sendTest",
  "notifications.endpoints.list",
  "import.preview",
  "import.commit",
  "import.templates.list",
  "import.templates.delete",
  "renewals.workbench.list",
  "renewals.decision.upsert",
  "replacement.plan.get",
  "replacement.plan.upsert",
  "replacement.plan.transition",
  "replacement.selection.set",
  "replacement.candidate.upsert",
  "reports.query",
  "report.preview",
  "export.report",
  "nlq.parse",
  "vendors.list",
  "vendors.create",
  "vendors.update",
  "vendors.delete",
  "services.list",
  "services.create",
  "services.update",
  "services.delete",
  "contracts.list",
  "contracts.create",
  "contracts.update",
  "contracts.delete",
  "expenses.list",
  "expenses.create",
  "expenses.update",
  "expenses.delete",
  "recurrences.list",
  "recurrences.create",
  "recurrences.update",
  "recurrences.delete",
  "dimensions.list",
  "dimensions.create",
  "dimensions.update",
  "dimensions.delete",
  "tags.list",
  "tags.create",
  "tags.update",
  "tags.archive",
  "tags.merge",
  "tags.assign",
  "tags.unassign",
  "scenarios.list",
  "scenarios.create",
  "scenarios.clone",
  "scenarios.delete",
  "scenarios.approve",
  "scenarios.lock",
  "scenarioSettings.get",
  "scenarioSettings.update",
  "costCenters.list",
  "costCenters.create",
  "costCenters.update",
  "costCenters.delete",
  "glAccounts.list",
  "glAccounts.create",
  "glAccounts.update",
  "glAccounts.delete",
  "actuals.unmatched.list",
  "actuals.unmatched.review",
  "actuals.unmatched.createExpense",
  "showback.generate",
  "showback.list",
  "showback.export",
  "approvals.list",
  "approvals.create",
  "audit.list"
] as const;

function resolveAllowedInvokeChannels(): readonly string[] {
  const merged = new Set<string>(fallbackInvokeChannels);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const core = require("@budgetit/core") as {
      getAllowedInvokeChannels?: () => readonly string[];
    };
    const channels = core.getAllowedInvokeChannels?.();
    if (channels && Array.isArray(channels) && channels.length > 0) {
      for (const channel of channels) {
        merged.add(channel);
      }
    }
  } catch {
    // Fall back to local allowlist when core package is unavailable in test/dev bootstrap.
  }
  return Array.from(merged);
}

const allowedInvokeChannels = new Set<string>(resolveAllowedInvokeChannels());

function assertAllowedInvokeChannel(channel: string): void {
  if (!allowedInvokeChannels.has(channel)) {
    throw new Error(`Unauthorized IPC channel: ${channel}`);
  }
}

export interface BudgetItBridge {
  invoke: (channel: string, payload?: unknown) => Promise<unknown>;
  onAlertNavigate: (listener: (payload: AlertNavigatePayload) => void) => () => void;
}

export type AlertNavigatePayload = {
  alertEventId: string;
  entityType: string;
  entityId: string;
};

export function createBudgetItBridge(
  invokeImpl: (channel: string, payload?: unknown) => Promise<unknown>,
  subscribeToAlertNavigate: (
    listener: (payload: AlertNavigatePayload) => void
  ) => () => void = (listener) => {
    const handler = (_event: unknown, payload: AlertNavigatePayload) => {
      listener(payload);
    };
    ipcRenderer.on("alerts.navigate", handler);
    return () => {
      ipcRenderer.off("alerts.navigate", handler);
    };
  }
): BudgetItBridge {
  return {
    invoke: async (channel, payload) => {
      assertAllowedInvokeChannel(channel);
      return invokeImpl(channel, payload);
    },
    onAlertNavigate: (listener) => subscribeToAlertNavigate(listener)
  };
}

const bridge = createBudgetItBridge((channel, payload) => ipcRenderer.invoke(channel, payload));
const processType = (process as NodeJS.Process & { type?: string }).type;
if (processType === "renderer") {
  contextBridge.exposeInMainWorld("budgetit", bridge);
}

declare global {
  interface Window {
    budgetit: BudgetItBridge;
  }
}
