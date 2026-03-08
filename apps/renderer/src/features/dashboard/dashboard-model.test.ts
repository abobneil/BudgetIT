import { describe, expect, it } from "vitest";

import { DASHBOARD_LAYOUT_STORAGE_KEY } from "../../lib/machineLocalState";
import type { DashboardDataset } from "../../reporting";
import {
  addDashboardLayoutSection,
  assignDashboardCardSection,
  buildDashboardKpiMetrics,
  createDefaultDashboardLayout,
  filterDashboardDatasetByRange,
  loadDashboardLayout,
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

  it("filters dashboard dataset to the selected monthly range", () => {
    const filtered = filterDashboardDatasetByRange(
      {
        ...fixtureDataset,
        spendTrend: [
          { month: "2025-11", forecastMinor: 4000, actualMinor: 4500 },
          { month: "2025-12", forecastMinor: 8000, actualMinor: 7800 },
          ...fixtureDataset.spendTrend
        ],
        variance: [
          {
            month: "2025-11",
            forecastMinor: 4000,
            actualMinor: 4500,
            varianceMinor: 500,
            unmatchedActualMinor: 0,
            unmatchedCount: 0
          },
          {
            month: "2025-12",
            forecastMinor: 8000,
            actualMinor: 7800,
            varianceMinor: -200,
            unmatchedActualMinor: 0,
            unmatchedCount: 0
          },
          ...fixtureDataset.variance
        ],
        renewals: [
          { month: "2025-12", count: 1 },
          ...fixtureDataset.renewals
        ],
        growth: [
          { month: "2025-11", forecastMinor: 4000, growthPct: null },
          { month: "2025-12", forecastMinor: 8000, growthPct: 100 },
          ...fixtureDataset.growth
        ]
      },
      "3m"
    );

    expect(filtered.spendTrend).toHaveLength(3);
    expect(filtered.spendTrend.map((row) => row.month)).toEqual([
      "2026-01",
      "2026-02",
      "2026-03"
    ]);
    expect(filtered.variance).toHaveLength(3);
    expect(filtered.growth).toHaveLength(3);
    expect(filtered.renewals).toHaveLength(3);
  });

  it("creates and persists a customizable dashboard layout with deterministic fallback", () => {
    const storage = {
      values: new Map<string, string>(),
      getItem(key: string) {
        return this.values.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        this.values.set(key, value);
      }
    };

    const defaults = createDefaultDashboardLayout();
    expect(defaults.cards.length).toBeGreaterThan(8);

    storage.setItem(DASHBOARD_LAYOUT_STORAGE_KEY, JSON.stringify(defaults));
    const loaded = loadDashboardLayout(storage);
    expect(loaded.cards).toHaveLength(defaults.cards.length);
    expect(loaded.sections.length).toBeGreaterThanOrEqual(3);

    storage.setItem(DASHBOARD_LAYOUT_STORAGE_KEY, "{broken-json");
    const fallback = loadDashboardLayout(storage);
    expect(fallback.cards).toHaveLength(defaults.cards.length);
  });

  it("supports grouping cards into custom sections", () => {
    const layout = createDefaultDashboardLayout();
    const withSection = addDashboardLayoutSection(layout, "Reliability");
    const reliabilitySection = withSection.sections.find((section) => section.name === "Reliability");

    expect(reliabilitySection).toBeDefined();
    if (!reliabilitySection) {
      throw new Error("Expected Reliability section to be created.");
    }

    const reassigned = assignDashboardCardSection(
      withSection,
      "chart-renewals",
      reliabilitySection.id
    );
    const renewalsCard = reassigned.cards.find((card) => card.id === "chart-renewals");
    expect(renewalsCard?.sectionId).toBe(reliabilitySection.id);
  });
});
