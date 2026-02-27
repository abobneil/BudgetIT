import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  acknowledgeAlertEvent,
  listActionableAlertEventsForNotification,
  snoozeAlertEvent
} from "./alerts-repository";
import { runAlertSchedulerTick } from "./alert-engine";
import { bootstrapEncryptedDatabase } from "./encrypted-db";
import { runMigrations } from "./migrations";

const tempRoots: string[] = [];

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "budgetit-alert-repo-"));
  tempRoots.push(dir);
  return dir;
}

describe("alert event repository", () => {
  afterEach(() => {
    for (const dir of tempRoots.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("prevents snoozed alerts from notifying before snooze expiry", () => {
    const dataDir = createTempDir();
    const boot = bootstrapEncryptedDatabase(dataDir);
    try {
      runMigrations(boot.db);
      boot.db
        .prepare(
          `
            INSERT INTO alert_event (
              id,
              scenario_id,
              alert_rule_id,
              entity_type,
              entity_id,
              fire_at,
              fired_at,
              status,
              snoozed_until,
              dedupe_key,
              message,
              created_at,
              updated_at
            ) VALUES (
              'event-1',
              'baseline',
              'rule-1',
              'contract',
              'contract-1',
              '2026-02-10',
              NULL,
              'pending',
              NULL,
              'rule-1|notice_window|contract|contract-1|2026-02-10',
              'Notice deadline approaching',
              CURRENT_TIMESTAMP,
              CURRENT_TIMESTAMP
            )
          `
        )
        .run();

      const initial = listActionableAlertEventsForNotification(boot.db, "2026-02-10");
      expect(initial.map((entry) => entry.id)).toEqual(["event-1"]);

      const snoozed = snoozeAlertEvent(boot.db, "event-1", "2026-02-20");
      expect(snoozed.status).toBe("snoozed");
      expect(snoozed.snoozedUntil).toBe("2026-02-20");

      const beforeExpiry = listActionableAlertEventsForNotification(boot.db, "2026-02-19");
      expect(beforeExpiry).toHaveLength(0);

      const atExpiry = listActionableAlertEventsForNotification(boot.db, "2026-02-20");
      expect(atExpiry.map((entry) => entry.id)).toEqual(["event-1"]);
    } finally {
      boot.db.close();
    }
  });

  it("does not refire acknowledged alerts for the same dedupe key", () => {
    const dataDir = createTempDir();
    const boot = bootstrapEncryptedDatabase(dataDir);
    try {
      runMigrations(boot.db);
      boot.db
        .prepare(
          `
            INSERT INTO occurrence (
              id,
              scenario_id,
              expense_line_id,
              occurrence_date,
              amount_minor,
              currency,
              state,
              created_at,
              updated_at
            ) VALUES (
              'occ-1',
              'baseline',
              'expense-1',
              '2026-01-10',
              12000,
              'USD',
              'forecast',
              CURRENT_TIMESTAMP,
              CURRENT_TIMESTAMP
            )
          `
        )
        .run();

      boot.db
        .prepare(
          `
            INSERT INTO alert_rule (
              id,
              scenario_id,
              rule_type,
              params_json,
              enabled,
              channels,
              created_at,
              updated_at
            ) VALUES (
              'rule-upcoming',
              'baseline',
              'upcoming_payment',
              '{"window_days":30}',
              1,
              'in_app',
              CURRENT_TIMESTAMP,
              CURRENT_TIMESTAMP
            )
          `
        )
        .run();

      const firstTick = runAlertSchedulerTick(boot.db, "2026-01-01");
      expect(firstTick.created).toBe(1);

      const createdEvent = boot.db
        .prepare("SELECT id FROM alert_event WHERE alert_rule_id = 'rule-upcoming'")
        .get() as { id: string };

      const acked = acknowledgeAlertEvent(boot.db, createdEvent.id, "2026-01-02");
      expect(acked.status).toBe("acked");

      const secondTick = runAlertSchedulerTick(boot.db, "2026-01-01");
      expect(secondTick.created).toBe(0);

      const counts = boot.db
        .prepare("SELECT COUNT(*) AS total FROM alert_event WHERE alert_rule_id = 'rule-upcoming'")
        .get() as { total: number };
      expect(counts.total).toBe(1);
    } finally {
      boot.db.close();
    }
  });
});
