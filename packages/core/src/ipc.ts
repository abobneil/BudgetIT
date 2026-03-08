export const INVOKE_CHANNELS = [
  "settings.get",
  "settings.update",
  "help.open",
  "help.document.get",
  "dialog.pickFile",
  "dialog.pickDirectory",
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
  "notifications.endpoints.list",
  "import.preview",
  "import.commit",
  "import.templates.list",
  "import.templates.delete",
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

export type InvokeChannel = (typeof INVOKE_CHANNELS)[number];

const invokeChannelSet = new Set<string>(INVOKE_CHANNELS);

export function getAllowedInvokeChannels(): readonly InvokeChannel[] {
  return INVOKE_CHANNELS;
}

export function isAllowedInvokeChannel(value: string): value is InvokeChannel {
  return invokeChannelSet.has(value);
}

export function assertAllowedInvokeChannel(value: string): asserts value is InvokeChannel {
  if (!isAllowedInvokeChannel(value)) {
    throw new Error(`Unauthorized IPC channel: ${value}`);
  }
}

