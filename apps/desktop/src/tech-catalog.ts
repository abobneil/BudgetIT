import fs from "node:fs";
import path from "node:path";

export const TECH_CATALOG_CATEGORY_VALUES = [
  "software_vendor",
  "hardware_vendor",
  "isp",
  "cellular_provider"
] as const;

export type TechCatalogCategory = (typeof TECH_CATALOG_CATEGORY_VALUES)[number];

export type TechCatalogEntry = {
  id: string;
  name: string;
  categories: TechCatalogCategory[];
  website: string | null;
  aliases: string[];
  notes: string | null;
};

export type TechCatalogDocument = {
  version: number;
  updatedAt: string;
  entries: TechCatalogEntry[];
};

type TechCatalogSnapshot = {
  sourceUrl: string;
  etag: string | null;
  checkedAt: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  hasRemoteData: boolean;
  catalog: TechCatalogDocument;
};

export type TechCatalogStatus = {
  sourceUrl: string;
  checkedAt: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  entryCount: number;
  catalogUpdatedAt: string;
  usingFallback: boolean;
  etag: string | null;
  countsByCategory: Record<TechCatalogCategory, number>;
};

type FetchLike = typeof fetch;

type TechCatalogSyncOptions = {
  cachePath: string;
  sourceUrl: string;
  fallbackCatalog: TechCatalogDocument;
  fetchImpl?: FetchLike;
  syncIntervalMs?: number;
  now?: () => Date;
  onWarning?: (message: string, details?: unknown) => void;
};

export const DEFAULT_TECH_CATALOG_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;

export const MINIMAL_TECH_CATALOG: TechCatalogDocument = {
  version: 1,
  updatedAt: "2026-03-09T00:00:00.000Z",
  entries: []
};

function isIsoTimestamp(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

function normalizeValue(value: string): string {
  return value.trim().toLowerCase();
}

function cloneCatalogDocument(document: TechCatalogDocument): TechCatalogDocument {
  return {
    version: document.version,
    updatedAt: document.updatedAt,
    entries: document.entries.map((entry) => ({
      id: entry.id,
      name: entry.name,
      categories: [...entry.categories],
      website: entry.website,
      aliases: [...entry.aliases],
      notes: entry.notes
    }))
  };
}

function createDefaultSnapshot(
  sourceUrl: string,
  fallbackCatalog: TechCatalogDocument
): TechCatalogSnapshot {
  return {
    sourceUrl,
    etag: null,
    checkedAt: null,
    lastSyncedAt: null,
    lastError: null,
    hasRemoteData: false,
    catalog: cloneCatalogDocument(fallbackCatalog)
  };
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseOptionalNullableString(value: unknown, fieldName: string): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string or null.`);
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseAliases(value: unknown, fieldName: string): string[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array of strings.`);
  }

  const seen = new Set<string>();
  const aliases: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new Error(`${fieldName} must contain only non-empty strings.`);
    }
    const trimmed = entry.trim();
    const normalized = normalizeValue(trimmed);
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    aliases.push(trimmed);
  }
  return aliases;
}

