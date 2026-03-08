import {
  readStoredJson,
  resolveBrowserStorage,
  writeStoredJson
} from "../../lib/browserStorage";
import { getNlqHistoryStorageKey } from "../../lib/machineLocalState";

export type NlqHistoryEntry = {
  query: string;
  lastRunAt: string;
  runCount: number;
};

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
  const parsed = readStoredJson<unknown[]>(storage, getNlqHistoryStorageKey(profileId));
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.filter(isHistoryEntry);
}

export function persistNlqHistory(
  profileId: string,
  history: NlqHistoryEntry[],
  storage: Pick<Storage, "setItem"> | null | undefined = getStorage()
): void {
  if (!storage) {
    return;
  }
  writeStoredJson(storage, getNlqHistoryStorageKey(profileId), history);
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function getStorage(): Storage | null {
  return resolveBrowserStorage();
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
