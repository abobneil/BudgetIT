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

export const scenario = sqliteTable("scenario", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  parentScenarioId: text("parent_scenario_id"),
  approvalStatus: text("approval_status").notNull(),
  isLocked: integer("is_locked").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const scenarioSettings = sqliteTable("scenario_settings", {
  scenarioId: text("scenario_id").primaryKey(),
  fiscalYearStartMonth: integer("fiscal_year_start_month").notNull(),
  horizonMonths: integer("horizon_months").notNull(),
  defaultCurrency: text("default_currency").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const vendor = sqliteTable("vendor", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  website: text("website"),
  notes: text("notes"),
  owner: text("owner"),
  ownerId: text("owner_id"),
  annualSpendMinor: integer("annual_spend_minor").notNull(),
  status: text("status").notNull(),
  risk: text("risk").notNull(),
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
  ownerId: text("owner_id"),
  annualSpendMinor: integer("annual_spend_minor").notNull(),
  risk: text("risk").notNull(),
  replacementStatus: text("replacement_status").notNull(),
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
  owner: text("owner"),
  ownerId: text("owner_id"),
  lifecycleStatus: text("lifecycle_status").notNull(),
  renewalAction: text("renewal_action").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  deletedAt: text("deleted_at")
});

export const ownerDirectory = sqliteTable("owner_directory", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  normalizedName: text("normalized_name").notNull(),
  archivedAt: text("archived_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
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
  capexOpex: text("capex_opex"),
  glAccountCode: text("gl_account_code"),
  costCenterCode: text("cost_center_code"),
  fundingSource: text("funding_source"),
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
  scorecardJson: text("scorecard_json"),
  annualCostMinor: integer("annual_cost_minor").notNull(),
  currency: text("currency").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const capability = sqliteTable("capability", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category"),
  description: text("description"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const capabilityAssignment = sqliteTable("capability_assignment", {
  id: text("id").primaryKey(),
  capabilityId: text("capability_id").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const servicePlanSourceItem = sqliteTable("service_plan_source_item", {
  id: text("id").primaryKey(),
  servicePlanId: text("service_plan_id").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const renewalDecision = sqliteTable("renewal_decision", {
  id: text("id").primaryKey(),
  scenarioId: text("scenario_id").notNull(),
  serviceId: text("service_id").notNull(),
  contractId: text("contract_id"),
  action: text("action").notNull(),
  effectiveDate: text("effective_date").notNull(),
  currentAmountMinor: integer("current_amount_minor").notNull(),
  expectedAmountMinor: integer("expected_amount_minor").notNull(),
  recurringSavingsMinor: integer("recurring_savings_minor").notNull(),
  avoidedFutureCostMinor: integer("avoided_future_cost_minor").notNull(),
  oneTimeCostMinor: integer("one_time_cost_minor").notNull(),
  savingsCategory: text("savings_category"),
  savingsRationale: text("savings_rationale"),
  currency: text("currency").notNull(),
  notes: text("notes"),
  assumptions: text("assumptions"),
  sourceSnapshotJson: text("source_snapshot_json").notNull(),
  materializedExpenseLineId: text("materialized_expense_line_id"),
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
  snoozedUntil: text("snoozed_until"),
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

export const costCenter = sqliteTable("cost_center", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  active: integer("active").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const glAccount = sqliteTable("gl_account", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  active: integer("active").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const approvalRecord = sqliteTable("approval_record", {
  id: text("id").primaryKey(),
  scenarioId: text("scenario_id"),
  servicePlanId: text("service_plan_id"),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(),
  actor: text("actor").notNull(),
  comment: text("comment"),
  createdAt: text("created_at").notNull()
});

export const unmatchedActualReview = sqliteTable("unmatched_actual_review", {
  id: text("id").primaryKey(),
  transactionId: text("transaction_id").notNull(),
  scenarioId: text("scenario_id").notNull(),
  disposition: text("disposition").notNull(),
  driverTag: text("driver_tag"),
  matchedOccurrenceId: text("matched_occurrence_id"),
  createdExpenseLineId: text("created_expense_line_id"),
  reviewer: text("reviewer").notNull(),
  comment: text("comment"),
  reviewedAt: text("reviewed_at").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const showbackStatement = sqliteTable("showback_statement", {
  id: text("id").primaryKey(),
  scenarioId: text("scenario_id").notNull(),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  groupBy: text("group_by").notNull(),
  generatedAt: text("generated_at").notNull(),
  generatedBy: text("generated_by").notNull(),
  totalMinor: integer("total_minor").notNull(),
  currency: text("currency").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const showbackLine = sqliteTable("showback_line", {
  id: text("id").primaryKey(),
  statementId: text("statement_id").notNull(),
  costCenterCode: text("cost_center_code"),
  ownerTeam: text("owner_team"),
  serviceId: text("service_id"),
  expenseLineId: text("expense_line_id"),
  amountMinor: integer("amount_minor").notNull(),
  currency: text("currency").notNull(),
  detailsJson: text("details_json"),
  createdAt: text("created_at").notNull()
});

export const notificationEndpoint = sqliteTable("notification_endpoint", {
  id: text("id").primaryKey(),
  endpointType: text("endpoint_type").notNull(),
  endpointUrl: text("endpoint_url").notNull(),
  enabled: integer("enabled").notNull(),
  lastTestResult: text("last_test_result"),
  lastTestAt: text("last_test_at"),
  lastFailureReason: text("last_failure_reason"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});
