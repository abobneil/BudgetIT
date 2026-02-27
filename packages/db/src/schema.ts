import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const meta = sqliteTable("meta", {
  id: integer("id").primaryKey(),
  databaseUuid: text("database_uuid").notNull(),
  schemaVersion: integer("schema_version").notNull(),
  lastMutationAt: text("last_mutation_at").notNull(),
  forecastStale: integer("forecast_stale"),
  forecastGeneratedAt: text("forecast_generated_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const vendor = sqliteTable("vendor", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  website: text("website"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  deletedAt: text("deleted_at")
});

export const service = sqliteTable("service", {
  id: text("id").primaryKey(),
  vendorId: text("vendor_id").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull(),
  ownerTeam: text("owner_team"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  deletedAt: text("deleted_at")
});

export const contract = sqliteTable("contract", {
  id: text("id").primaryKey(),
  serviceId: text("service_id").notNull(),
  contractNumber: text("contract_number"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  renewalType: text("renewal_type"),
  renewalDate: text("renewal_date"),
  noticePeriodDays: integer("notice_period_days"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  deletedAt: text("deleted_at")
});

export const expenseLine = sqliteTable("expense_line", {
  id: text("id").primaryKey(),
  scenarioId: text("scenario_id").notNull(),
  serviceId: text("service_id").notNull(),
  contractId: text("contract_id"),
  name: text("name").notNull(),
  expenseType: text("expense_type").notNull(),
  status: text("status").notNull(),
  amountMinor: integer("amount_minor").notNull(),
  currency: text("currency").notNull(),
  startDate: text("start_date"),
  endDate: text("end_date"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  deletedAt: text("deleted_at")
});

export const recurrenceRule = sqliteTable("recurrence_rule", {
  id: text("id").primaryKey(),
  expenseLineId: text("expense_line_id").notNull(),
  frequency: text("frequency").notNull(),
  interval: integer("interval").notNull(),
  dayOfMonth: integer("day_of_month"),
  monthOfYear: integer("month_of_year"),
  anchorDate: text("anchor_date"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const occurrence = sqliteTable("occurrence", {
  id: text("id").primaryKey(),
  scenarioId: text("scenario_id").notNull(),
  expenseLineId: text("expense_line_id").notNull(),
  occurrenceDate: text("occurrence_date").notNull(),
  amountMinor: integer("amount_minor").notNull(),
  currency: text("currency").notNull(),
  state: text("state").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const spendTransaction = sqliteTable("spend_transaction", {
  id: text("id").primaryKey(),
  scenarioId: text("scenario_id").notNull(),
  serviceId: text("service_id").notNull(),
  contractId: text("contract_id"),
  transactionDate: text("transaction_date").notNull(),
  amountMinor: integer("amount_minor").notNull(),
  currency: text("currency").notNull(),
  description: text("description"),
  matchedOccurrenceId: text("matched_occurrence_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const dimension = sqliteTable("dimension", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  mode: text("mode").notNull(),
  required: integer("required").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const tag = sqliteTable("tag", {
  id: text("id").primaryKey(),
  dimensionId: text("dimension_id").notNull(),
  name: text("name").notNull(),
  parentTagId: text("parent_tag_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  archivedAt: text("archived_at")
});

export const tagAssignment = sqliteTable("tag_assignment", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  dimensionId: text("dimension_id").notNull(),
  tagId: text("tag_id").notNull(),
  createdAt: text("created_at").notNull()
});

export const servicePlan = sqliteTable("service_plan", {
  id: text("id").primaryKey(),
  scenarioId: text("scenario_id").notNull(),
  serviceId: text("service_id").notNull(),
  plannedAction: text("planned_action").notNull(),
  decisionStatus: text("decision_status").notNull(),
  reasonCode: text("reason_code"),
  mustReplaceBy: text("must_replace_by"),
  replacementRequired: integer("replacement_required").notNull(),
  replacementSelectedServiceId: text("replacement_selected_service_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const replacementCandidate = sqliteTable("replacement_candidate", {
  id: text("id").primaryKey(),
  servicePlanId: text("service_plan_id").notNull(),
  candidateServiceId: text("candidate_service_id"),
  candidateName: text("candidate_name"),
  score: integer("score"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const alertRule = sqliteTable("alert_rule", {
  id: text("id").primaryKey(),
  scenarioId: text("scenario_id").notNull(),
  ruleType: text("rule_type").notNull(),
  paramsJson: text("params_json").notNull(),
  enabled: integer("enabled").notNull(),
  channels: text("channels").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const alertEvent = sqliteTable("alert_event", {
  id: text("id").primaryKey(),
  scenarioId: text("scenario_id").notNull(),
  alertRuleId: text("alert_rule_id").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  fireAt: text("fire_at").notNull(),
  firedAt: text("fired_at"),
  status: text("status").notNull(),
  dedupeKey: text("dedupe_key").notNull(),
  message: text("message").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  beforeJson: text("before_json"),
  afterJson: text("after_json"),
  createdAt: text("created_at").notNull()
});

export const attachment = sqliteTable("attachment", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  contentSha256: text("content_sha256"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});
