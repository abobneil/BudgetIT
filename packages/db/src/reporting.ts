import { buildMonthlyVarianceDataset, type MonthlyVarianceRow } from "./variance";
import type Database from "better-sqlite3-multiple-ciphers";

export type SpendTrendRow = {
  month: string;
  forecastMinor: number;
  actualMinor: number;
};

export type RenewalRow = {
  month: string;
  count: number;
};

export type GrowthRow = {
  month: string;
  forecastMinor: number;
  growthPct: number | null;
};

export type TaggingCompleteness = {
  totalExpenseLines: number;
  taggedExpenseLines: number;
  completenessRatio: number;
};

export type ReplacementStatusRow = {
  status: string;
  count: number;
};

export type ReplacementStatusSummary = {
  totalPlans: number;
  replacementRequiredOpen: number;
  byStatus: ReplacementStatusRow[];
};

export type NarrativeBlock = {
  id: string;
  title: string;
  body: string;
};

export type DashboardDataset = {
  scenarioId: string;
  staleForecast: boolean;
  spendTrend: SpendTrendRow[];
  renewals: RenewalRow[];
  growth: GrowthRow[];
  variance: MonthlyVarianceRow[];
  taggingCompleteness: TaggingCompleteness;
  replacementStatus: ReplacementStatusSummary;
  narrativeBlocks: NarrativeBlock[];
};

function buildSpendTrend(variance: MonthlyVarianceRow[]): SpendTrendRow[] {
  return variance.map((row) => ({
    month: row.month,
    forecastMinor: row.forecastMinor,
    actualMinor: row.actualMinor
  }));
}

function buildGrowthSeries(spendTrend: SpendTrendRow[]): GrowthRow[] {
  return spendTrend.map((row, index) => {
    if (index === 0) {
      return { month: row.month, forecastMinor: row.forecastMinor, growthPct: null };
    }
    const previous = spendTrend[index - 1];
    if (previous.forecastMinor === 0) {
      return { month: row.month, forecastMinor: row.forecastMinor, growthPct: null };
    }
    return {
      month: row.month,
      forecastMinor: row.forecastMinor,
      growthPct: ((row.forecastMinor - previous.forecastMinor) / previous.forecastMinor) * 100
    };
  });
}

function queryRenewals(db: Database.Database): RenewalRow[] {
  return db
    .prepare(
      `
        SELECT substr(renewal_date, 1, 7) AS month, COUNT(*) AS count
        FROM contract
        WHERE renewal_date IS NOT NULL
        GROUP BY month
        ORDER BY month
      `
    )
    .all() as RenewalRow[];
}

function queryTaggingCompleteness(
  db: Database.Database,
  scenarioId: string
): TaggingCompleteness {
  const totals = db
    .prepare(
      `
        SELECT
          COUNT(*) AS total,
          SUM(
            CASE
              WHEN EXISTS (
                SELECT 1
                FROM tag_assignment ta
                WHERE ta.entity_type = 'expense_line'
                  AND ta.entity_id = e.id
              ) THEN 1
              ELSE 0
            END
          ) AS tagged
        FROM expense_line e
        WHERE e.scenario_id = ?
          AND e.deleted_at IS NULL
      `
    )
    .get(scenarioId) as { total: number; tagged: number | null };

  const total = totals.total ?? 0;
  const tagged = totals.tagged ?? 0;
  return {
    totalExpenseLines: total,
    taggedExpenseLines: tagged,
    completenessRatio: total === 0 ? 1 : tagged / total
  };
}

function queryReplacementStatus(
  db: Database.Database,
  scenarioId: string
): ReplacementStatusSummary {
  const byStatus = db
    .prepare(
      `
        SELECT decision_status AS status, COUNT(*) AS count
        FROM service_plan
        WHERE scenario_id = ?
        GROUP BY decision_status
        ORDER BY decision_status
      `
    )
    .all(scenarioId) as ReplacementStatusRow[];

  const replacementRequiredOpen = db
    .prepare(
      `
        SELECT COUNT(*) AS count
        FROM service_plan
        WHERE scenario_id = ?
          AND replacement_required = 1
          AND replacement_selected_service_id IS NULL
      `
    )
    .get(scenarioId) as { count: number };

  return {
    totalPlans: byStatus.reduce((sum, row) => sum + row.count, 0),
    replacementRequiredOpen: replacementRequiredOpen.count,
    byStatus
  };
}

function buildNarratives(input: {
  staleForecast: boolean;
  spendTrend: SpendTrendRow[];
  renewals: RenewalRow[];
  taggingCompleteness: TaggingCompleteness;
  replacementStatus: ReplacementStatusSummary;
}): NarrativeBlock[] {
  const totalForecast = input.spendTrend.reduce((sum, row) => sum + row.forecastMinor, 0);
  const totalActual = input.spendTrend.reduce((sum, row) => sum + row.actualMinor, 0);
  const delta = totalActual - totalForecast;

  return [
    {
      id: "spend-summary",
      title: "Spend Summary",
      body: `Forecast ${(totalForecast / 100).toFixed(2)} USD vs actual ${(totalActual / 100).toFixed(2)} USD (delta ${(delta / 100).toFixed(2)} USD).`
    },
    {
      id: "renewal-summary",
      title: "Renewals",
      body: `${input.renewals.reduce((sum, row) => sum + row.count, 0)} renewals are currently scheduled.`
    },
    {
      id: "quality-summary",
      title: "Data Quality",
      body: `Tagging completeness is ${(input.taggingCompleteness.completenessRatio * 100).toFixed(1)}%.${input.staleForecast ? " Forecast is marked stale." : ""}`
    },
    {
      id: "replacement-summary",
      title: "Replacement Status",
      body: `${input.replacementStatus.replacementRequiredOpen} replacement-required plans remain without a selected replacement.`
    }
  ];
}

export function buildDashboardDataset(
  db: Database.Database,
  scenarioId: string = "baseline"
): DashboardDataset {
  const variance = buildMonthlyVarianceDataset(db, scenarioId);
  const spendTrend = buildSpendTrend(variance);
  const renewals = queryRenewals(db);
  const growth = buildGrowthSeries(spendTrend);
  const taggingCompleteness = queryTaggingCompleteness(db, scenarioId);
  const replacementStatus = queryReplacementStatus(db, scenarioId);
  const metaRow = db
    .prepare("SELECT forecast_stale FROM meta WHERE id = 1")
    .get() as { forecast_stale: number | null } | undefined;
  const staleForecast = (metaRow?.forecast_stale ?? 0) === 1;

  return {
    scenarioId,
    staleForecast,
    spendTrend,
    renewals,
    growth,
    variance,
    taggingCompleteness,
    replacementStatus,
    narrativeBlocks: buildNarratives({
      staleForecast,
      spendTrend,
      renewals,
      taggingCompleteness,
      replacementStatus
    })
  };
}
