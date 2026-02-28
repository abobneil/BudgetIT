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

export type DashboardRange = "1m" | "3m" | "12m" | "60m";

export const DASHBOARD_RANGE_MONTHS: Record<DashboardRange, number> = {
  "1m": 1,
  "3m": 3,
  "12m": 12,
  "60m": 60
};

type MonthRecord = { month: string };

function monthSortValue(month: string): number {
  const [yearPart, monthPart] = month.split("-");
  const year = Number(yearPart);
  const monthIndex = Number(monthPart);

  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 1 || monthIndex > 12) {
    return Number.NEGATIVE_INFINITY;
  }

  return year * 12 + (monthIndex - 1);
}

function keepLatestMonths<T extends MonthRecord>(rows: T[], monthsToKeep: number): T[] {
  const ordered = [...rows].sort((left, right) => monthSortValue(left.month) - monthSortValue(right.month));
  if (ordered.length <= monthsToKeep) {
    return ordered;
  }
  return ordered.slice(ordered.length - monthsToKeep);
}

export function filterDashboardDatasetByRange(
  dataset: DashboardDataset,
  range: DashboardRange
): DashboardDataset {
  const monthsToKeep = DASHBOARD_RANGE_MONTHS[range];
  return {
    ...dataset,
    spendTrend: keepLatestMonths(dataset.spendTrend, monthsToKeep),
    variance: keepLatestMonths(dataset.variance, monthsToKeep),
    renewals: keepLatestMonths(dataset.renewals, monthsToKeep),
    growth: keepLatestMonths(dataset.growth, monthsToKeep)
  };
}

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