function parseCategories(value: unknown, fieldName: string): TechCatalogCategory[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${fieldName} must be a non-empty array.`);
  }

  const seen = new Set<TechCatalogCategory>();
  const categories: TechCatalogCategory[] = [];
  for (const entry of value) {
    if (
      typeof entry !== "string" ||
      !TECH_CATALOG_CATEGORY_VALUES.includes(entry as TechCatalogCategory)
    ) {
      throw new Error(`${fieldName} contains an unsupported category.`);
    }
    const category = entry as TechCatalogCategory;
    if (seen.has(category)) {
      continue;
    }
    seen.add(category);
    categories.push(category);
  }

  return categories;
}

export function parseTechCatalogDocument(payload: unknown): TechCatalogDocument {
  if (!payload || typeof payload !== "object") {
    throw new Error("Tech catalog must be an object.");
  }

  const value = payload as {
    version?: unknown;
    updatedAt?: unknown;
    entries?: unknown;
  };

  if (
    typeof value.version !== "number" ||
    !Number.isInteger(value.version) ||
    value.version <= 0
  ) {
    throw new Error("Tech catalog version must be a positive integer.");
  }
  if (typeof value.updatedAt !== "string" || !isIsoTimestamp(value.updatedAt)) {
    throw new Error("Tech catalog updatedAt must be an ISO timestamp.");
  }
  if (!Array.isArray(value.entries)) {
    throw new Error("Tech catalog entries must be an array.");
  }

  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const entries = value.entries.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`Tech catalog entry ${index} must be an object.`);
    }

    const item = entry as {
      id?: unknown;
      name?: unknown;
      categories?: unknown;
      website?: unknown;
      aliases?: unknown;
      notes?: unknown;
    };

    if (typeof item.id !== "string" || item.id.trim().length === 0) {
      throw new Error(`Tech catalog entry ${index} requires a non-empty id.`);
    }
    if (typeof item.name !== "string" || item.name.trim().length === 0) {
      throw new Error(`Tech catalog entry ${index} requires a non-empty name.`);
    }

    const id = item.id.trim();
    const name = item.name.trim();
    const normalizedId = normalizeValue(id);
    const normalizedName = normalizeValue(name);
    if (seenIds.has(normalizedId)) {
      throw new Error(`Tech catalog contains duplicate id: ${id}`);
    }
    if (seenNames.has(normalizedName)) {
      throw new Error(`Tech catalog contains duplicate name: ${name}`);
    }
    seenIds.add(normalizedId);
    seenNames.add(normalizedName);

    const aliases = parseAliases(item.aliases, `Tech catalog entry ${id} aliases`).filter(
      (alias) => normalizeValue(alias) !== normalizedName
    );
    const website = parseOptionalNullableString(
      item.website,
      `Tech catalog entry ${id} website`
    );
    if (website && !/^https?:\/\//i.test(website)) {
      throw new Error(`Tech catalog entry ${id} website must start with http:// or https://.`);
    }

    return {
      id,
      name,
      categories: parseCategories(item.categories, `Tech catalog entry ${id} categories`),
      website,
      aliases,
      notes: parseOptionalNullableString(item.notes, `Tech catalog entry ${id} notes`)
    } satisfies TechCatalogEntry;
  });

  return {
    version: value.version,
    updatedAt: value.updatedAt,
    entries
  };
}

export function loadTechCatalogDocumentFromFile(filePath: string): TechCatalogDocument {
  const raw = fs.readFileSync(filePath, "utf8");
  return parseTechCatalogDocument(JSON.parse(raw));
}

function readSnapshotFromDisk(
  cachePath: string,
  sourceUrl: string,
  fallbackCatalog: TechCatalogDocument,
  onWarning?: (message: string, details?: unknown) => void
): TechCatalogSnapshot {
  if (!fs.existsSync(cachePath)) {
    return createDefaultSnapshot(sourceUrl, fallbackCatalog);
  }

  try {
    const raw = fs.readFileSync(cachePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<TechCatalogSnapshot>;
    const source =
      typeof parsed.sourceUrl === "string" && parsed.sourceUrl.trim().length > 0
        ? parsed.sourceUrl
        : sourceUrl;
    const etag =
      typeof parsed.etag === "string" && parsed.etag.trim().length > 0
        ? parsed.etag
        : null;
    const checkedAt =
      typeof parsed.checkedAt === "string" && isIsoTimestamp(parsed.checkedAt)
        ? parsed.checkedAt
        : null;
    const lastSyncedAt =
      typeof parsed.lastSyncedAt === "string" && isIsoTimestamp(parsed.lastSyncedAt)
        ? parsed.lastSyncedAt
        : null;
    const lastError =
      typeof parsed.lastError === "string" && parsed.lastError.trim().length > 0
        ? parsed.lastError
        : null;
    const hasRemoteData = parsed.hasRemoteData === true;
    const catalog = parsed.catalog
      ? parseTechCatalogDocument(parsed.catalog)
      : cloneCatalogDocument(fallbackCatalog);
    return {
      sourceUrl: source,
      etag,
      checkedAt,
      lastSyncedAt,
      lastError,
      hasRemoteData,
      catalog
    };
  } catch (error) {
    onWarning?.("Failed to read cached tech catalog; falling back to embedded catalog.", error);
    return createDefaultSnapshot(sourceUrl, fallbackCatalog);
  }
}

function writeSnapshotToDisk(cachePath: string, snapshot: TechCatalogSnapshot): void {
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(snapshot, null, 2), "utf8");
}

function buildCountsByCategory(
  catalog: TechCatalogDocument
): Record<TechCatalogCategory, number> {
  const counts = Object.fromEntries(
    TECH_CATALOG_CATEGORY_VALUES.map((category) => [category, 0])
  ) as Record<TechCatalogCategory, number>;

  for (const entry of catalog.entries) {
    for (const category of entry.categories) {
      counts[category] += 1;
    }
  }

  return counts;
}

