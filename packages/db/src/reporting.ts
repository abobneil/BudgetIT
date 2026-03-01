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
  currency: string;
  staleForecast: boolean;
  spendTrend: SpendTrendRow[];
  renewals: RenewalRow[];
  growth: GrowthRow[];
  variance: MonthlyVarianceRow[];
  taggingCompleteness: TaggingCompleteness;
  replacementStatus: ReplacementStatusSummary;
  narrativeBlocks: NarrativeBlock[];
};

export type ReportPresetQuery =
  | "dashboard.summary"
  | "renewals.timeline"
  | "spend.byTag"
  | "spend.byVendor"
  | "replacement.pipeline"
  | "tagging.completeness"
  | "nlq.saved";

export type ReportDatasetFilters = {
  dateFrom?: string;
  dateTo?: string;
  tag?: string;
};

type TagSpendBreakdownRow = {
  tagName: string;
  totalMinor: number;
};

type VendorSpendBreakdownRow = {
  vendorName: string;
  totalMinor: number;
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

function toMonthToken(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  if (/^\d{4}-\d{2}$/.test(value)) {
    return value;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value.slice(0, 7);
  }
  return null;
}

function monthWithinRange(month: string, fromMonth: string | null, toMonth: string | null): boolean {
  if (fromMonth && month < fromMonth) {
    return false;
  }
  if (toMonth && month > toMonth) {
    return false;
  }
  return true;
}

function applyMonthlyFilters(
  dataset: DashboardDataset,
  filters: ReportDatasetFilters | undefined
): DashboardDataset {
  if (!filters) {
    return dataset;
  }

  const fromMonth = toMonthToken(filters.dateFrom);
  const toMonth = toMonthToken(filters.dateTo);
  if (!fromMonth && !toMonth) {
    return dataset;
  }

  return {
    ...dataset,
    spendTrend: dataset.spendTrend.filter((row) => monthWithinRange(row.month, fromMonth, toMonth)),
    variance: dataset.variance.filter((row) => monthWithinRange(row.month, fromMonth, toMonth)),
    renewals: dataset.renewals.filter((row) => monthWithinRange(row.month, fromMonth, toMonth)),
    growth: dataset.growth.filter((row) => monthWithinRange(row.month, fromMonth, toMonth))
  };
}

function withNarrative(dataset: DashboardDataset, block: NarrativeBlock): DashboardDataset {
  return {
    ...dataset,
    narrativeBlocks: [block, ...dataset.narrativeBlocks]
  };
}

function normalizeTagFilter(tag: string | undefined): string | null {
  if (!tag) {
    return null;
  }
  const normalized = tag.trim().toLowerCase();
  if (normalized.length === 0 || normalized === "all") {
    return null;
  }
  return normalized;
}

function getScenarioCurrency(db: Database.Database, scenarioId: string): string {
  const row = db
    .prepare(
      `
        SELECT default_currency AS defaultCurrency
        FROM scenario_settings
        WHERE scenario_id = ?
      `
    )
    .get(scenarioId) as { defaultCurrency: string | null } | undefined;
  const candidate = row?.defaultCurrency?.trim().toUpperCase();
  return candidate && /^[A-Z]{3}$/.test(candidate) ? candidate : "USD";
}

function formatMinorWithCurrencyCode(value: number, currency: string): string {
  return `${currency} ${(value / 100).toFixed(2)}`;
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

function queryTagSpendBreakdown(
  db: Database.Database,
  scenarioId: string,
  tagFilter: string | null
): TagSpendBreakdownRow[] {
  const rows = db
    .prepare(
      `
        SELECT
          tg.name AS tagName,
          SUM(e.amount_minor) AS totalMinor
        FROM expense_line e
        JOIN tag_assignment ta
          ON ta.entity_type = 'expense_line'
         AND ta.entity_id = e.id
        JOIN tag tg ON tg.id = ta.tag_id
        WHERE e.scenario_id = ?
          AND e.deleted_at IS NULL
          AND (? IS NULL OR lower(tg.name) = ?)
        GROUP BY tg.id, tg.name
        ORDER BY totalMinor DESC, tg.name ASC
      `
    )
    .all(scenarioId, tagFilter, tagFilter) as Array<{
    tagName: string;
    totalMinor: number;
  }>;

  return rows.map((row) => ({
    tagName: row.tagName,
    totalMinor: row.totalMinor ?? 0
  }));
}

function queryVendorSpendBreakdown(
  db: Database.Database,
  scenarioId: string
): VendorSpendBreakdownRow[] {
  const rows = db
    .prepare(
      `
        SELECT
          v.name AS vendorName,
          SUM(e.amount_minor) AS totalMinor
        FROM vendor v
        JOIN service s ON s.vendor_id = v.id
        JOIN expense_line e ON e.service_id = s.id
        WHERE e.scenario_id = ?
          AND v.deleted_at IS NULL
          AND s.deleted_at IS NULL
          AND e.deleted_at IS NULL
        GROUP BY v.id, v.name
        ORDER BY totalMinor DESC, v.name ASC
      `
    )
    .all(scenarioId) as Array<{
    vendorName: string;
    totalMinor: number;
  }>;

  return rows.map((row) => ({
    vendorName: row.vendorName,
    totalMinor: row.totalMinor ?? 0
  }));
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
  currency: string;
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
      body: `Forecast ${formatMinorWithCurrencyCode(totalForecast, input.currency)} vs actual ${formatMinorWithCurrencyCode(totalActual, input.currency)} (delta ${formatMinorWithCurrencyCode(delta, input.currency)}).`
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
  scenarioId: string = "baseline",
  filters?: ReportDatasetFilters
): DashboardDataset {
  const variance = buildMonthlyVarianceDataset(db, scenarioId);
  const spendTrend = buildSpendTrend(variance);
  const renewals = queryRenewals(db);
  const growth = buildGrowthSeries(spendTrend);
  const taggingCompleteness = queryTaggingCompleteness(db, scenarioId);
  const replacementStatus = queryReplacementStatus(db, scenarioId);
  const currency = getScenarioCurrency(db, scenarioId);
  const metaRow = db
    .prepare("SELECT forecast_stale FROM meta WHERE id = 1")
    .get() as { forecast_stale: number | null } | undefined;
  const staleForecast = (metaRow?.forecast_stale ?? 0) === 1;

  const base: DashboardDataset = {
    scenarioId,
    currency,
    staleForecast,
    spendTrend,
    renewals,
    growth,
    variance,
    taggingCompleteness,
    replacementStatus,
    narrativeBlocks: buildNarratives({
      currency,
      staleForecast,
      spendTrend,
      renewals,
      taggingCompleteness,
      replacementStatus
    })
  };

  return applyMonthlyFilters(base, filters);
}

export function buildRenewalsTimelineDataset(
  db: Database.Database,
  scenarioId: string = "baseline",
  filters?: ReportDatasetFilters
): DashboardDataset {
  const base = buildDashboardDataset(db, scenarioId, filters);
  const renewalCount = base.renewals.reduce((sum, row) => sum + row.count, 0);
  return withNarrative(base, {
    id: "renewals-timeline-focus",
    title: "Renewals Timeline Focus",
    body: `Renewals timeline view includes ${renewalCount} scheduled renewals in the active window.`
  });
}

export function buildSpendByTagDataset(
  db: Database.Database,
  scenarioId: string = "baseline",
  filters?: ReportDatasetFilters
): DashboardDataset {
  const base = buildDashboardDataset(db, scenarioId, filters);
  const tagFilter = normalizeTagFilter(filters?.tag);
  const breakdown = queryTagSpendBreakdown(db, scenarioId, tagFilter);
  const top = breakdown.slice(0, 3);
  const breakdownSummary =
    top.length === 0
      ? "No tag spend rows were found for the selected scope."
      : top
          .map((row) => `${row.tagName}: ${formatMinorWithCurrencyCode(row.totalMinor, base.currency)}`)
          .join("; ");

  return withNarrative(base, {
    id: "spend-by-tag-focus",
    title: "Spend by Tag Focus",
    body: breakdownSummary
  });
}

export function buildSpendByVendorDataset(
  db: Database.Database,
  scenarioId: string = "baseline",
  filters?: ReportDatasetFilters
): DashboardDataset {
  const base = buildDashboardDataset(db, scenarioId, filters);
  const top = queryVendorSpendBreakdown(db, scenarioId).slice(0, 3);
  const summary =
    top.length === 0
      ? "No vendor spend rows were found for the selected scope."
      : top
          .map((row) => `${row.vendorName}: ${formatMinorWithCurrencyCode(row.totalMinor, base.currency)}`)
          .join("; ");

  return withNarrative(base, {
    id: "spend-by-vendor-focus",
    title: "Spend by Vendor Focus",
    body: summary
  });
}

export function buildReplacementPipelineDataset(
  db: Database.Database,
  scenarioId: string = "baseline",
  filters?: ReportDatasetFilters
): DashboardDataset {
  const base = buildDashboardDataset(db, scenarioId, filters);
  return withNarrative(base, {
    id: "replacement-pipeline-focus",
    title: "Replacement Pipeline Focus",
    body: `${base.replacementStatus.replacementRequiredOpen} replacement-required plan(s) remain open.`
  });
}

export function buildTaggingCompletenessDataset(
  db: Database.Database,
  scenarioId: string = "baseline",
  filters?: ReportDatasetFilters
): DashboardDataset {
  const base = buildDashboardDataset(db, scenarioId, filters);
  return withNarrative(base, {
    id: "tagging-completeness-focus",
    title: "Tagging Completeness Focus",
    body: `${(base.taggingCompleteness.completenessRatio * 100).toFixed(1)}% of active expense lines are tagged.`
  });
}

export function buildReportPresetDataset(
  db: Database.Database,
  query: ReportPresetQuery,
  scenarioId: string = "baseline",
  filters?: ReportDatasetFilters
): DashboardDataset {
  if (query === "dashboard.summary" || query === "nlq.saved") {
    return buildDashboardDataset(db, scenarioId, filters);
  }
  if (query === "renewals.timeline") {
    return buildRenewalsTimelineDataset(db, scenarioId, filters);
  }
  if (query === "spend.byTag") {
    return buildSpendByTagDataset(db, scenarioId, filters);
  }
  if (query === "spend.byVendor") {
    return buildSpendByVendorDataset(db, scenarioId, filters);
  }
  if (query === "replacement.pipeline") {
    return buildReplacementPipelineDataset(db, scenarioId, filters);
  }
  return buildTaggingCompletenessDataset(db, scenarioId, filters);
}
