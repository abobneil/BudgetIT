import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { bootstrapEncryptedDatabase } from "./encrypted-db";
import { runMigrations } from "./migrations";
import { BudgetCrudRepository } from "./repositories";

const tempRoots: string[] = [];

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "budgetit-scenario-"));
  tempRoots.push(dir);
  return dir;
}

describe("scenario workflows", () => {
  afterEach(() => {
    for (const dir of tempRoots.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("clones scenario data with expense/recurrence integrity", () => {
    const dataDir = createTempDir();
    const boot = bootstrapEncryptedDatabase(dataDir);
    try {
      runMigrations(boot.db);
      const repo = new BudgetCrudRepository(boot.db);
      const vendorId = repo.createVendor({ name: "Vendor" });
      const serviceId = repo.createService({ vendorId, name: "Service", status: "active" });
      const sourceScenarioId = repo.createScenario({ name: "Source", approvalStatus: "draft" });

      repo.createExpenseLineWithOptionalRecurrence(
        {
          scenarioId: sourceScenarioId,
          serviceId,
          name: "Clonable Expense",
          expenseType: "recurring",
          status: "planned",
          amountMinor: 4200,
          currency: "USD",
          startDate: "2026-01-01"
        },
        {
          expenseLineId: "ignored",
          frequency: "monthly",
          interval: 1,
          dayOfMonth: 1,
          anchorDate: "2026-01-01"
        }
      );

      const clonedScenarioId = repo.cloneScenario(sourceScenarioId, "Clone");

      const clonedExpenseCount = boot.db
        .prepare("SELECT COUNT(*) AS count FROM expense_line WHERE scenario_id = ?")
        .get(clonedScenarioId) as { count: number };
      expect(clonedExpenseCount.count).toBe(1);

      const clonedRecurrenceCount = boot.db
        .prepare(
          `
            SELECT COUNT(*) AS count
            FROM recurrence_rule
            WHERE expense_line_id IN (
              SELECT id FROM expense_line WHERE scenario_id = ?
            )
          `
        )
        .get(clonedScenarioId) as { count: number };
      expect(clonedRecurrenceCount.count).toBe(1);
    } finally {
      boot.db.close();
    }
  });

  it("rejects edits for locked scenarios", () => {
    const dataDir = createTempDir();
    const boot = bootstrapEncryptedDatabase(dataDir);
    try {
      runMigrations(boot.db);
      const repo = new BudgetCrudRepository(boot.db);
      const vendorId = repo.createVendor({ name: "Vendor" });
      const serviceId = repo.createService({ vendorId, name: "Service", status: "active" });
      const scenarioId = repo.createScenario({ name: "Locked Scenario", approvalStatus: "reviewed" });

      repo.lockScenario(scenarioId);

      expect(() =>
        repo.createExpenseLineWithOptionalRecurrence({
          scenarioId,
          serviceId,
          name: "Blocked Expense",
          expenseType: "one_time",
          status: "planned",
          amountMinor: 1000,
          currency: "USD",
          startDate: "2026-01-01"
        })
      ).toThrow(`Scenario is locked: ${scenarioId}`);
    } finally {
      boot.db.close();
    }
  });

  it("enforces scenario approval transitions", () => {
    const dataDir = createTempDir();
    const boot = bootstrapEncryptedDatabase(dataDir);
    try {
      runMigrations(boot.db);
      const repo = new BudgetCrudRepository(boot.db);
      const scenarioId = repo.createScenario({ name: "Approvals", approvalStatus: "draft" });

      repo.setScenarioApprovalStatus(scenarioId, "reviewed");
      repo.setScenarioApprovalStatus(scenarioId, "approved");

      const statusRow = boot.db
        .prepare("SELECT approval_status FROM scenario WHERE id = ?")
        .get(scenarioId) as { approval_status: string };
      expect(statusRow.approval_status).toBe("approved");

      expect(() => repo.setScenarioApprovalStatus(scenarioId, "draft")).toThrow(
        "Invalid scenario approval transition: approved -> draft"
      );
    } finally {
      boot.db.close();
    }
  });
});

