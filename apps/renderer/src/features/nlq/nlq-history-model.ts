export type NlqHistoryEntry = {
  query: string;
  lastRunAt: string;
  runCount: number;
};

const HISTORY_KEY_PREFIX = "budgetit.nlq-history.v1";

export function addNlqHistoryEntry(
  history: NlqHistoryEntry[],
  query: string,
  timestamp: string,
  maxEntries = 12
): NlqHistoryEntry[] {
  const normalized = normalizeQuery(query);
  const existing = history.find((entry) => normalizeQuery(entry.query) === normalized);
  const withoutCurrent = history.filter(
    (entry) => normalizeQuery(entry.query) !== normalized
  );

  const nextEntry: NlqHistoryEntry = existing
    ? {
        ...existing,
        query: query.trim(),
        lastRunAt: timestamp,
        runCount: existing.runCount + 1
      }
    : {
        query: query.trim(),
        lastRunAt: timestamp,
        runCount: 1
      };

  return [nextEntry, ...withoutCurrent].slice(0, maxEntries);
}

export function loadNlqHistory(
  profileId: string,
  storage: Pick<Storage, "getItem"> | null | undefined = getStorage()
): NlqHistoryEntry[] {
  if (!storage) {
    return [];
  }
  const raw = storage.getItem(historyKey(profileId));
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isHistoryEntry);
  } catch {
    return [];
  }
}

export function persistNlqHistory(
  profileId: string,
  history: NlqHistoryEntry[],
  storage: Pick<Storage, "setItem"> | null | undefined = getStorage()
): void {
  if (!storage) {
    return;
  }
  storage.setItem(historyKey(profileId), JSON.stringify(history));
}

function historyKey(profileId: string): string {
  return `${HISTORY_KEY_PREFIX}:${profileId}`;
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function getStorage(): Storage | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }
  return window.localStorage;
}

function isHistoryEntry(value: unknown): value is NlqHistoryEntry {
  if (!value || typeof value !== "object") {
    return false;
  }
  const input = value as Record<string, unknown>;
  return (
    typeof input.query === "string" &&
    typeof input.lastRunAt === "string" &&
    typeof input.runCount === "number"
  );
}
