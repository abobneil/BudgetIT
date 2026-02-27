import { describe, expect, it } from "vitest";

import {
  computeDashboardTotals,
  getForecastStaleIndicator,
  type DashboardDataset
} from "./reporting";

const fixtureDataset: DashboardDataset = {
  scenarioId: "baseline",
  staleForecast: false,
  spendTrend: [
    { month: "2026-01", forecastMinor: 10000, actualMinor: 10000 },
    { month: "2026-02", forecastMinor: 15000, actualMinor: 16000 },
    { month: "2026-03", forecastMinor: 15000, actualMinor: 15000 }
  ],
  variance: [
    {
      month: "2026-01",
      forecastMinor: 10000,
      actualMinor: 10000,
      varianceMinor: 0,
      unmatchedActualMinor: 0,
      unmatchedCount: 0
    },
    {
      month: "2026-02",
      forecastMinor: 15000,
      actualMinor: 16000,
      varianceMinor: 1000,
      unmatchedActualMinor: 1000,
      unmatchedCount: 1
    },
    {
      month: "2026-03",
      forecastMinor: 15000,
      actualMinor: 15000,
      varianceMinor: 0,
      unmatchedActualMinor: 0,
      unmatchedCount: 0
    }
  ],
  renewals: [{ month: "2026-05", count: 1 }],
  growth: [
    { month: "2026-01", forecastMinor: 10000, growthPct: null },
    { month: "2026-02", forecastMinor: 15000, growthPct: 50 },
    { month: "2026-03", forecastMinor: 15000, growthPct: 0 }
  ],
  taggingCompleteness: {
    totalExpenseLines: 2,
    taggedExpenseLines: 1,
    completenessRatio: 0.5
  },
  replacementStatus: {
    totalPlans: 2,
    replacementRequiredOpen: 1,
    byStatus: [
      { status: "approved", count: 1 },
      { status: "reviewed", count: 1 }
    ]
  },
  narrativeBlocks: [
    { id: "n1", title: "Summary", body: "..." }
  ]
};

describe("reporting helpers", () => {
  it("keeps chart totals aligned with source dataset totals", () => {
    const totals = computeDashboardTotals(fixtureDataset);
    expect(totals).toEqual({
      forecastMinor: 40000,
      actualMinor: 41000,
      varianceMinor: 1000
    });
  });

  it("exposes stale forecast indicator when forecast is outdated", () => {
    const stale = {
      ...fixtureDataset,
      staleForecast: true
    };
    expect(getForecastStaleIndicator(stale)).toContain("stale");
    expect(getForecastStaleIndicator(fixtureDataset)).toBeNull();
  });
});
