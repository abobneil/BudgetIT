import type Database from "better-sqlite3-multiple-ciphers";

type ParseOptions = {
  referenceDate?: Date;
};

export type FilterSpec = {
  scenarioId?: string;
  dateFrom?: string;
  dateTo?: string;
  amountMinMinor?: number;
  amountMaxMinor?: number;
  tagNames?: string[];
};

export type CompiledFilterQuery = {
  sql: string;
  params: Array<string | number>;
  explanation: string;
};

export type ParsedNlqResult = {
  filterSpec: FilterSpec;
  explanation: string;
};

export type ExpenseFilterRow = {
  id: string;
  scenario_id: string;
  service_id: string;
  name: string;
  amount_minor: number;
  currency: string;
  start_date: string | null;
  end_date: string | null;
};

const FILTER_KEYS = new Set([
  "scenarioId",
  "dateFrom",
  "dateTo",
  "amountMinMinor",
  "amountMaxMinor",
  "tagNames"
]);

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function firstDayOfMonth(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

function lastDayOfMonth(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0));
}

function parseUsdMinor(value: string): number {
  const cleaned = value.replace(/[,$]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    throw new Error(`Invalid USD amount: ${value}`);
  }
  const [whole, fractional = ""] = cleaned.split(".");
  const cents = `${fractional}00`.slice(0, 2);
  return Number.parseInt(whole, 10) * 100 + Number.parseInt(cents, 10);
}

