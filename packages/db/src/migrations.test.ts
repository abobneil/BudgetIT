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
        "006_alert_dedupe.sql",
        "007_alert_snooze.sql",
        "008_replacement_scorecards.sql",
        "009_single_user_gap_closure.sql",
        "010_owner_directory.sql",
        "011_renewal_decisions.sql",
        "012_renewal_decision_savings.sql",
        "013_capability_coverage.sql"
      ]);

      const metaRow = boot.db
        .prepare("SELECT schema_version, last_mutation_at, forecast_stale FROM meta WHERE id = 1")
        .get() as { schema_version: number; last_mutation_at: string; forecast_stale: number };
      expect(metaRow.schema_version).toBe(13);
      expect(metaRow.forecast_stale).toBe(1);
      expect(metaRow.last_mutation_at.length).toBeGreaterThan(0);
    } finally {
      boot.db.close();
    }
  }, 15_000);

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
        "006_alert_dedupe.sql",
        "007_alert_snooze.sql",
        "008_replacement_scorecards.sql",
        "009_single_user_gap_closure.sql",
        "010_owner_directory.sql",
        "011_renewal_decisions.sql",
        "012_renewal_decision_savings.sql",
        "013_capability_coverage.sql"
      ]);

      const indexRow = boot.db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_audit_entity'")
        .get() as { name: string } | undefined;
      expect(indexRow?.name).toBe("idx_audit_entity");
    } finally {
      boot.db.close();
    }
  });

  it("backfills owner directory entries and owner ids from legacy owner text", () => {
    const dataDir = createTempDir();
    const boot = bootstrapEncryptedDatabase(dataDir);
    try {
      for (const fileName of [
        "001_initial.sql",
        "002_audit_indexes.sql",
        "003_tag_assignment_indexes.sql",
        "004_forecast_state.sql",
        "005_scenarios.sql",
        "006_alert_dedupe.sql",
        "007_alert_snooze.sql",
        "008_replacement_scorecards.sql",
        "009_single_user_gap_closure.sql"
      ]) {
        boot.db.exec(readMigrationSql(fileName));
      }
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
      for (const fileName of [
        "001_initial.sql",
        "002_audit_indexes.sql",
        "003_tag_assignment_indexes.sql",
        "004_forecast_state.sql",
        "005_scenarios.sql",
        "006_alert_dedupe.sql",
        "007_alert_snooze.sql",
        "008_replacement_scorecards.sql",
        "009_single_user_gap_closure.sql"
      ]) {
        boot.db
          .prepare("INSERT INTO schema_migrations (file_name) VALUES (?)")
          .run(fileName);
      }

      boot.db
        .prepare(
          `
            INSERT INTO vendor (
              id, name, owner, annual_spend_minor, status, risk, created_at, updated_at, deleted_at
            ) VALUES ('vendor-1', 'Vendor 1', 'Platform Ops', 100, 'active', 'low', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL)
          `
        )
        .run();
      boot.db
        .prepare(
          `
            INSERT INTO service (
              id, vendor_id, name, status, owner_team, annual_spend_minor, risk, replacement_status, created_at, updated_at, deleted_at
            ) VALUES ('service-1', 'vendor-1', 'Service 1', 'active', 'Platform Ops', 100, 'low', 'not-started', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL)
          `
        )
        .run();
      boot.db
        .prepare(
          `
            INSERT INTO contract (
              id, service_id, contract_number, owner, lifecycle_status, renewal_action, created_at, updated_at, deleted_at
            ) VALUES ('contract-1', 'service-1', 'C-1', 'Security Team', 'active', 'manual-review', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL)
          `
        )
        .run();

      const applied = runMigrations(boot.db);
      expect(applied).toEqual([
        "010_owner_directory.sql",
        "011_renewal_decisions.sql",
        "012_renewal_decision_savings.sql",
        "013_capability_coverage.sql"
      ]);

      const owners = boot.db
        .prepare("SELECT name, normalized_name FROM owner_directory ORDER BY name")
        .all() as Array<{ name: string; normalized_name: string }>;
      expect(owners).toEqual([
        { name: "Platform Ops", normalized_name: "platform ops" },
        { name: "Security Team", normalized_name: "security team" }
      ]);

      const vendorOwner = boot.db
        .prepare("SELECT owner_id, owner FROM vendor WHERE id = 'vendor-1'")
        .get() as { owner_id: string | null; owner: string | null };
      const serviceOwner = boot.db
        .prepare("SELECT owner_id, owner_team FROM service WHERE id = 'service-1'")
        .get() as { owner_id: string | null; owner_team: string | null };
      const contractOwner = boot.db
        .prepare("SELECT owner_id, owner FROM contract WHERE id = 'contract-1'")
        .get() as { owner_id: string | null; owner: string | null };

      expect(vendorOwner.owner).toBe("Platform Ops");
      expect(serviceOwner.owner_team).toBe("Platform Ops");
      expect(contractOwner.owner).toBe("Security Team");
      expect(vendorOwner.owner_id).toBeTruthy();
      expect(serviceOwner.owner_id).toBe(vendorOwner.owner_id);
      expect(contractOwner.owner_id).toBeTruthy();
      expect(contractOwner.owner_id).not.toBe(vendorOwner.owner_id);
    } finally {
      boot.db.close();
    }
  });
});
