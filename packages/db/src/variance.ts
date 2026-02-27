import crypto from "node:crypto";

import type Database from "better-sqlite3-multiple-ciphers";

export type ActualTransactionInput = {
  scenarioId: string;
  serviceId: string;
  contractId?: string | null;
  transactionDate: string;
  amountMinor: number;
  currency: "USD";
  description?: string;
};

export type ActualIngestResult = {
  inserted: number;
  matched: number;
  unmatched: number;
  matchRate: number;
};

export type UnmatchedActualTransaction = {
  id: string;
  scenarioId: string;
  serviceId: string;
  contractId: string | null;
  transactionDate: string;
  amountMinor: number;
  currency: "USD";
  description: string | null;
};

export type MonthlyVarianceRow = {
  month: string;
  forecastMinor: number;
  actualMinor: number;
  varianceMinor: number;
  unmatchedActualMinor: number;
  unmatchedCount: number;
};

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime());
}

function assertTransactionInput(input: ActualTransactionInput): void {
  if (!input.scenarioId) {
    throw new Error("scenarioId is required.");
  }
  if (!input.serviceId) {
    throw new Error("serviceId is required.");
  }
  if (!isIsoDate(input.transactionDate)) {
    throw new Error("transactionDate must use YYYY-MM-DD format.");
  }
  if (!Number.isInteger(input.amountMinor) || input.amountMinor < 0) {
    throw new Error("amountMinor must be a non-negative integer.");
  }
}

function findMatchCandidates(
  db: Database.Database,
  input: ActualTransactionInput
): Array<{ id: string }> {
  return db
    .prepare(
      `
        SELECT o.id
        FROM occurrence o
        JOIN expense_line e ON e.id = o.expense_line_id
        LEFT JOIN spend_transaction t ON t.matched_occurrence_id = o.id
        WHERE o.scenario_id = ?
          AND e.service_id = ?
          AND o.amount_minor = ?
          AND o.currency = ?
          AND t.id IS NULL
          AND substr(o.occurrence_date, 1, 7) = substr(?, 1, 7)
        ORDER BY ABS(julianday(o.occurrence_date) - julianday(?)), o.occurrence_date
        LIMIT 24
      `
    )
    .all(
      input.scenarioId,
      input.serviceId,
      input.amountMinor,
      input.currency,
      input.transactionDate,
      input.transactionDate
    ) as Array<{ id: string }>;
}

export function ingestActualTransactions(
  db: Database.Database,
  inputs: ActualTransactionInput[]
): ActualIngestResult {
  let inserted = 0;
  let matched = 0;
  let unmatched = 0;
  const usedOccurrenceIds = new Set<string>();

  const write = db.transaction(() => {
    for (const input of inputs) {
      assertTransactionInput(input);
      const candidates = findMatchCandidates(db, input);
      const selected = candidates.find((entry) => !usedOccurrenceIds.has(entry.id));
      const matchedOccurrenceId = selected?.id ?? null;
      if (matchedOccurrenceId) {
        usedOccurrenceIds.add(matchedOccurrenceId);
      }

      db.prepare(
        `
          INSERT INTO spend_transaction (
            id,
            scenario_id,
            service_id,
            contract_id,
            transaction_date,
            amount_minor,
            currency,
            description,
            matched_occurrence_id,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `
      ).run(
        crypto.randomUUID(),
        input.scenarioId,
        input.serviceId,
        input.contractId ?? null,
        input.transactionDate,
        input.amountMinor,
        input.currency,
        input.description ?? null,
        matchedOccurrenceId
      );

      if (matchedOccurrenceId) {
        db.prepare(
          "UPDATE occurrence SET state = 'actualized', updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).run(matchedOccurrenceId);
        matched += 1;
      } else {
        unmatched += 1;
      }

      inserted += 1;
    }
  });
  write();

  return {
    inserted,
    matched,
    unmatched,
    matchRate: inserted === 0 ? 0 : matched / inserted
  };
}

export function listUnmatchedActualTransactions(
  db: Database.Database,
  scenarioId: string
): UnmatchedActualTransaction[] {
  return db
    .prepare(
      `
        SELECT
          id,
          scenario_id AS scenarioId,
          service_id AS serviceId,
          contract_id AS contractId,
          transaction_date AS transactionDate,
          amount_minor AS amountMinor,
          currency,
          description
        FROM spend_transaction
        WHERE scenario_id = ?
          AND matched_occurrence_id IS NULL
        ORDER BY transaction_date ASC, created_at ASC
      `
    )
    .all(scenarioId) as UnmatchedActualTransaction[];
}

export function buildMonthlyVarianceDataset(
  db: Database.Database,
  scenarioId: string
): MonthlyVarianceRow[] {
  const forecastRows = db
    .prepare(
      `
        SELECT
          substr(occurrence_date, 1, 7) AS month,
          SUM(amount_minor) AS forecast_minor
        FROM occurrence
        WHERE scenario_id = ?
        GROUP BY month
      `
    )
    .all(scenarioId) as Array<{ month: string; forecast_minor: number }>;

  const actualRows = db
    .prepare(
      `
        SELECT
          substr(transaction_date, 1, 7) AS month,
          SUM(amount_minor) AS actual_minor,
          SUM(CASE WHEN matched_occurrence_id IS NULL THEN amount_minor ELSE 0 END) AS unmatched_actual_minor,
          SUM(CASE WHEN matched_occurrence_id IS NULL THEN 1 ELSE 0 END) AS unmatched_count
        FROM spend_transaction
        WHERE scenario_id = ?
        GROUP BY month
      `
    )
    .all(scenarioId) as Array<{
    month: string;
    actual_minor: number;
    unmatched_actual_minor: number;
    unmatched_count: number;
  }>;

  const rowsByMonth = new Map<string, MonthlyVarianceRow>();
  for (const row of forecastRows) {
    rowsByMonth.set(row.month, {
      month: row.month,
      forecastMinor: row.forecast_minor,
      actualMinor: 0,
      varianceMinor: -row.forecast_minor,
      unmatchedActualMinor: 0,
      unmatchedCount: 0
    });
  }

  for (const row of actualRows) {
    const existing = rowsByMonth.get(row.month) ?? {
      month: row.month,
      forecastMinor: 0,
      actualMinor: 0,
      varianceMinor: 0,
      unmatchedActualMinor: 0,
      unmatchedCount: 0
    };
    existing.actualMinor = row.actual_minor;
    existing.unmatchedActualMinor = row.unmatched_actual_minor;
    existing.unmatchedCount = row.unmatched_count;
    existing.varianceMinor = existing.actualMinor - existing.forecastMinor;
    rowsByMonth.set(row.month, existing);
  }

  return Array.from(rowsByMonth.values()).sort((left, right) => left.month.localeCompare(right.month));
}
