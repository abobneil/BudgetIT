export {
  bootstrapEncryptedDatabase,
  generateDatabaseKeyHex,
  openEncryptedDatabase,
  rekeyEncryptedDatabase,
  type BootstrapEncryptedDatabaseResult
} from "./encrypted-db";

export { runMigrations, resolveDefaultMigrationsDir } from "./migrations";
export { updateExpenseLineAmountWithAudit, type UpdateExpenseAmountInput } from "./audit-service";
export { BudgetCrudRepository, toUsdMinorUnits } from "./repositories";
export { materializeScenarioOccurrences, markForecastStale } from "./forecast-engine";
export { runAlertSchedulerTick } from "./alert-engine";
export {
  classifyBackupDestination,
  computeFileSha256,
  createEncryptedBackup,
  preflightBackupDestination,
  type BackupDestinationKind,
  type BackupManifest,
  type CreateEncryptedBackupInput,
  type CreateEncryptedBackupResult
} from "./backup";
export {
  acknowledgeAlertEvent,
  listActionableAlertEventsForNotification,
  listAlertEvents,
  markAlertEventNotified,
  snoozeAlertEvent,
  unsnoozeAlertEvent,
  type AlertEventRecord,
  type AlertEventStatus
} from "./alerts-repository";
export * as schema from "./schema";

