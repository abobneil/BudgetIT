export {
  bootstrapEncryptedDatabase,
  generateDatabaseKeyHex,
  openEncryptedDatabase,
  rekeyEncryptedDatabase,
  type BootstrapEncryptedDatabaseResult
} from "./encrypted-db";

export { runMigrations, resolveDefaultMigrationsDir } from "./migrations";
export { updateExpenseLineAmountWithAudit, type UpdateExpenseAmountInput } from "./audit-service";
export * as schema from "./schema";

