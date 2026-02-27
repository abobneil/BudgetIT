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
export {
  computeWeightedScore,
  createAttachmentReference,
  createServicePlan,
  getReplacementPlanDetail,
  listAttachmentReferences,
  setReplacementSelection,
  transitionServicePlan,
  upsertReplacementCandidate,
  type ReplacementCandidateDetail,
  type ReplacementPlanDetail,
  type ReplacementScorecardInput,
  type ServicePlanAction,
  type ServicePlanDecisionStatus,
  type ServicePlanReasonCode
} from "./replacement-planning";
export {
  buildDashboardDataset,
  type DashboardDataset,
  type GrowthRow,
  type NarrativeBlock,
  type RenewalRow,
  type ReplacementStatusSummary,
  type SpendTrendRow,
  type TaggingCompleteness
} from "./reporting";
export {
  compileFilterSpecToExpenseQuery,
  parseNlqToFilterSpec,
  queryExpensesByFilterSpec,
  type CompiledFilterQuery,
  type ExpenseFilterRow,
  type FilterSpec,
  type ParsedNlqResult
} from "./nlq";
export * as schema from "./schema";

