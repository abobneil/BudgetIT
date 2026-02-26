const invokeChannels = [
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
] as const;

export type InvokeChannel = (typeof invokeChannels)[number];

const invokeChannelSet = new Set<string>(invokeChannels);

export function getAllowedInvokeChannels(): readonly InvokeChannel[] {
  return invokeChannels;
}

export function isAllowedInvokeChannel(value: string): value is InvokeChannel {
  return invokeChannelSet.has(value);
}

export function assertAllowedInvokeChannel(value: string): asserts value is InvokeChannel {
  if (!isAllowedInvokeChannel(value)) {
    throw new Error(`Unauthorized IPC channel: ${value}`);
  }
}

