import {
  computeDashboardTotals,
  getForecastStaleIndicator,
  type DashboardDataset
} from "../../reporting";

export type DashboardKpiMetrics = {
  forecastMinor: number;
  actualMinor: number;
  varianceMinor: number;
  renewalCount: number;
  taggingCompletenessPct: number;
  replacementRequiredOpen: number;
};

export type DashboardStaleState = {
  isStale: boolean;
  message: string | null;
};

export function buildDashboardKpiMetrics(
  dataset: DashboardDataset
): DashboardKpiMetrics {
  const totals = computeDashboardTotals(dataset);
  const renewalCount = dataset.renewals.reduce((sum, row) => sum + row.count, 0);

  return {
    forecastMinor: totals.forecastMinor,
    actualMinor: totals.actualMinor,
    varianceMinor: totals.varianceMinor,
    renewalCount,
    taggingCompletenessPct: dataset.taggingCompleteness.completenessRatio * 100,
    replacementRequiredOpen: dataset.replacementStatus.replacementRequiredOpen
  };
}

export function mapDashboardStaleState(
  dataset: DashboardDataset
): DashboardStaleState {
  const message = getForecastStaleIndicator(dataset);
  return {
    isStale: message !== null,
    message
  };
}
