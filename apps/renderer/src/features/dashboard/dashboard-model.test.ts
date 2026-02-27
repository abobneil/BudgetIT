import { describe, expect, it } from "vitest";

import type { DashboardDataset } from "../../reporting";
import {
  buildDashboardKpiMetrics,
  mapDashboardStaleState
} from "./dashboard-model";

const fixtureDataset: DashboardDataset = {
  scenarioId: "baseline",
  staleForecast: false,
  spendTrend: [
    { month: "2026-01", forecastMinor: 10000, actualMinor: 11000 },
    { month: "2026-02", forecastMinor: 15000, actualMinor: 14000 },
    { month: "2026-03", forecastMinor: 5000, actualMinor: 7000 }
  ],
  variance: [
    {
      month: "2026-01",
      forecastMinor: 10000,
      actualMinor: 11000,
      varianceMinor: 1000,
      unmatchedActualMinor: 0,
      unmatchedCount: 0
    },
    {
      month: "2026-02",
      forecastMinor: 15000,
      actualMinor: 14000,
      varianceMinor: -1000,
      unmatchedActualMinor: 0,
      unmatchedCount: 0
    },
    {
      month: "2026-03",
      forecastMinor: 5000,
      actualMinor: 7000,
      varianceMinor: 2000,
      unmatchedActualMinor: 500,
      unmatchedCount: 1
    }
  ],
  renewals: [
    { month: "2026-04", count: 2 },
    { month: "2026-05", count: 1 }
  ],
  growth: [
    { month: "2026-01", forecastMinor: 10000, growthPct: null },
    { month: "2026-02", forecastMinor: 15000, growthPct: 50 },
    { month: "2026-03", forecastMinor: 5000, growthPct: -66.7 }
  ],
  taggingCompleteness: {
    totalExpenseLines: 10,
    taggedExpenseLines: 8,
    completenessRatio: 0.8
  },
  replacementStatus: {
    totalPlans: 5,
    replacementRequiredOpen: 2,
    byStatus: [{ status: "draft", count: 5 }]
  },
  narrativeBlocks: [{ id: "summary", title: "Summary", body: "..." }]
};

describe("dashboard model", () => {
  it("calculates KPI metrics from dataset fixtures", () => {
    const metrics = buildDashboardKpiMetrics(fixtureDataset);
    expect(metrics).toEqual({
      forecastMinor: 30000,
      actualMinor: 32000,
      varianceMinor: 2000,
      renewalCount: 3,
      taggingCompletenessPct: 80,
      replacementRequiredOpen: 2
    });
  });

  it("maps stale state to a visible warning message", () => {
    const staleState = mapDashboardStaleState({
      ...fixtureDataset,
      staleForecast: true
    });

    expect(staleState.isStale).toBe(true);
    expect(staleState.message).toContain("stale");
  });
});
