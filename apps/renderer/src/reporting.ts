export type DashboardDataset = {
  scenarioId: string;
  staleForecast: boolean;
  spendTrend: Array<{
    month: string;
    forecastMinor: number;
    actualMinor: number;
  }>;
  variance: Array<{
    month: string;
    forecastMinor: number;
    actualMinor: number;
    varianceMinor: number;
    unmatchedActualMinor: number;
    unmatchedCount: number;
  }>;
  renewals: Array<{
    month: string;
    count: number;
  }>;
  growth: Array<{
    month: string;
    forecastMinor: number;
    growthPct: number | null;
  }>;
  taggingCompleteness: {
    totalExpenseLines: number;
    taggedExpenseLines: number;
    completenessRatio: number;
  };
  replacementStatus: {
    totalPlans: number;
    replacementRequiredOpen: number;
    byStatus: Array<{ status: string; count: number }>;
  };
  narrativeBlocks: Array<{
    id: string;
    title: string;
    body: string;
  }>;
};

export function computeDashboardTotals(dataset: DashboardDataset): {
  forecastMinor: number;
  actualMinor: number;
  varianceMinor: number;
} {
  return dataset.spendTrend.reduce(
    (totals, row) => {
      totals.forecastMinor += row.forecastMinor;
      totals.actualMinor += row.actualMinor;
      totals.varianceMinor += row.actualMinor - row.forecastMinor;
      return totals;
    },
    { forecastMinor: 0, actualMinor: 0, varianceMinor: 0 }
  );
}

export function getForecastStaleIndicator(dataset: DashboardDataset): string | null {
  if (!dataset.staleForecast) {
    return null;
  }
  return "Forecast data is stale and should be re-materialized.";
}
