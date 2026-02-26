import { contextBridge, ipcRenderer } from "electron";

const allowedInvokeChannels = new Set<string>([
  "settings.get",
  "settings.update",
  "app.exit",
  "db.open",
  "db.rekey",
  "backup.create",
  "backup.restore",
  "backup.verify",
  "alerts.list",
  "alerts.ack",
  "alerts.snooze",
  "alerts.sendTest",
  "import.preview",
  "import.commit",
  "reports.query",
  "export.report",
  "nlq.parse"
]);

function assertAllowedInvokeChannel(channel: string): void {
  if (!allowedInvokeChannels.has(channel)) {
    throw new Error(`Unauthorized IPC channel: ${channel}`);
  }
}

export interface BudgetItBridge {
  invoke: (channel: string, payload?: unknown) => Promise<unknown>;
}

export function createBudgetItBridge(
  invokeImpl: (channel: string, payload?: unknown) => Promise<unknown>
): BudgetItBridge {
  return {
    invoke: async (channel, payload) => {
      assertAllowedInvokeChannel(channel);
      return invokeImpl(channel, payload);
    }
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
