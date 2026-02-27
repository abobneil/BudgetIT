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
export * as schema from "./schema";

