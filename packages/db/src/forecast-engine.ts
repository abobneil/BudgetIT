import crypto from "node:crypto";

import type Database from "better-sqlite3-multiple-ciphers";

type RecurrenceFrequency = "monthly" | "quarterly" | "yearly";

type RecurringExpenseRow = {
  expense_line_id: string;
  scenario_id: string;
  amount_minor: number;
  currency: string;
  start_date: string | null;
  end_date: string | null;
  frequency: RecurrenceFrequency;
  interval: number;
  day_of_month: number;
  month_of_year: number | null;
  anchor_date: string | null;
};

function parseIsoDate(dateText: string): Date {
  const date = new Date(`${dateText}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ISO date: ${dateText}`);
  }
  return date;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysInMonthUtc(year: number, monthIndexZeroBased: number): number {
  return new Date(Date.UTC(year, monthIndexZeroBased + 1, 0)).getUTCDate();
}

function buildClampedDateUtc(
  year: number,
  monthIndexZeroBased: number,
  targetDayOfMonth: number
): Date {
  const clampedDay = Math.min(targetDayOfMonth, daysInMonthUtc(year, monthIndexZeroBased));
  return new Date(Date.UTC(year, monthIndexZeroBased, clampedDay));
}

function addMonthsClamped(date: Date, monthsToAdd: number, targetDayOfMonth: number): Date {
  const nextYear = date.getUTCFullYear() + Math.floor((date.getUTCMonth() + monthsToAdd) / 12);
  const nextMonth = (date.getUTCMonth() + monthsToAdd) % 12;
  return buildClampedDateUtc(nextYear, nextMonth, targetDayOfMonth);
}

function computeStepInMonths(frequency: RecurrenceFrequency, interval: number): number {
  if (frequency === "monthly") {
    return interval;
  }
  if (frequency === "quarterly") {
    return interval * 3;
  }
  return interval * 12;
}

function resolveAnchorDate(row: RecurringExpenseRow): Date {
  if (row.anchor_date) {
    return parseIsoDate(row.anchor_date);
  }
  if (row.start_date) {
    return parseIsoDate(row.start_date);
  }

  const now = new Date();
  if (row.frequency === "yearly" && row.month_of_year) {
    return buildClampedDateUtc(now.getUTCFullYear(), row.month_of_year - 1, row.day_of_month);
  }
  return buildClampedDateUtc(now.getUTCFullYear(), now.getUTCMonth(), row.day_of_month);
}

function generateOccurrenceDates(row: RecurringExpenseRow, horizonMonths: number): string[] {
  const anchor = resolveAnchorDate(row);
  const stepMonths = computeStepInMonths(row.frequency, row.interval);
  const maxDate = addMonthsClamped(anchor, horizonMonths, row.day_of_month);
  const endDate = row.end_date ? parseIsoDate(row.end_date) : null;
  const startDate = row.start_date ? parseIsoDate(row.start_date) : null;

  const dates: string[] = [];
  let current = anchor;
  while (current <= maxDate) {
    if ((!startDate || current >= startDate) && (!endDate || current <= endDate)) {
      dates.push(toIsoDate(current));
    }
    current = addMonthsClamped(current, stepMonths, row.day_of_month);
  }

  return dates;
}

export function markForecastStale(db: Database.Database): void {
  db.prepare(
    `
      UPDATE meta
      SET forecast_stale = 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `
  ).run();
}

export function materializeScenarioOccurrences(
  db: Database.Database,
  scenarioId: string,
  horizonMonths: number = 24
): number {
  const recurringRows = db
    .prepare(
      `
        SELECT
          e.id AS expense_line_id,
          e.scenario_id,
          e.amount_minor,
          e.currency,
          e.start_date,
          e.end_date,
          r.frequency,
          r.interval,
          r.day_of_month,
          r.month_of_year,
          r.anchor_date
        FROM expense_line e
        JOIN recurrence_rule r ON r.expense_line_id = e.id
        WHERE e.scenario_id = ?
          AND e.deleted_at IS NULL
          AND e.expense_type = 'recurring'
          AND e.status != 'cancelled'
      `
    )
    .all(scenarioId) as RecurringExpenseRow[];

  const generatedRows: Array<{
    id: string;
    scenarioId: string;
    expenseLineId: string;
    occurrenceDate: string;
    amountMinor: number;
    currency: string;
  }> = [];

  for (const row of recurringRows) {
    const occurrenceDates = generateOccurrenceDates(row, horizonMonths);
    for (const occurrenceDate of occurrenceDates) {
      generatedRows.push({
        id: crypto.randomUUID(),
        scenarioId: row.scenario_id,
        expenseLineId: row.expense_line_id,
        occurrenceDate,
        amountMinor: row.amount_minor,
        currency: row.currency
      });
    }
  }

  const now = new Date().toISOString();
  const write = db.transaction(() => {
    db.prepare("DELETE FROM occurrence WHERE scenario_id = ?").run(scenarioId);
    const insert = db.prepare(
      `
        INSERT INTO occurrence (
          id,
          scenario_id,
          expense_line_id,
          occurrence_date,
          amount_minor,
          currency,
          state,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'forecast', ?, ?)
      `
    );

    for (const row of generatedRows) {
      insert.run(
        row.id,
        row.scenarioId,
        row.expenseLineId,
        row.occurrenceDate,
        row.amountMinor,
        row.currency,
        now,
        now
      );
    }

    db.prepare(
      `
        UPDATE meta
        SET forecast_stale = 0,
            forecast_generated_at = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `
    ).run(now);
  });

  write();
  return generatedRows.length;
}

