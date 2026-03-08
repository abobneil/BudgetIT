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
  }, 15_000);

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

  it("deletes scenario-scoped records and blocks protected deletes", () => {
    const dataDir = createTempDir();
    const boot = bootstrapEncryptedDatabase(dataDir);
    try {
      runMigrations(boot.db);
      const repo = new BudgetCrudRepository(boot.db);
      const vendorId = repo.createVendor({ name: "Vendor" });
      const serviceId = repo.createService({ vendorId, name: "Service", status: "active" });
      const scenarioId = repo.createScenario({
        name: "Disposable",
        approvalStatus: "draft",
        parentScenarioId: "baseline"
      });
      const childScenarioId = repo.createScenario({
        name: "Disposable Child",
        approvalStatus: "draft",
        parentScenarioId: scenarioId
      });

      const expenseLineId = repo.createExpenseLineWithOptionalRecurrence(
        {
          scenarioId,
          serviceId,
          name: "Expense",
          expenseType: "recurring",
          status: "planned",
          amountMinor: 1000,
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
            ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `
        )
        .run("occ-1", scenarioId, expenseLineId, "2026-02-01", 1000, "USD", "planned");
      boot.db
        .prepare(
          `
            INSERT INTO spend_transaction (
              id,
              scenario_id,
              service_id,
              contract_id,
              transaction_date,
              amount_minor,
              currency,
              description,
              matched_occurrence_id,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `
        )
        .run("txn-1", scenarioId, serviceId, "2026-02-01", 1000, "USD", "Imported");
      boot.db
        .prepare(
          `
            INSERT INTO unmatched_actual_review (
              id,
              transaction_id,
              scenario_id,
              disposition,
              driver_tag,
              matched_occurrence_id,
              created_expense_line_id,
              reviewer,
              comment,
              reviewed_at,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?, NULL, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `
        )
        .run("review-1", "txn-1", scenarioId, "ignored", "tester", "2026-02-02T00:00:00.000Z");
      boot.db
        .prepare(
          `
            INSERT INTO approval_record (
              id,
              scenario_id,
              service_plan_id,
              entity_type,
              entity_id,
              action,
              actor,
              comment,
              created_at
            ) VALUES (?, ?, NULL, ?, ?, ?, ?, NULL, CURRENT_TIMESTAMP)
          `
        )
        .run("approval-1", scenarioId, "scenario", scenarioId, "create", "tester");
      boot.db
        .prepare(
          `
            INSERT INTO service_plan (
              id,
              scenario_id,
              service_id,
              planned_action,
              decision_status,
              reason_code,
              must_replace_by,
              replacement_required,
              replacement_selected_service_id,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, NULL, NULL, 0, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `
        )
        .run("plan-1", scenarioId, serviceId, "retain", "not-started");
      boot.db
        .prepare(
          `
            INSERT INTO replacement_candidate (
              id,
              service_plan_id,
              candidate_service_id,
              candidate_name,
              score,
              created_at,
              updated_at
            ) VALUES (?, ?, NULL, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `
        )
        .run("candidate-1", "plan-1", "Candidate", 77);
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
            ) VALUES (?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `
        )
        .run("rule-1", scenarioId, "renewal", "{}", "desktop");
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
              dedupe_key,
              message,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `
        )
        .run(
          "event-1",
          scenarioId,
          "rule-1",
          "scenario",
          scenarioId,
          "2026-02-03T00:00:00.000Z",
          "pending",
          "dedupe-1",
          "Alert"
        );
      boot.db
        .prepare(
          `
            INSERT INTO showback_statement (
              id,
              scenario_id,
              period_start,
              period_end,
              group_by,
              generated_at,
              generated_by,
              total_minor,
              currency,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `
        )
        .run(
          "statement-1",
          scenarioId,
          "2026-01-01",
          "2026-01-31",
          "team",
          "2026-02-03T00:00:00.000Z",
          "tester",
          1000,
          "USD"
        );
      boot.db
        .prepare(
          `
            INSERT INTO showback_line (
              id,
              statement_id,
              cost_center_code,
              owner_team,
              service_id,
              expense_line_id,
              amount_minor,
              currency,
              details_json,
              created_at
            ) VALUES (?, ?, NULL, NULL, ?, ?, ?, ?, NULL, CURRENT_TIMESTAMP)
          `
        )
        .run("line-1", "statement-1", serviceId, expenseLineId, 1000, "USD");

      expect(() => repo.deleteScenario("baseline")).toThrow("Baseline scenario cannot be deleted.");
      expect(() => repo.deleteScenario(scenarioId)).toThrow(
        "Scenario cannot be deleted while child scenarios exist."
      );

      repo.deleteScenario(childScenarioId);
      repo.deleteScenario(scenarioId);

      const deletedScenario = boot.db
        .prepare("SELECT id FROM scenario WHERE id = ?")
        .get(scenarioId);
      const remainingExpenses = boot.db
        .prepare("SELECT COUNT(*) AS count FROM expense_line WHERE scenario_id = ?")
        .get(scenarioId) as { count: number };
      const remainingRecurrences = boot.db
        .prepare("SELECT COUNT(*) AS count FROM recurrence_rule WHERE expense_line_id = ?")
        .get(expenseLineId) as { count: number };
      const remainingOccurrences = boot.db
        .prepare("SELECT COUNT(*) AS count FROM occurrence WHERE scenario_id = ?")
        .get(scenarioId) as { count: number };
      const remainingTransactions = boot.db
        .prepare("SELECT COUNT(*) AS count FROM spend_transaction WHERE scenario_id = ?")
        .get(scenarioId) as { count: number };
      const remainingReviews = boot.db
        .prepare("SELECT COUNT(*) AS count FROM unmatched_actual_review WHERE scenario_id = ?")
        .get(scenarioId) as { count: number };
      const remainingApprovals = boot.db
        .prepare("SELECT COUNT(*) AS count FROM approval_record WHERE scenario_id = ?")
        .get(scenarioId) as { count: number };
      const remainingPlans = boot.db
        .prepare("SELECT COUNT(*) AS count FROM service_plan WHERE scenario_id = ?")
        .get(scenarioId) as { count: number };
      const remainingCandidates = boot.db
        .prepare("SELECT COUNT(*) AS count FROM replacement_candidate WHERE service_plan_id = ?")
        .get("plan-1") as { count: number };
      const remainingRules = boot.db
        .prepare("SELECT COUNT(*) AS count FROM alert_rule WHERE scenario_id = ?")
        .get(scenarioId) as { count: number };
      const remainingEvents = boot.db
        .prepare("SELECT COUNT(*) AS count FROM alert_event WHERE scenario_id = ?")
        .get(scenarioId) as { count: number };
      const remainingStatements = boot.db
        .prepare("SELECT COUNT(*) AS count FROM showback_statement WHERE scenario_id = ?")
        .get(scenarioId) as { count: number };
      const remainingLines = boot.db
        .prepare("SELECT COUNT(*) AS count FROM showback_line WHERE statement_id = ?")
        .get("statement-1") as { count: number };
      const remainingSettings = boot.db
        .prepare("SELECT COUNT(*) AS count FROM scenario_settings WHERE scenario_id = ?")
        .get(scenarioId) as { count: number };

      expect(deletedScenario).toBeUndefined();
      expect(remainingExpenses.count).toBe(0);
      expect(remainingRecurrences.count).toBe(0);
      expect(remainingOccurrences.count).toBe(0);
      expect(remainingTransactions.count).toBe(0);
      expect(remainingReviews.count).toBe(0);
      expect(remainingApprovals.count).toBe(0);
      expect(remainingPlans.count).toBe(0);
      expect(remainingCandidates.count).toBe(0);
      expect(remainingRules.count).toBe(0);
      expect(remainingEvents.count).toBe(0);
      expect(remainingStatements.count).toBe(0);
      expect(remainingLines.count).toBe(0);
      expect(remainingSettings.count).toBe(0);
    } finally {
      boot.db.close();
    }
  });
});

