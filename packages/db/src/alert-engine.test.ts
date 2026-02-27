import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runAlertSchedulerTick } from "./alert-engine";
import { bootstrapEncryptedDatabase } from "./encrypted-db";
import { runMigrations } from "./migrations";

const tempRoots: string[] = [];

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "budgetit-alerts-"));
  tempRoots.push(dir);
  return dir;
}

function seedAlertFixtures(db: ReturnType<typeof bootstrapEncryptedDatabase>["db"]): void {
  db.prepare(
    `
      INSERT INTO occurrence (
        id, scenario_id, expense_line_id, occurrence_date, amount_minor, currency, state, created_at, updated_at
      ) VALUES ('occ-1', 'baseline', 'exp-1', '2026-01-10', 10000, 'USD', 'forecast', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `
  ).run();

  db.prepare(
    `
      INSERT INTO contract (
        id, service_id, contract_number, start_date, end_date, renewal_type, renewal_date, notice_period_days, created_at, updated_at, deleted_at
      ) VALUES ('contract-1', 'svc-1', 'C-1', '2025-01-01', '2026-12-31', 'auto', '2026-01-20', 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL)
    `
  ).run();

  db.prepare(
    `
      INSERT INTO service_plan (
        id, scenario_id, service_id, planned_action, decision_status, reason_code, must_replace_by, replacement_required, replacement_selected_service_id, created_at, updated_at
      ) VALUES
        ('plan-replacement', 'baseline', 'svc-1', 'replace', 'proposed', 'other', '2026-01-25', 1, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('plan-eol', 'baseline', 'svc-2', 'replace', 'proposed', 'EOL', '2026-01-15', 0, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `
  ).run();

  const insertRule = db.prepare(
    `
      INSERT INTO alert_rule (
        id, scenario_id, rule_type, params_json, enabled, channels, created_at, updated_at
      ) VALUES (?, 'baseline', ?, '{\"window_days\":30}', 1, 'in_app', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `
  );

  insertRule.run("rule-upcoming", "upcoming_payment");
  insertRule.run("rule-renewal", "renewal_window");
  insertRule.run("rule-notice", "notice_window");
  insertRule.run("rule-replacement", "replacement_missing");
  insertRule.run("rule-eol", "eol_date");
}

describe("alert scheduler", () => {
  afterEach(() => {
    for (const dir of tempRoots.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("generates expected rule-based alerts and dedupes repeat ticks", () => {
    const dataDir = createTempDir();
    const boot = bootstrapEncryptedDatabase(dataDir);
    try {
      runMigrations(boot.db);
      seedAlertFixtures(boot.db);

      const first = runAlertSchedulerTick(boot.db, "2026-01-01");
      expect(first.evaluatedRules).toBe(5);
      expect(first.created).toBe(5);

      const second = runAlertSchedulerTick(boot.db, "2026-01-01");
      expect(second.created).toBe(0);
    } finally {
      boot.db.close();
    }
  });

  it("computes cancellation notice deadline from renewal date minus notice window", () => {
    const dataDir = createTempDir();
    const boot = bootstrapEncryptedDatabase(dataDir);
    try {
      runMigrations(boot.db);
      seedAlertFixtures(boot.db);

      runAlertSchedulerTick(boot.db, "2026-01-01");

      const noticeEvent = boot.db
        .prepare("SELECT fire_at FROM alert_event WHERE alert_rule_id = 'rule-notice'")
        .get() as { fire_at: string };
      expect(noticeEvent.fire_at).toBe("2026-01-10");
    } finally {
      boot.db.close();
    }
  });
});

