import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  TechCatalogSync,
  parseTechCatalogDocument,
  type TechCatalogDocument
} from "./tech-catalog";

function makeTempCachePath(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "budgetit-tech-catalog-"));
  return path.join(root, "tech-catalog-cache.json");
}

function buildCatalog(updatedAt: string, names: string[]): TechCatalogDocument {
  return {
    version: 1,
    updatedAt,
    entries: names.map((name, index) => ({
      id: `entry-${index + 1}`,
      name,
      categories: ["software_vendor"],
      website: null,
      aliases: [],
      notes: null
    }))
  };
}

describe("tech catalog parsing", () => {
  it("rejects duplicate provider names", () => {
    expect(() =>
      parseTechCatalogDocument({
        version: 1,
        updatedAt: "2026-03-09T00:00:00.000Z",
        entries: [
          {
            id: "provider-1",
            name: "Acme",
            categories: ["software_vendor"]
          },
          {
            id: "provider-2",
            name: "acme",
            categories: ["isp"]
          }
        ]
      })
    ).toThrow(/duplicate name/i);
  });
});

describe("TechCatalogSync", () => {
  it("hydrates from fallback data and persists successful remote sync results", async () => {
    const cachePath = makeTempCachePath();
    let nowMs = Date.parse("2026-03-09T12:00:00.000Z");
    const fallbackCatalog = buildCatalog("2026-03-08T00:00:00.000Z", ["Fallback Provider"]);
    const remoteCatalog = buildCatalog("2026-03-09T11:00:00.000Z", [
      "AWS",
      "Microsoft",
      "Comcast Business"
    ]);

    const sync = new TechCatalogSync({
      cachePath,
      sourceUrl: "https://example.test/catalog.json",
      fallbackCatalog,
      now: () => new Date(nowMs),
      fetchImpl: async () =>
        new Response(JSON.stringify(remoteCatalog), {
          status: 200,
          headers: {
            "content-type": "application/json",
            etag: "\"catalog-v1\""
          }
        })
    });

    expect(sync.getStatus()).toMatchObject({
      entryCount: 1,
      usingFallback: true,
      lastSyncedAt: null
    });

    const status = await sync.syncIfDue();

    expect(status).toMatchObject({
      entryCount: 3,
      usingFallback: false,
      lastSyncedAt: "2026-03-09T12:00:00.000Z",
      etag: "\"catalog-v1\""
    });
    expect(sync.listEntries().map((entry) => entry.name)).toEqual([
      "AWS",
      "Microsoft",
      "Comcast Business"
    ]);

    const persisted = JSON.parse(fs.readFileSync(cachePath, "utf8")) as {
      hasRemoteData: boolean;
      catalog: TechCatalogDocument;
    };
    expect(persisted.hasRemoteData).toBe(true);
    expect(persisted.catalog.updatedAt).toBe("2026-03-09T11:00:00.000Z");
  });

  it("records a new check on 304 responses without replacing the cached catalog", async () => {
    const cachePath = makeTempCachePath();
    let nowMs = Date.parse("2026-03-09T12:00:00.000Z");
    const fallbackCatalog = buildCatalog("2026-03-08T00:00:00.000Z", ["Fallback Provider"]);
    const remoteCatalog = buildCatalog("2026-03-09T11:00:00.000Z", ["AWS"]);

    const sync = new TechCatalogSync({
      cachePath,
      sourceUrl: "https://example.test/catalog.json",
      fallbackCatalog,
      now: () => new Date(nowMs),
      fetchImpl: async () =>
        new Response(JSON.stringify(remoteCatalog), {
          status: 200,
          headers: {
            "content-type": "application/json",
            etag: "\"catalog-v1\""
          }
        })
    });

    await sync.syncNow(true);

    nowMs = Date.parse("2026-03-10T13:00:00.000Z");
    const secondSync = new TechCatalogSync({
      cachePath,
      sourceUrl: "https://example.test/catalog.json",
      fallbackCatalog,
      now: () => new Date(nowMs),
      fetchImpl: async (_input, init) => {
        expect(new Headers(init?.headers).get("If-None-Match")).toBe("\"catalog-v1\"");
        return new Response(null, {
          status: 304,
          headers: {
            etag: "\"catalog-v1\""
          }
        });
      }
    });

    const status = await secondSync.syncIfDue();

    expect(status.lastSyncedAt).toBe("2026-03-09T12:00:00.000Z");
    expect(status.checkedAt).toBe("2026-03-10T13:00:00.000Z");
    expect(secondSync.listEntries().map((entry) => entry.name)).toEqual(["AWS"]);
  });
});
