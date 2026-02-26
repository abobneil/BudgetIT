import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { updateExpenseLineAmountWithAudit } from "./audit-service";
import { bootstrapEncryptedDatabase } from "./encrypted-db";
import { runMigrations } from "./migrations";

const tempRoots: string[] = [];

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "budgetit-audit-"));
  tempRoots.push(dir);
  return dir;
}

describe("audit service", () => {
  afterEach(() => {
    for (const dir of tempRoots.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("writes before/after audit entries for critical amount updates", () => {
    const dataDir = createTempDir();
    const boot = bootstrapEncryptedDatabase(dataDir);
    try {
      runMigrations(boot.db);

      boot.db.prepare(
        `
          INSERT INTO expense_line (
            id,
            scenario_id,
            service_id,
            contract_id,
            name,
            expense_type,
            status,
            amount_minor,
            currency,
            start_date,
            end_date,
            created_at,
            updated_at,
            deleted_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL)
        `
      ).run(
        "exp-1",
        "baseline",
        "svc-1",
        null,
        "Licenses",
        "recurring",
        "planned",
        10000,
        "USD",
        "2026-01-01",
        null
      );

      updateExpenseLineAmountWithAudit(boot.db, {
        expenseLineId: "exp-1",
        newAmountMinor: 15000,
        actor: "local-user"
      });

      const auditRow = boot.db
        .prepare(
          `
            SELECT before_json, after_json
            FROM audit_log
            WHERE entity_type = 'expense_line'
              AND entity_id = 'exp-1'
          `
        )
        .get() as { before_json: string; after_json: string };

      const before = JSON.parse(auditRow.before_json) as { amount_minor: number };
      const after = JSON.parse(auditRow.after_json) as { amount_minor: number };
      expect(before.amount_minor).toBe(10000);
      expect(after.amount_minor).toBe(15000);

      const mutatedMeta = boot.db
        .prepare("SELECT last_mutation_at FROM meta WHERE id = 1")
        .get() as { last_mutation_at: string };
      expect(mutatedMeta.last_mutation_at.length).toBeGreaterThan(0);
    } finally {
      boot.db.close();
    }
  });
});