function isSyncDue(
  checkedAt: string | null,
  intervalMs: number,
  now: Date
): boolean {
  if (!checkedAt) {
    return true;
  }
  const checkedAtMs = Date.parse(checkedAt);
  if (Number.isNaN(checkedAtMs)) {
    return true;
  }
  return now.getTime() - checkedAtMs >= intervalMs;
}

export class TechCatalogSync {
  private readonly cachePath: string;
  private readonly fallbackCatalog: TechCatalogDocument;
  private readonly fetchImpl: FetchLike;
  private readonly sourceUrl: string;
  private readonly syncIntervalMs: number;
  private readonly now: () => Date;
  private readonly onWarning?: (message: string, details?: unknown) => void;
  private snapshot: TechCatalogSnapshot;
  private inFlight: Promise<TechCatalogStatus> | null = null;

  constructor(options: TechCatalogSyncOptions) {
    this.cachePath = options.cachePath;
    this.sourceUrl = options.sourceUrl;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.syncIntervalMs =
      options.syncIntervalMs ?? DEFAULT_TECH_CATALOG_SYNC_INTERVAL_MS;
    this.now = options.now ?? (() => new Date());
    this.onWarning = options.onWarning;
    this.fallbackCatalog = cloneCatalogDocument(options.fallbackCatalog);
    this.snapshot = readSnapshotFromDisk(
      this.cachePath,
      this.sourceUrl,
      this.fallbackCatalog,
      this.onWarning
    );
  }

  listEntries(): TechCatalogEntry[] {
    return this.snapshot.catalog.entries.map((entry) => ({
      id: entry.id,
      name: entry.name,
      categories: [...entry.categories],
      website: entry.website,
      aliases: [...entry.aliases],
      notes: entry.notes
    }));
  }

  getStatus(): TechCatalogStatus {
    return {
      sourceUrl: this.snapshot.sourceUrl,
      checkedAt: this.snapshot.checkedAt,
      lastSyncedAt: this.snapshot.lastSyncedAt,
      lastError: this.snapshot.lastError,
      entryCount: this.snapshot.catalog.entries.length,
      catalogUpdatedAt: this.snapshot.catalog.updatedAt,
      usingFallback: !this.snapshot.hasRemoteData,
      etag: this.snapshot.etag,
      countsByCategory: buildCountsByCategory(this.snapshot.catalog)
    };
  }

  async syncIfDue(): Promise<TechCatalogStatus> {
    if (!isSyncDue(this.snapshot.checkedAt, this.syncIntervalMs, this.now())) {
      return this.getStatus();
    }
    return this.syncNow(false);
  }

  async syncNow(force = true): Promise<TechCatalogStatus> {
    if (this.inFlight) {
      return this.inFlight;
    }

    this.inFlight = this.performSync(force).finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async performSync(force: boolean): Promise<TechCatalogStatus> {
    const now = this.now();
    if (
      !force &&
      !isSyncDue(this.snapshot.checkedAt, this.syncIntervalMs, now)
    ) {
      return this.getStatus();
    }

    try {
      const headers = new Headers({
        Accept: "application/json"
      });
      if (this.snapshot.etag) {
        headers.set("If-None-Match", this.snapshot.etag);
      }

      const response = await this.fetchImpl(this.sourceUrl, {
        method: "GET",
        headers,
        cache: "no-store"
      });

      const checkedAt = now.toISOString();
      if (response.status === 304) {
        this.snapshot = {
          ...this.snapshot,
          checkedAt,
          lastError: null
        };
        writeSnapshotToDisk(this.cachePath, this.snapshot);
        return this.getStatus();
      }

      if (!response.ok) {
        throw new Error(
          `Tech catalog sync failed with ${response.status} ${response.statusText}`.trim()
        );
      }

      const catalog = parseTechCatalogDocument(await response.json());
      this.snapshot = {
        sourceUrl: this.sourceUrl,
        etag: response.headers.get("etag"),
        checkedAt,
        lastSyncedAt: checkedAt,
        lastError: null,
        hasRemoteData: true,
        catalog
      };
      writeSnapshotToDisk(this.cachePath, this.snapshot);
      return this.getStatus();
    } catch (error) {
      this.snapshot = {
        ...this.snapshot,
        checkedAt: now.toISOString(),
        lastError: toErrorMessage(error)
      };
      writeSnapshotToDisk(this.cachePath, this.snapshot);
      this.onWarning?.("Tech catalog sync failed.", error);
      return this.getStatus();
    }
  }
}
