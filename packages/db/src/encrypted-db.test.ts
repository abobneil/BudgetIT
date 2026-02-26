import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { bootstrapEncryptedDatabase, openEncryptedDatabase } from "./encrypted-db";

const tempRoots: string[] = [];

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "budgetit-db-"));
  tempRoots.push(dir);
  return dir;
}

describe("encrypted sqlite bootstrap", () => {
  afterEach(() => {
    for (const dir of tempRoots.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("creates encrypted db and blocks access with wrong key", () => {
    const dataDir = createTempDir();
    const bootstrapped = bootstrapEncryptedDatabase(dataDir);
    bootstrapped.db.close();

    expect(() => openEncryptedDatabase(bootstrapped.dbPath, "a".repeat(64))).toThrow(
      "file is not a database"
    );
  });

  it("reopens encrypted db with stored key and keeps WAL mode enabled", () => {
    const dataDir = createTempDir();

    const firstOpen = bootstrapEncryptedDatabase(dataDir);
    firstOpen.db.exec("CREATE TABLE IF NOT EXISTS sample (id INTEGER PRIMARY KEY, value TEXT NOT NULL);");
    firstOpen.db.prepare("INSERT INTO sample (value) VALUES (?)").run("first");
    firstOpen.db.close();

    const secondOpen = bootstrapEncryptedDatabase(dataDir);
    const row = secondOpen.db
      .prepare("SELECT value FROM sample WHERE id = 1")
      .get() as { value: string };
    expect(row.value).toBe("first");

    const journalMode = secondOpen.db.pragma("journal_mode", { simple: true }) as string;
    expect(journalMode.toLowerCase()).toBe("wal");
    secondOpen.db.close();
  });

  it("supports concurrent read/write handles under WAL", () => {
    const dataDir = createTempDir();
    const first = bootstrapEncryptedDatabase(dataDir);
    first.db.exec("CREATE TABLE IF NOT EXISTS wal_fixture (id INTEGER PRIMARY KEY, value TEXT NOT NULL);");

    const second = openEncryptedDatabase(first.dbPath, first.keyHex);
    second.exec("BEGIN IMMEDIATE");
    second.prepare("INSERT INTO wal_fixture (value) VALUES (?)").run("from-second");
    second.exec("COMMIT");

    const rows = first.db.prepare("SELECT value FROM wal_fixture").all() as Array<{ value: string }>;
    expect(rows.map((row) => row.value)).toContain("from-second");

    second.close();
    first.db.close();
  });
});
