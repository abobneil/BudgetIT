export type ReportPreset = {
  id: string;
  title: string;
  description: string;
  query: string;
  visualizations: {
    table: boolean;
    chart: boolean;
    gauge: boolean;
    narrative: boolean;
  };
};

const SAVED_REPORTS_KEY = "budgetit.saved-report-presets.v1";

export const DEFAULT_REPORT_PRESETS: ReportPreset[] = [
  {
    id: "dashboard-overview",
    title: "Dashboard Overview",
    description: "Executive summary of spend, renewals, and replacement health.",
    query: "dashboard.summary",
    visualizations: { table: true, chart: true, gauge: true, narrative: true }
  },
  {
    id: "renewals-pipeline",
    title: "Renewals Pipeline",
    description: "Upcoming renewals and notice windows grouped by month.",
    query: "renewals.timeline",
    visualizations: { table: true, chart: true, gauge: false, narrative: true }
  },
  {
    id: "spend-by-tag",
    title: "Spend by Tag",
    description: "Spend distribution by required dimensions and tags.",
    query: "spend.byTag",
    visualizations: { table: true, chart: true, gauge: false, narrative: false }
  },
  {
    id: "spend-by-vendor",
    title: "Spend by Vendor",
    description: "Vendor concentration and trend breakdown.",
    query: "spend.byVendor",
    visualizations: { table: true, chart: true, gauge: true, narrative: false }
  },
  {
    id: "replacement-pipeline",
    title: "Replacement Pipeline",
    description: "Replacement required pipeline and plan progression.",
    query: "replacement.pipeline",
    visualizations: { table: true, chart: false, gauge: true, narrative: true }
  },
  {
    id: "tagging-completeness",
    title: "Tagging Completeness",
    description: "Tag coverage and required-dimension completion.",
    query: "tagging.completeness",
    visualizations: { table: true, chart: false, gauge: true, narrative: true }
  }
];

export function serializeReportPreset(preset: ReportPreset): string {
  return JSON.stringify(preset);
}

export function deserializeReportPreset(raw: string): ReportPreset | null {
  try {
    const parsed = JSON.parse(raw) as ReportPreset;
    return isReportPreset(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function loadSavedReportPresets(
  storage: Pick<Storage, "getItem"> | null | undefined = getStorage()
): ReportPreset[] {
  if (!storage) {
    return [];
  }
  const raw = storage.getItem(SAVED_REPORTS_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isReportPreset);
  } catch {
    return [];
  }
}

export function saveReportPreset(
  preset: ReportPreset,
  storage: Pick<Storage, "getItem" | "setItem"> | null | undefined = getStorage()
): ReportPreset[] {
  if (!storage) {
    return [preset];
  }
  const existing = loadSavedReportPresets(storage);
  const next = mergeReportPreset(existing, preset);
  storage.setItem(SAVED_REPORTS_KEY, JSON.stringify(next));
  return next;
}

function mergeReportPreset(existing: ReportPreset[], preset: ReportPreset): ReportPreset[] {
  const withoutMatch = existing.filter((entry) => entry.id !== preset.id);
  return [...withoutMatch, preset];
}

function getStorage(): Storage | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }
  return window.localStorage;
}

function isReportPreset(value: unknown): value is ReportPreset {
  if (!value || typeof value !== "object") {
    return false;
  }
  const input = value as Record<string, unknown>;
  const viz = input.visualizations as Record<string, unknown> | undefined;
  return (
    typeof input.id === "string" &&
    typeof input.title === "string" &&
    typeof input.description === "string" &&
    typeof input.query === "string" &&
    viz !== undefined &&
    typeof viz.table === "boolean" &&
    typeof viz.chart === "boolean" &&
    typeof viz.gauge === "boolean" &&
    typeof viz.narrative === "boolean"
  );
}
