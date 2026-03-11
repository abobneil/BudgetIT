import type Database from "better-sqlite3-multiple-ciphers";

export type RenewalSavingsCategory =
  | "retirement"
  | "non_renewal"
  | "replacement"
  | "consolidation"
  | "renegotiation"
  | "other";

export type ScenarioSavingsCategorySummary = {
  category: RenewalSavingsCategory;
  count: number;
  recurringSavingsMinor: number;
  avoidedFutureCostMinor: number;
  oneTimeCostMinor: number;
  netSavingsMinor: number;
};

export type ScenarioSavingsSummary = {
  outcomeCount: number;
  recurringSavingsMinor: number;
  avoidedFutureCostMinor: number;
  oneTimeCostMinor: number;
  netSavingsMinor: number;
  byCategory: ScenarioSavingsCategorySummary[];
};

export type ScenarioSavingsDelta = {
  recurringSavingsMinor: number;
  avoidedFutureCostMinor: number;
  oneTimeCostMinor: number;
  netSavingsMinor: number;
};

export function diffScenarioSavings(
  baseline: ScenarioSavingsSummary,
  comparison: ScenarioSavingsSummary
): ScenarioSavingsDelta {
  return {
    recurringSavingsMinor:
      comparison.recurringSavingsMinor - baseline.recurringSavingsMinor,
    avoidedFutureCostMinor:
      comparison.avoidedFutureCostMinor - baseline.avoidedFutureCostMinor,
    oneTimeCostMinor: comparison.oneTimeCostMinor - baseline.oneTimeCostMinor,
    netSavingsMinor: comparison.netSavingsMinor - baseline.netSavingsMinor
  };
}

export function summarizeScenarioSavings(
  db: Database.Database,
  scenarioId: string
): ScenarioSavingsSummary {
  const rows = db
    .prepare(
      `
        SELECT
          COALESCE(savings_category, 'other') AS category,
          COUNT(*) AS count,
          COALESCE(SUM(recurring_savings_minor), 0) AS recurringSavingsMinor,
          COALESCE(SUM(avoided_future_cost_minor), 0) AS avoidedFutureCostMinor,
          COALESCE(SUM(one_time_cost_minor), 0) AS oneTimeCostMinor
        FROM renewal_decision
        WHERE scenario_id = ?
        GROUP BY COALESCE(savings_category, 'other')
        ORDER BY recurringSavingsMinor DESC, avoidedFutureCostMinor DESC, category ASC
      `
    )
    .all(scenarioId) as Array<{
    category: RenewalSavingsCategory;
    count: number;
    recurringSavingsMinor: number;
    avoidedFutureCostMinor: number;
    oneTimeCostMinor: number;
  }>;

  const byCategory = rows.map((row) => ({
    ...row,
    netSavingsMinor:
      row.recurringSavingsMinor + row.avoidedFutureCostMinor - row.oneTimeCostMinor
  }));

  return byCategory.reduce<ScenarioSavingsSummary>(
    (summary, row) => {
      summary.outcomeCount += row.count;
      summary.recurringSavingsMinor += row.recurringSavingsMinor;
      summary.avoidedFutureCostMinor += row.avoidedFutureCostMinor;
      summary.oneTimeCostMinor += row.oneTimeCostMinor;
      summary.netSavingsMinor += row.netSavingsMinor;
      summary.byCategory.push(row);
      return summary;
    },
    {
      outcomeCount: 0,
      recurringSavingsMinor: 0,
      avoidedFutureCostMinor: 0,
      oneTimeCostMinor: 0,
      netSavingsMinor: 0,
      byCategory: []
    }
  );
}
