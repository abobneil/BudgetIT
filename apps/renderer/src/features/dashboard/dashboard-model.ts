import {
  computeDashboardTotals,
  getForecastStaleIndicator,
  type DashboardDataset
} from "../../reporting";
import {
  readStoredJson,
  resolveBrowserStorage,
  writeStoredJson
} from "../../lib/browserStorage";
import { DASHBOARD_LAYOUT_STORAGE_KEY } from "../../lib/machineLocalState";

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

export type DashboardCardId =
  | "kpi-forecast"
  | "kpi-actual"
  | "kpi-variance"
  | "kpi-renewals"
  | "kpi-tagging"
  | "kpi-replacement"
  | "chart-spend-trend"
  | "chart-variance"
  | "chart-renewals"
  | "chart-growth"
  | "chart-replacement-status"
  | "insight-narrative";

export type DashboardCardDefinition = {
  id: DashboardCardId;
  title: string;
  defaultSectionId: string;
};

export type DashboardLayoutSection = {
  id: string;
  name: string;
};

export type DashboardLayoutCard = {
  id: DashboardCardId;
  sectionId: string;
  visible: boolean;
};

export type DashboardLayout = {
  sections: DashboardLayoutSection[];
  cards: DashboardLayoutCard[];
};

export type DashboardCardMoveDirection = "up" | "down";

export const DASHBOARD_DEFAULT_SECTIONS: DashboardLayoutSection[] = [
  { id: "section-financial", name: "Financial" },
  { id: "section-operations", name: "Operations" },
  { id: "section-governance", name: "Governance" }
];

export const DASHBOARD_CARD_DEFINITIONS: DashboardCardDefinition[] = [
  { id: "kpi-forecast", title: "Forecast", defaultSectionId: "section-financial" },
  { id: "kpi-actual", title: "Actual", defaultSectionId: "section-financial" },
  { id: "kpi-variance", title: "Variance", defaultSectionId: "section-financial" },
  { id: "chart-spend-trend", title: "Spend Trend", defaultSectionId: "section-financial" },
  { id: "chart-variance", title: "Variance Trend", defaultSectionId: "section-financial" },
  { id: "chart-growth", title: "Growth Trend", defaultSectionId: "section-financial" },
  { id: "kpi-renewals", title: "Renewals (Upcoming)", defaultSectionId: "section-operations" },
  { id: "kpi-replacement", title: "Replacement Required", defaultSectionId: "section-operations" },
  { id: "chart-renewals", title: "Renewals Timeline", defaultSectionId: "section-operations" },
  {
    id: "chart-replacement-status",
    title: "Replacement Status Breakdown",
    defaultSectionId: "section-operations"
  },
  {
    id: "kpi-tagging",
    title: "Tagging Completeness",
    defaultSectionId: "section-governance"
  },
  { id: "insight-narrative", title: "Narrative Insights", defaultSectionId: "section-governance" }
];

const DASHBOARD_CARD_ID_SET = new Set<DashboardCardId>(
  DASHBOARD_CARD_DEFINITIONS.map((entry) => entry.id)
);

export const DASHBOARD_CARD_DEFINITION_MAP = Object.fromEntries(
  DASHBOARD_CARD_DEFINITIONS.map((definition) => [definition.id, definition])
) as Record<DashboardCardId, DashboardCardDefinition>;

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

function getStorage(
  storage: Pick<Storage, "getItem" | "setItem"> | null | undefined = undefined
): Pick<Storage, "getItem" | "setItem"> | null {
  return resolveBrowserStorage(storage) as Pick<Storage, "getItem" | "setItem"> | null;
}

function normalizeSections(value: unknown): DashboardLayoutSection[] {
  const seen = new Set<string>();
  const normalized: DashboardLayoutSection[] = [];

  if (Array.isArray(value)) {
    for (const entry of value) {
      if (!entry || typeof entry !== "object") {
        continue;
      }
      const raw = entry as { id?: unknown; name?: unknown };
      if (typeof raw.id !== "string" || raw.id.trim().length === 0) {
        continue;
      }
      const id = raw.id.trim();
      if (seen.has(id)) {
        continue;
      }
      seen.add(id);
      normalized.push({
        id,
        name: typeof raw.name === "string" && raw.name.trim().length > 0 ? raw.name.trim() : id
      });
    }
  }

  for (const fallbackSection of DASHBOARD_DEFAULT_SECTIONS) {
    if (seen.has(fallbackSection.id)) {
      continue;
    }
    seen.add(fallbackSection.id);
    normalized.push(fallbackSection);
  }

  return normalized;
}

function normalizeCardOrder(value: unknown): DashboardCardId[] {
  const ordered: DashboardCardId[] = [];
  const seen = new Set<DashboardCardId>();

  if (Array.isArray(value)) {
    for (const entry of value) {
      if (!entry || typeof entry !== "object") {
        continue;
      }
      const raw = entry as { id?: unknown };
      if (typeof raw.id !== "string" || !DASHBOARD_CARD_ID_SET.has(raw.id as DashboardCardId)) {
        continue;
      }
      const id = raw.id as DashboardCardId;
      if (seen.has(id)) {
        continue;
      }
      seen.add(id);
      ordered.push(id);
    }
  }

  for (const definition of DASHBOARD_CARD_DEFINITIONS) {
    if (seen.has(definition.id)) {
      continue;
    }
    seen.add(definition.id);
    ordered.push(definition.id);
  }

  return ordered;
}