function assertIsoDate(value: string, key: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${key} must use YYYY-MM-DD format.`);
  }
}

function hasUnsafeSqlToken(value: string): boolean {
  return /(--|;|\/\*|\*\/|\b(drop|alter|delete|insert|update)\b)/i.test(value);
}

export function parseNlqToFilterSpec(query: string, options: ParseOptions = {}): ParsedNlqResult {
  const normalized = query.toLowerCase();
  const referenceDate = options.referenceDate ?? new Date();
  const filterSpec: FilterSpec = {};
  const explanationParts: string[] = [];

  const scenarioMatch = normalized.match(/scenario:([a-z0-9_-]+)/);
  if (scenarioMatch) {
    filterSpec.scenarioId = scenarioMatch[1];
    explanationParts.push(`scenario is ${scenarioMatch[1]}`);
  }

  if (normalized.includes("this month")) {
    const start = firstDayOfMonth(referenceDate);
    const end = lastDayOfMonth(referenceDate);
    filterSpec.dateFrom = toDateOnly(start);
    filterSpec.dateTo = toDateOnly(end);
    explanationParts.push(`date between ${filterSpec.dateFrom} and ${filterSpec.dateTo}`);
  } else if (normalized.includes("last month")) {
    const previousMonth = new Date(
      Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() - 1, 1)
    );
    filterSpec.dateFrom = toDateOnly(firstDayOfMonth(previousMonth));
    filterSpec.dateTo = toDateOnly(lastDayOfMonth(previousMonth));
    explanationParts.push(`date between ${filterSpec.dateFrom} and ${filterSpec.dateTo}`);
  }

  const dateBetweenMatch = normalized.match(/between\s+(\d{4}-\d{2}-\d{2})\s+and\s+(\d{4}-\d{2}-\d{2})/);
  if (dateBetweenMatch) {
    filterSpec.dateFrom = dateBetweenMatch[1];
    filterSpec.dateTo = dateBetweenMatch[2];
    explanationParts.push(`date between ${dateBetweenMatch[1]} and ${dateBetweenMatch[2]}`);
  }

  const afterDateMatch = normalized.match(/after\s+(\d{4}-\d{2}-\d{2})/);
  if (afterDateMatch) {
    filterSpec.dateFrom = afterDateMatch[1];
    explanationParts.push(`date on/after ${afterDateMatch[1]}`);
  }

  const beforeDateMatch = normalized.match(/before\s+(\d{4}-\d{2}-\d{2})/);
  if (beforeDateMatch) {
    filterSpec.dateTo = beforeDateMatch[1];
    explanationParts.push(`date on/before ${beforeDateMatch[1]}`);
  }

  const amountBetweenMatch = normalized.match(/between\s+\$?([\d,.]+)\s+and\s+\$?([\d,.]+)\s+(usd|dollars|\$)?/);
  if (amountBetweenMatch && normalized.includes("$")) {
    filterSpec.amountMinMinor = parseUsdMinor(amountBetweenMatch[1]);
    filterSpec.amountMaxMinor = parseUsdMinor(amountBetweenMatch[2]);
    explanationParts.push(
      `amount between ${(filterSpec.amountMinMinor / 100).toFixed(2)} and ${(filterSpec.amountMaxMinor / 100).toFixed(2)} USD`
    );
  } else {
    const overMatch = normalized.match(/(over|above)\s+\$?([\d,.]+)/);
    if (overMatch) {
      filterSpec.amountMinMinor = parseUsdMinor(overMatch[2]);
      explanationParts.push(`amount >= ${(filterSpec.amountMinMinor / 100).toFixed(2)} USD`);
    }

    const underMatch = normalized.match(/(under|below)\s+\$?([\d,.]+)/);
    if (underMatch) {
      filterSpec.amountMaxMinor = parseUsdMinor(underMatch[2]);
      explanationParts.push(`amount <= ${(filterSpec.amountMaxMinor / 100).toFixed(2)} USD`);
    }
  }

  const tagNames = Array.from(normalized.matchAll(/tag:([a-z0-9_-]+)/g)).map((match) => match[1]);
  if (tagNames.length > 0) {
    filterSpec.tagNames = tagNames;
    explanationParts.push(`tag includes ${tagNames.join(", ")}`);
  }

  validateFilterSpec(filterSpec);

  return {
    filterSpec,
    explanation:
      explanationParts.length > 0
        ? explanationParts.join("; ")
        : "No filters detected. Query returns all active expense lines."
  };
}

export function validateFilterSpec(filterSpec: FilterSpec): void {
  const keys = Object.keys(filterSpec);
  for (const key of keys) {
    if (!FILTER_KEYS.has(key)) {
      throw new Error(`Unknown filter field: ${key}`);
    }
  }

  if (filterSpec.scenarioId && hasUnsafeSqlToken(filterSpec.scenarioId)) {
    throw new Error("Unsafe token detected in scenarioId.");
  }
  if (filterSpec.dateFrom) {
    assertIsoDate(filterSpec.dateFrom, "dateFrom");
  }
  if (filterSpec.dateTo) {
    assertIsoDate(filterSpec.dateTo, "dateTo");
  }
  if (
    typeof filterSpec.amountMinMinor === "number" &&
    (!Number.isInteger(filterSpec.amountMinMinor) || filterSpec.amountMinMinor < 0)
  ) {
    throw new Error("amountMinMinor must be a non-negative integer.");
  }
  if (
    typeof filterSpec.amountMaxMinor === "number" &&
    (!Number.isInteger(filterSpec.amountMaxMinor) || filterSpec.amountMaxMinor < 0)
  ) {
    throw new Error("amountMaxMinor must be a non-negative integer.");
  }
  if (
    typeof filterSpec.amountMinMinor === "number" &&
    typeof filterSpec.amountMaxMinor === "number" &&
    filterSpec.amountMinMinor > filterSpec.amountMaxMinor
  ) {
    throw new Error("amountMinMinor cannot exceed amountMaxMinor.");
  }

  if (filterSpec.tagNames) {
    for (const tagName of filterSpec.tagNames) {
      if (hasUnsafeSqlToken(tagName)) {
        throw new Error("Unsafe token detected in tagNames.");
      }
    }
  }
}

export function compileFilterSpecToExpenseQuery(filterSpec: FilterSpec): CompiledFilterQuery {
  validateFilterSpec(filterSpec);

  const clauses: string[] = ["e.deleted_at IS NULL"];
  const params: Array<string | number> = [];
  const explanationParts: string[] = [];

  if (filterSpec.scenarioId) {
    clauses.push("e.scenario_id = ?");
    params.push(filterSpec.scenarioId);
    explanationParts.push(`scenario = ${filterSpec.scenarioId}`);
  }
  if (filterSpec.dateFrom) {
    clauses.push("COALESCE(e.start_date, substr(e.created_at, 1, 10)) >= ?");
    params.push(filterSpec.dateFrom);
    explanationParts.push(`date >= ${filterSpec.dateFrom}`);
  }
  if (filterSpec.dateTo) {
    clauses.push("COALESCE(e.start_date, substr(e.created_at, 1, 10)) <= ?");
    params.push(filterSpec.dateTo);
    explanationParts.push(`date <= ${filterSpec.dateTo}`);
  }
  if (typeof filterSpec.amountMinMinor === "number") {
    clauses.push("e.amount_minor >= ?");
    params.push(filterSpec.amountMinMinor);
    explanationParts.push(`amount >= ${filterSpec.amountMinMinor}`);
  }
  if (typeof filterSpec.amountMaxMinor === "number") {
    clauses.push("e.amount_minor <= ?");
    params.push(filterSpec.amountMaxMinor);
    explanationParts.push(`amount <= ${filterSpec.amountMaxMinor}`);
  }
  if (filterSpec.tagNames && filterSpec.tagNames.length > 0) {
    for (const tagName of filterSpec.tagNames) {
      clauses.push(
        "EXISTS (SELECT 1 FROM tag_assignment ta JOIN tag tg ON tg.id = ta.tag_id WHERE ta.entity_type = 'expense_line' AND ta.entity_id = e.id AND lower(tg.name) = ?)"
      );
      params.push(tagName.toLowerCase());
      explanationParts.push(`tag = ${tagName.toLowerCase()}`);
    }
  }

  const sql = `
    SELECT
      e.id,
      e.scenario_id,
      e.service_id,
      e.name,
      e.amount_minor,
      e.currency,
      e.start_date,
      e.end_date
    FROM expense_line e
    WHERE ${clauses.join("\n      AND ")}
    ORDER BY e.start_date IS NULL, e.start_date, e.created_at
  `;

  return {
    sql,
    params,
    explanation:
      explanationParts.length > 0
        ? explanationParts.join("; ")
        : "No filters applied."
  };
}

export function queryExpensesByFilterSpec(
  db: Database.Database,
  filterSpec: FilterSpec
): { rows: ExpenseFilterRow[]; compiled: CompiledFilterQuery } {
  const compiled = compileFilterSpecToExpenseQuery(filterSpec);
  const rows = db.prepare(compiled.sql).all(...compiled.params) as ExpenseFilterRow[];
  return { rows, compiled };
}
