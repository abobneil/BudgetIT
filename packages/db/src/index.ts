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
  readBackupManifest,
  restoreEncryptedBackup,
  verifyEncryptedBackup,
  type BackupDestinationKind,
  type BackupIntegrityResult,
  type BackupManifest,
  type CreateEncryptedBackupInput,
  type CreateEncryptedBackupResult,
  type RestoreEncryptedBackupInput,
  type RestoreEncryptedBackupResult
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
export {
  buildMonthlyVarianceDataset,
  ingestActualTransactions,
  listUnmatchedActualTransactions,
  type ActualIngestResult,
  type ActualTransactionInput,
  type MonthlyVarianceRow,
  type UnmatchedActualTransaction
} from "./variance";
export * as schema from "./schema";