function parseCardVisibility(value: unknown, cardId: DashboardCardId): boolean {
  if (!Array.isArray(value)) {
    return true;
  }
  const entry = value.find((raw) => {
    if (!raw || typeof raw !== "object") {
      return false;
    }
    return (raw as { id?: unknown }).id === cardId;
  });
  if (!entry || typeof entry !== "object") {
    return true;
  }
  const visible = (entry as { visible?: unknown }).visible;
  return typeof visible === "boolean" ? visible : true;
}

function parseCardSection(
  value: unknown,
  cardId: DashboardCardId,
  availableSectionIds: Set<string>
): string {
  const fallback = DASHBOARD_CARD_DEFINITION_MAP[cardId].defaultSectionId;
  if (!Array.isArray(value)) {
    return availableSectionIds.has(fallback) ? fallback : DASHBOARD_DEFAULT_SECTIONS[0].id;
  }
  const entry = value.find((raw) => {
    if (!raw || typeof raw !== "object") {
      return false;
    }
    return (raw as { id?: unknown }).id === cardId;
  });
  if (!entry || typeof entry !== "object") {
    return availableSectionIds.has(fallback) ? fallback : DASHBOARD_DEFAULT_SECTIONS[0].id;
  }
  const sectionId = (entry as { sectionId?: unknown }).sectionId;
  if (typeof sectionId === "string" && availableSectionIds.has(sectionId)) {
    return sectionId;
  }
  return availableSectionIds.has(fallback) ? fallback : DASHBOARD_DEFAULT_SECTIONS[0].id;
}

export function createDefaultDashboardLayout(): DashboardLayout {
  return {
    sections: [...DASHBOARD_DEFAULT_SECTIONS],
    cards: DASHBOARD_CARD_DEFINITIONS.map((definition) => ({
      id: definition.id,
      sectionId: definition.defaultSectionId,
      visible: true
    }))
  };
}

export function normalizeDashboardLayout(value: unknown): DashboardLayout {
  if (!value || typeof value !== "object") {
    return createDefaultDashboardLayout();
  }

  const raw = value as { sections?: unknown; cards?: unknown };
  const sections = normalizeSections(raw.sections);
  const sectionIdSet = new Set(sections.map((section) => section.id));
  const orderedCardIds = normalizeCardOrder(raw.cards);
  const cards = orderedCardIds.map((cardId) => ({
    id: cardId,
    sectionId: parseCardSection(raw.cards, cardId, sectionIdSet),
    visible: parseCardVisibility(raw.cards, cardId)
  }));

  return {
    sections,
    cards
  };
}

export function loadDashboardLayout(
  storage: Pick<Storage, "getItem" | "setItem"> | null | undefined = getStorage()
): DashboardLayout {
  const resolvedStorage = getStorage(storage);
  if (!resolvedStorage) {
    return createDefaultDashboardLayout();
  }
  const parsed = readStoredJson<unknown>(resolvedStorage, DASHBOARD_LAYOUT_STORAGE_KEY);
  if (parsed === null) {
    return createDefaultDashboardLayout();
  }
  return normalizeDashboardLayout(parsed);
}

export function saveDashboardLayout(
  layout: DashboardLayout,
  storage: Pick<Storage, "getItem" | "setItem"> | null | undefined = getStorage()
): DashboardLayout {
  const normalized = normalizeDashboardLayout(layout);
  const resolvedStorage = getStorage(storage);
  if (!resolvedStorage) {
    return normalized;
  }
  writeStoredJson(resolvedStorage, DASHBOARD_LAYOUT_STORAGE_KEY, normalized);
  return normalized;
}

export function updateDashboardCardVisibility(
  layout: DashboardLayout,
  cardId: DashboardCardId,
  visible: boolean
): DashboardLayout {
  return {
    ...layout,
    cards: layout.cards.map((card) => (card.id === cardId ? { ...card, visible } : card))
  };
}

export function assignDashboardCardSection(
  layout: DashboardLayout,
  cardId: DashboardCardId,
  sectionId: string
): DashboardLayout {
  if (!layout.sections.some((section) => section.id === sectionId)) {
    return layout;
  }
  return {
    ...layout,
    cards: layout.cards.map((card) => (card.id === cardId ? { ...card, sectionId } : card))
  };
}

export function moveDashboardCard(
  layout: DashboardLayout,
  cardId: DashboardCardId,
  direction: DashboardCardMoveDirection
): DashboardLayout {
  const index = layout.cards.findIndex((card) => card.id === cardId);
  if (index < 0) {
    return layout;
  }
  const nextIndex = direction === "up" ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= layout.cards.length) {
    return layout;
  }

  const cards = [...layout.cards];
  const [entry] = cards.splice(index, 1);
  cards.splice(nextIndex, 0, entry);
  return {
    ...layout,
    cards
  };
}

export function addDashboardLayoutSection(
  layout: DashboardLayout,
  sectionName: string
): DashboardLayout {
  const trimmedName = sectionName.trim();
  if (trimmedName.length === 0) {
    return layout;
  }

  const slug = trimmedName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const idBase = `section-${slug || "group"}`;
  let candidateId = idBase;
  let suffix = 2;
  while (layout.sections.some((section) => section.id === candidateId)) {
    candidateId = `${idBase}-${suffix}`;
    suffix += 1;
  }

  return {
    ...layout,
    sections: [...layout.sections, { id: candidateId, name: trimmedName }]
  };
}
