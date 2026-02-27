import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { bootstrapEncryptedDatabase } from "./encrypted-db";
import { runMigrations } from "./migrations";

const tempRoots: string[] = [];

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "budgetit-migrate-"));
  tempRoots.push(dir);
  return dir;
}

function readMigrationSql(fileName: string): string {
  const migrationsDir = path.resolve(__dirname, "../migrations");
  return fs.readFileSync(path.join(migrationsDir, fileName), "utf8");
}

describe("migration runner", () => {
  afterEach(() => {
    for (const dir of tempRoots.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("applies all migrations for a fresh encrypted database", () => {
    const dataDir = createTempDir();
    const boot = bootstrapEncryptedDatabase(dataDir);
    try {
      const applied = runMigrations(boot.db);
      expect(applied).toEqual([
        "001_initial.sql",
        "002_audit_indexes.sql",
        "003_tag_assignment_indexes.sql",
        "004_forecast_state.sql",
        "005_scenarios.sql",
        "006_alert_dedupe.sql"
      ]);

      const metaRow = boot.db
        .prepare("SELECT schema_version, last_mutation_at, forecast_stale FROM meta WHERE id = 1")
        .get() as { schema_version: number; last_mutation_at: string; forecast_stale: number };
      expect(metaRow.schema_version).toBe(6);
      expect(metaRow.forecast_stale).toBe(1);
      expect(metaRow.last_mutation_at.length).toBeGreaterThan(0);
    } finally {
      boot.db.close();
    }
  });

  it("upgrades a database from a prior migration fixture", () => {
    const dataDir = createTempDir();
    const boot = bootstrapEncryptedDatabase(dataDir);
    try {
      const initialSql = readMigrationSql("001_initial.sql");
      boot.db.exec(initialSql);
      boot.db
        .prepare(
          `
            CREATE TABLE IF NOT EXISTS schema_migrations (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              file_name TEXT NOT NULL UNIQUE,
              applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
          `
        )
        .run();
      boot.db
        .prepare("INSERT INTO schema_migrations (file_name) VALUES (?)")
        .run("001_initial.sql");

      const applied = runMigrations(boot.db);
      expect(applied).toEqual([
        "002_audit_indexes.sql",
        "003_tag_assignment_indexes.sql",
        "004_forecast_state.sql",
        "005_scenarios.sql",
        "006_alert_dedupe.sql"
      ]);

      const indexRow = boot.db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_audit_entity'")
        .get() as { name: string } | undefined;
      expect(indexRow?.name).toBe("idx_audit_entity");
    } finally {
      boot.db.close();
    }
  });
});
