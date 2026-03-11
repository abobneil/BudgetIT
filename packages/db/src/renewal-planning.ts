import crypto from "node:crypto";

import type Database from "better-sqlite3-multiple-ciphers";

import { BudgetCrudRepository } from "./repositories";
import type { RenewalSavingsCategory } from "./savings-attribution";

export type RenewalDecisionAction =
  | "renew"
  | "renegotiate"
  | "replace"
  | "retire"
  | "do_not_renew"
  | "defer";

const RENEWAL_SAVINGS_CATEGORIES = new Set<RenewalSavingsCategory>([
  "retirement",
  "non_renewal",
  "replacement",
  "consolidation",
  "renegotiation",
  "other"
]);

export type RenewalDecisionRecord = {
  id: string;
  scenarioId: string;
  serviceId: string;
  contractId: string | null;
  action: RenewalDecisionAction;
  effectiveDate: string;
  currentAmountMinor: number;
  expectedAmountMinor: number;
  recurringSavingsMinor: number;
  avoidedFutureCostMinor: number;
  oneTimeCostMinor: number;
  savingsCategory: RenewalSavingsCategory | null;
  savingsRationale: string | null;
  currency: string;
  notes: string | null;
  assumptions: string | null;
  materializedExpenseLineId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RenewalWorkbenchItem = {
  scenarioId: string;
  serviceId: string;
  serviceName: string;
  serviceStatus: string;
  vendorName: string;
  contractId: string | null;
  contractNumber: string | null;
  renewalDate: string | null;
  noticeDeadline: string | null;
  lifecycleStatus: string;
  noticePeriodDays: number | null;
  currentAmountMinor: number;
  currency: string;
  decision: RenewalDecisionRecord | null;
};

type SourceExpenseSnapshot = Array<{
  expenseLineId: string;
  originalEndDate: string | null;
}>;

export function defaultSavingsCategoryForAction(
  action: RenewalDecisionAction
): RenewalSavingsCategory {
  if (action === "retire") {
    return "retirement";
  }
  if (action === "do_not_renew") {
    return "non_renewal";
  }
  if (action === "replace") {
    return "replacement";
  }
  if (action === "renegotiate") {
    return "renegotiation";
  }
  return "other";
}

export function computeRenewalSavingsBreakdown(input: {
  action: RenewalDecisionAction;
  currentAmountMinor: number;
  expectedAmountMinor: number;
  oneTimeCostMinor?: number;
}): {
  recurringSavingsMinor: number;
  avoidedFutureCostMinor: number;
  oneTimeCostMinor: number;
} {
  const currentAmountMinor = Math.max(0, input.currentAmountMinor);
  const expectedAmountMinor = Math.max(0, input.expectedAmountMinor);
  const oneTimeCostMinor = Math.max(0, input.oneTimeCostMinor ?? 0);

  if (input.action === "retire" || input.action === "do_not_renew") {
    return {
      recurringSavingsMinor: 0,
      avoidedFutureCostMinor: currentAmountMinor,
      oneTimeCostMinor
    };
  }

  return {
    recurringSavingsMinor: Math.max(0, currentAmountMinor - expectedAmountMinor),
    avoidedFutureCostMinor: 0,
    oneTimeCostMinor
  };
}

type ExpenseTemplate = {
  id: string;
  scenarioId: string;
  serviceId: string;
  contractId: string | null;
  name: string;
  expenseType: "recurring" | "one_time";
  status: "planned" | "approved" | "committed" | "actual" | "cancelled";
  amountMinor: number;
  currency: string;
  capexOpex: "capex" | "opex" | null;
  glAccountCode: string | null;
  costCenterCode: string | null;
  fundingSource: string | null;
  startDate: string | null;
  endDate: string | null;
  recurrence: null | {
    id: string;
    frequency: "monthly" | "quarterly" | "yearly";
    interval: number;
    dayOfMonth: number;
    monthOfYear: number | null;
    anchorDate: string | null;
  };
};

function parseIsoDate(value: string): Date {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ISO date: ${value}`);
  }
  return parsed;
}

function subtractOneDay(value: string): string {
  const date = parseIsoDate(value);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function toNoticeDeadline(renewalDate: string | null, noticePeriodDays: number | null): string | null {
  if (!renewalDate || noticePeriodDays === null) {
    return null;
  }
  const renewal = parseIsoDate(renewalDate);
  renewal.setUTCDate(renewal.getUTCDate() - noticePeriodDays);
  return renewal.toISOString().slice(0, 10);
}

function parseSourceSnapshot(value: string | null): SourceExpenseSnapshot {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value) as SourceExpenseSnapshot;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadDecision(
  db: Database.Database,
  scenarioId: string,
  serviceId: string,
  contractId: string | null
): (RenewalDecisionRecord & { sourceSnapshotJson: string }) | null {
  const row = db
    .prepare(
      `
        SELECT
          id,
          scenario_id AS scenarioId,
          service_id AS serviceId,
          contract_id AS contractId,
          action,
          effective_date AS effectiveDate,
          current_amount_minor AS currentAmountMinor,
          expected_amount_minor AS expectedAmountMinor,
          recurring_savings_minor AS recurringSavingsMinor,
          avoided_future_cost_minor AS avoidedFutureCostMinor,
          one_time_cost_minor AS oneTimeCostMinor,
          savings_category AS savingsCategory,
          savings_rationale AS savingsRationale,
          currency,
          notes,
          assumptions,
          source_snapshot_json AS sourceSnapshotJson,
          materialized_expense_line_id AS materializedExpenseLineId,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM renewal_decision
        WHERE scenario_id = ?
          AND service_id = ?
          AND ifnull(contract_id, '') = ifnull(?, '')
      `
    )
    .get(scenarioId, serviceId, contractId) as (RenewalDecisionRecord & {
    sourceSnapshotJson: string;
  }) | undefined;
  return row ?? null;
}

function listSourceExpenses(
  db: Database.Database,
  scenarioId: string,
  serviceId: string,
  contractId: string | null
): ExpenseTemplate[] {
  const rows = db
    .prepare(
      `
        SELECT
          e.id,
          e.scenario_id AS scenarioId,
          e.service_id AS serviceId,
          e.contract_id AS contractId,
          e.name,
          e.expense_type AS expenseType,
          e.status,
          e.amount_minor AS amountMinor,
          e.currency,
          e.capex_opex AS capexOpex,
          e.gl_account_code AS glAccountCode,
          e.cost_center_code AS costCenterCode,
          e.funding_source AS fundingSource,
          e.start_date AS startDate,
          e.end_date AS endDate,
          r.id AS recurrenceId,
          r.frequency,
          r.interval,
          r.day_of_month AS dayOfMonth,
          r.month_of_year AS monthOfYear,
          r.anchor_date AS anchorDate
        FROM expense_line e
        LEFT JOIN recurrence_rule r ON r.expense_line_id = e.id
        WHERE e.scenario_id = ?
          AND e.service_id = ?
          AND (? IS NULL OR e.contract_id = ?)
          AND e.deleted_at IS NULL
          AND e.status <> 'cancelled'
        ORDER BY e.created_at
      `
    )
    .all(scenarioId, serviceId, contractId, contractId) as Array<
    Omit<ExpenseTemplate, "recurrence"> & {
      id: string;
      recurrenceId: string | null;
      frequency: "monthly" | "quarterly" | "yearly" | null;
      interval: number | null;
      dayOfMonth: number | null;
      monthOfYear: number | null;
      anchorDate: string | null;
    }
  >;

  return rows.map((row) => ({
    id: row.id,
    scenarioId: row.scenarioId,
    serviceId: row.serviceId,
    contractId: row.contractId,
    name: row.name,
    expenseType: row.expenseType,
    status: row.status,
    amountMinor: row.amountMinor,
    currency: row.currency,
    capexOpex: row.capexOpex,
    glAccountCode: row.glAccountCode,
    costCenterCode: row.costCenterCode,
    fundingSource: row.fundingSource,
    startDate: row.startDate,
    endDate: row.endDate,
    recurrence:
      row.recurrenceId && row.frequency && row.interval && row.dayOfMonth
        ? {
            id: row.recurrenceId,
            frequency: row.frequency,
            interval: row.interval,
            dayOfMonth: row.dayOfMonth,
            monthOfYear: row.monthOfYear,
            anchorDate: row.anchorDate
          }
        : null
  }));
}

function toDecisionRecord(
  row: RenewalDecisionRecord & { sourceSnapshotJson?: string }
): RenewalDecisionRecord {
  return {
    id: row.id,
    scenarioId: row.scenarioId,
    serviceId: row.serviceId,
    contractId: row.contractId,
    action: row.action,
    effectiveDate: row.effectiveDate,
    currentAmountMinor: row.currentAmountMinor,
    expectedAmountMinor: row.expectedAmountMinor,
    recurringSavingsMinor: row.recurringSavingsMinor,
    avoidedFutureCostMinor: row.avoidedFutureCostMinor,
    oneTimeCostMinor: row.oneTimeCostMinor,
    savingsCategory: row.savingsCategory ?? null,
    savingsRationale: row.savingsRationale ?? null,
    currency: row.currency,
    notes: row.notes,
    assumptions: row.assumptions,
    materializedExpenseLineId: row.materializedExpenseLineId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export function listRenewalWorkbenchItems(
  db: Database.Database,
  scenarioId: string
): RenewalWorkbenchItem[] {
  const rows = db
    .prepare(
      `
        SELECT
          s.id AS serviceId,
          s.name AS serviceName,
          s.status AS serviceStatus,
          v.name AS vendorName,
          c.id AS contractId,
          c.contract_number AS contractNumber,
          c.renewal_date AS renewalDate,
          c.notice_period_days AS noticePeriodDays,
          c.lifecycle_status AS lifecycleStatus,
          COALESCE(SUM(e.amount_minor), 0) AS currentAmountMinor,
          COALESCE(MAX(e.currency), 'USD') AS currency,
          d.id AS decisionId,
          d.action AS decisionAction,
          d.effective_date AS decisionEffectiveDate,
          d.current_amount_minor AS decisionCurrentAmountMinor,
          d.expected_amount_minor AS decisionExpectedAmountMinor,
          d.recurring_savings_minor AS decisionRecurringSavingsMinor,
          d.avoided_future_cost_minor AS decisionAvoidedFutureCostMinor,
          d.one_time_cost_minor AS decisionOneTimeCostMinor,
          d.savings_category AS decisionSavingsCategory,
          d.savings_rationale AS decisionSavingsRationale,
          d.currency AS decisionCurrency,
          d.notes AS decisionNotes,
          d.assumptions AS decisionAssumptions,
          d.materialized_expense_line_id AS decisionMaterializedExpenseLineId,
          d.created_at AS decisionCreatedAt,
          d.updated_at AS decisionUpdatedAt
        FROM contract c
        JOIN service s ON s.id = c.service_id
        JOIN vendor v ON v.id = s.vendor_id
        LEFT JOIN expense_line e
          ON e.scenario_id = ?
         AND e.service_id = s.id
         AND (e.contract_id = c.id OR c.id IS NULL)
         AND e.deleted_at IS NULL
         AND e.status <> 'cancelled'
         AND NOT EXISTS (
           SELECT 1
           FROM renewal_decision rd_exclude
           WHERE rd_exclude.scenario_id = e.scenario_id
             AND rd_exclude.materialized_expense_line_id = e.id
         )
        LEFT JOIN renewal_decision d
          ON d.scenario_id = ?
         AND d.service_id = s.id
         AND ifnull(d.contract_id, '') = ifnull(c.id, '')
        WHERE c.deleted_at IS NULL
          AND s.deleted_at IS NULL
          AND v.deleted_at IS NULL
        GROUP BY
          s.id,
          s.name,
          s.status,
          v.name,
          c.id,
          c.contract_number,
          c.renewal_date,
          c.notice_period_days,
          c.lifecycle_status,
          d.id,
          d.action,
          d.effective_date,
          d.expected_amount_minor,
          d.currency,
          d.notes,
          d.assumptions,
          d.materialized_expense_line_id,
          d.created_at,
          d.updated_at
        ORDER BY COALESCE(c.renewal_date, c.end_date, c.created_at), s.name
      `
    )
    .all(scenarioId, scenarioId) as Array<{
    serviceId: string;
    serviceName: string;
    serviceStatus: string;
    vendorName: string;
    contractId: string | null;
    contractNumber: string | null;
    renewalDate: string | null;
    noticePeriodDays: number | null;
    lifecycleStatus: string;
    currentAmountMinor: number | null;
    currency: string | null;
    decisionId: string | null;
    decisionAction: RenewalDecisionAction | null;
    decisionEffectiveDate: string | null;
    decisionCurrentAmountMinor: number | null;
    decisionExpectedAmountMinor: number | null;
    decisionRecurringSavingsMinor: number | null;
    decisionAvoidedFutureCostMinor: number | null;
    decisionOneTimeCostMinor: number | null;
    decisionSavingsCategory: RenewalSavingsCategory | null;
    decisionSavingsRationale: string | null;
    decisionCurrency: string | null;
    decisionNotes: string | null;
    decisionAssumptions: string | null;
    decisionMaterializedExpenseLineId: string | null;
    decisionCreatedAt: string | null;
    decisionUpdatedAt: string | null;
  }>;

  return rows.map((row) => ({
    scenarioId,
    serviceId: row.serviceId,
    serviceName: row.serviceName,
    serviceStatus: row.serviceStatus,
    vendorName: row.vendorName,
    contractId: row.contractId,
    contractNumber: row.contractNumber,
    renewalDate: row.renewalDate,
    noticeDeadline: toNoticeDeadline(row.renewalDate, row.noticePeriodDays),
    lifecycleStatus: row.lifecycleStatus,
    noticePeriodDays: row.noticePeriodDays,
    currentAmountMinor: row.currentAmountMinor ?? 0,
    currency: row.currency ?? "USD",
    decision: row.decisionId
      ? {
          id: row.decisionId,
          scenarioId,
          serviceId: row.serviceId,
          contractId: row.contractId,
          action: row.decisionAction ?? "renew",
          effectiveDate: row.decisionEffectiveDate ?? row.renewalDate ?? "",
          currentAmountMinor: row.decisionCurrentAmountMinor ?? row.currentAmountMinor ?? 0,
          expectedAmountMinor: row.decisionExpectedAmountMinor ?? 0,
          recurringSavingsMinor: row.decisionRecurringSavingsMinor ?? 0,
          avoidedFutureCostMinor: row.decisionAvoidedFutureCostMinor ?? 0,
          oneTimeCostMinor: row.decisionOneTimeCostMinor ?? 0,
          savingsCategory: row.decisionSavingsCategory ?? null,
          savingsRationale: row.decisionSavingsRationale,
          currency: row.decisionCurrency ?? row.currency ?? "USD",
          notes: row.decisionNotes,
          assumptions: row.decisionAssumptions,
          materializedExpenseLineId: row.decisionMaterializedExpenseLineId,
          createdAt: row.decisionCreatedAt ?? "",
          updatedAt: row.decisionUpdatedAt ?? ""
        }
      : null
  }));
}

function restorePriorDecisionArtifacts(
  repo: BudgetCrudRepository,
  db: Database.Database,
  decision: ReturnType<typeof loadDecision>
): void {
  if (!decision) {
    return;
  }

  for (const snapshot of parseSourceSnapshot(decision.sourceSnapshotJson)) {
    const row = db
      .prepare(
        `
          SELECT
            scenario_id AS scenarioId,
            service_id AS serviceId,
            contract_id AS contractId,
            name,
            expense_type AS expenseType,
            status,
            amount_minor AS amountMinor,
            currency,
            capex_opex AS capexOpex,
            gl_account_code AS glAccountCode,
            cost_center_code AS costCenterCode,
            funding_source AS fundingSource,
            start_date AS startDate
          FROM expense_line
          WHERE id = ? AND deleted_at IS NULL
        `
      )
      .get(snapshot.expenseLineId) as
      | {
          scenarioId: string;
          serviceId: string;
          contractId: string | null;
          name: string;
          expenseType: "recurring" | "one_time";
          status: "planned" | "approved" | "committed" | "actual" | "cancelled";
          amountMinor: number;
          currency: string;
          capexOpex: "capex" | "opex" | null;
          glAccountCode: string | null;
          costCenterCode: string | null;
          fundingSource: string | null;
          startDate: string | null;
        }
      | undefined;
    if (!row) {
      continue;
    }
    repo.updateExpenseLine(snapshot.expenseLineId, {
      scenarioId: row.scenarioId,
      serviceId: row.serviceId,
      contractId: row.contractId,
      name: row.name,
      expenseType: row.expenseType,
      status: row.status,
      amountMinor: row.amountMinor,
      currency: row.currency,
      capexOpex: row.capexOpex,
      glAccountCode: row.glAccountCode,
      costCenterCode: row.costCenterCode,
      fundingSource: row.fundingSource,
      startDate: row.startDate ?? undefined,
      endDate: snapshot.originalEndDate
    });
  }

  if (decision.materializedExpenseLineId) {
    const recurrenceIds = db
      .prepare("SELECT id FROM recurrence_rule WHERE expense_line_id = ?")
      .all(decision.materializedExpenseLineId) as Array<{ id: string }>;
    for (const recurrence of recurrenceIds) {
      repo.deleteRecurrenceRule(recurrence.id);
    }
    repo.deleteExpenseLine(decision.materializedExpenseLineId);
  }
}

function materializeDecisionChanges(
  repo: BudgetCrudRepository,
  db: Database.Database,
  input: {
    scenarioId: string;
    serviceId: string;
    contractId: string | null;
    action: RenewalDecisionAction;
    effectiveDate: string;
    expectedAmountMinor: number;
    currency: string;
  }
): {
  materializedExpenseLineId: string | null;
  sourceSnapshot: SourceExpenseSnapshot;
  currentAmountMinor: number;
} {
  const sourceExpenses = listSourceExpenses(db, input.scenarioId, input.serviceId, input.contractId);
  const currentAmountMinor = sourceExpenses.reduce((sum, expense) => sum + expense.amountMinor, 0);
  const sourceSnapshot: SourceExpenseSnapshot = [];
  for (const expense of sourceExpenses) {
    const endDateRow = db
      .prepare("SELECT end_date AS endDate FROM expense_line WHERE id = ?")
      .get(expense.id) as { endDate: string | null } | undefined;
    sourceSnapshot.push({
      expenseLineId: expense.id,
      originalEndDate: endDateRow?.endDate ?? null
    });
    repo.updateExpenseLine(expense.id, {
      scenarioId: expense.scenarioId,
      serviceId: expense.serviceId,
      contractId: expense.contractId,
      name: expense.name,
      expenseType: expense.expenseType,
      status: expense.status,
      amountMinor: expense.amountMinor,
      currency: expense.currency,
      capexOpex: expense.capexOpex,
      glAccountCode: expense.glAccountCode,
      costCenterCode: expense.costCenterCode,
      fundingSource: expense.fundingSource,
      startDate: expense.startDate ?? undefined,
      endDate: subtractOneDay(input.effectiveDate)
    });
  }

  if (input.action === "retire" || input.action === "do_not_renew") {
    return {
      materializedExpenseLineId: null,
      sourceSnapshot,
      currentAmountMinor
    };
  }

  const template = sourceExpenses.find((entry) => entry.recurrence) ?? sourceExpenses[0];
  if (!template) {
    throw new Error("Renewal decision requires at least one existing expense line in the active scenario.");
  }

  const materializedExpenseLineId = repo.createExpenseLineWithOptionalRecurrence(
    {
      scenarioId: input.scenarioId,
      serviceId: input.serviceId,
      contractId: input.contractId,
      name: `${template.name} Renewal Plan`,
      expenseType: template.expenseType,
      status: "planned",
      amountMinor: input.expectedAmountMinor,
      currency: input.currency || template.currency,
      capexOpex: template.capexOpex,
      glAccountCode: template.glAccountCode,
      costCenterCode: template.costCenterCode,
      fundingSource: template.fundingSource,
      startDate: input.effectiveDate,
      endDate: null
    },
    template.recurrence
      ? {
          expenseLineId: "renewal-plan",
          frequency: template.recurrence.frequency,
          interval: template.recurrence.interval,
          dayOfMonth: template.recurrence.dayOfMonth,
          monthOfYear: template.recurrence.monthOfYear ?? undefined,
          anchorDate: input.effectiveDate
        }
      : undefined
  );

  return {
    materializedExpenseLineId,
    sourceSnapshot,
    currentAmountMinor
  };
}

export function upsertRenewalDecision(
  db: Database.Database,
  input: {
    scenarioId: string;
    serviceId: string;
    contractId?: string | null;
    action: RenewalDecisionAction;
    effectiveDate: string;
    expectedAmountMinor: number;
    currency: string;
    oneTimeCostMinor?: number;
    savingsCategory?: RenewalSavingsCategory | null;
    savingsRationale?: string | null;
    notes?: string | null;
    assumptions?: string | null;
  }
): RenewalDecisionRecord {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveDate)) {
    throw new Error("effectiveDate must use YYYY-MM-DD format.");
  }
  if (!Number.isFinite(input.expectedAmountMinor) || input.expectedAmountMinor < 0) {
    throw new Error("expectedAmountMinor must be a non-negative integer.");
  }
  if (!/^[A-Z]{3}$/.test(input.currency)) {
    throw new Error("currency must be a valid ISO 4217 code.");
  }
  if (
    input.oneTimeCostMinor !== undefined &&
    (!Number.isFinite(input.oneTimeCostMinor) || input.oneTimeCostMinor < 0)
  ) {
    throw new Error("oneTimeCostMinor must be a non-negative integer.");
  }
  if (
    input.savingsCategory !== undefined &&
    input.savingsCategory !== null &&
    !RENEWAL_SAVINGS_CATEGORIES.has(input.savingsCategory)
  ) {
    throw new Error(`Invalid savingsCategory: ${input.savingsCategory}`);
  }

  const repo = new BudgetCrudRepository(db);
  const contractId = input.contractId ?? null;
  const apply = db.transaction(() => {
    const existing = loadDecision(db, input.scenarioId, input.serviceId, contractId);
    restorePriorDecisionArtifacts(repo, db, existing);

    const materialized = materializeDecisionChanges(repo, db, {
      scenarioId: input.scenarioId,
      serviceId: input.serviceId,
      contractId,
      action: input.action,
      effectiveDate: input.effectiveDate,
      expectedAmountMinor: input.expectedAmountMinor,
      currency: input.currency
    });
    const savingsCategory = input.savingsCategory ?? defaultSavingsCategoryForAction(input.action);
    const savingsBreakdown = computeRenewalSavingsBreakdown({
      action: input.action,
      currentAmountMinor: materialized.currentAmountMinor,
      expectedAmountMinor: input.expectedAmountMinor,
      oneTimeCostMinor: input.oneTimeCostMinor ?? 0
    });

    const id = existing?.id ?? crypto.randomUUID();
    db.prepare(
      `
        INSERT INTO renewal_decision (
          id,
          scenario_id,
          service_id,
          contract_id,
          action,
          effective_date,
          current_amount_minor,
          expected_amount_minor,
          recurring_savings_minor,
          avoided_future_cost_minor,
          one_time_cost_minor,
          savings_category,
          savings_rationale,
          currency,
          notes,
          assumptions,
          source_snapshot_json,
          materialized_expense_line_id,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          action = excluded.action,
          effective_date = excluded.effective_date,
          current_amount_minor = excluded.current_amount_minor,
          expected_amount_minor = excluded.expected_amount_minor,
          recurring_savings_minor = excluded.recurring_savings_minor,
          avoided_future_cost_minor = excluded.avoided_future_cost_minor,
          one_time_cost_minor = excluded.one_time_cost_minor,
          savings_category = excluded.savings_category,
          savings_rationale = excluded.savings_rationale,
          currency = excluded.currency,
          notes = excluded.notes,
          assumptions = excluded.assumptions,
          source_snapshot_json = excluded.source_snapshot_json,
          materialized_expense_line_id = excluded.materialized_expense_line_id,
          updated_at = CURRENT_TIMESTAMP
      `
    ).run(
      id,
      input.scenarioId,
      input.serviceId,
      contractId,
      input.action,
      input.effectiveDate,
      materialized.currentAmountMinor,
      input.expectedAmountMinor,
      savingsBreakdown.recurringSavingsMinor,
      savingsBreakdown.avoidedFutureCostMinor,
      savingsBreakdown.oneTimeCostMinor,
      savingsCategory,
      input.savingsRationale ?? null,
      input.currency,
      input.notes ?? null,
      input.assumptions ?? null,
      JSON.stringify(materialized.sourceSnapshot),
      materialized.materializedExpenseLineId
    );

    const saved = loadDecision(db, input.scenarioId, input.serviceId, contractId);
    if (!saved) {
      throw new Error("Renewal decision failed to persist.");
    }
    return toDecisionRecord(saved);
  });

  return apply();
}
