import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { bootstrapEncryptedDatabase } from "./encrypted-db";
import { runMigrations } from "./migrations";
import { BudgetCrudRepository, toUsdMinorUnits } from "./repositories";

const tempRoots: string[] = [];

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "budgetit-crud-"));
  tempRoots.push(dir);
  return dir;
}

describe("budget CRUD repository", () => {
  afterEach(() => {
    for (const dir of tempRoots.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("creates, updates, and deletes vendor/service/contract/expense/recurrence entities", () => {
    const dataDir = createTempDir();
    const boot = bootstrapEncryptedDatabase(dataDir);
    try {
      runMigrations(boot.db);
      const repo = new BudgetCrudRepository(boot.db);

      const vendorId = repo.createVendor({ name: "Vendor A", website: "https://example.com" });
      repo.updateVendor(vendorId, { name: "Vendor A+", website: "https://example.com" });
      repo.deleteVendor(vendorId);

      const serviceId = repo.createService({
        vendorId,
        name: "Service A",
        status: "active",
        ownerTeam: "IT"
      });
      repo.updateService(serviceId, {
        vendorId,
        name: "Service A+",
        status: "retiring",
        ownerTeam: "IT Ops"
      });
      repo.deleteService(serviceId);

      const contractId = repo.createContract({
        serviceId,
        contractNumber: "C-1",
        renewalType: "auto",
        noticePeriodDays: 30
      });
      repo.updateContract(contractId, {
        serviceId,
        contractNumber: "C-2",
        renewalType: "manual",
        noticePeriodDays: 60
      });
      repo.deleteContract(contractId);

      const expenseId = repo.createExpenseLineWithOptionalRecurrence(
        {
          scenarioId: "baseline",
          serviceId,
          contractId,
          name: "Licenses",
          expenseType: "recurring",
          status: "planned",
          amountMinor: 12500,
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

      repo.updateExpenseLine(expenseId, {
        scenarioId: "baseline",
        serviceId,
        contractId,
        name: "Licenses Updated",
        expenseType: "recurring",
        status: "approved",
        amountMinor: 13000,
        currency: "USD",
        startDate: "2026-01-01"
      });

      const recurrenceId = boot.db
        .prepare("SELECT id FROM recurrence_rule WHERE expense_line_id = ?")
        .get(expenseId) as { id: string };

      repo.updateRecurrenceRule(recurrenceId.id, {
        expenseLineId: expenseId,
        frequency: "yearly",
        interval: 1,
        dayOfMonth: 1,
        monthOfYear: 12,
        anchorDate: "2026-01-01"
      });
      repo.deleteRecurrenceRule(recurrenceId.id);
      repo.deleteExpenseLine(expenseId);

      const softDeletedExpense = boot.db
        .prepare("SELECT deleted_at FROM expense_line WHERE id = ?")
        .get(expenseId) as { deleted_at: string | null };
      expect(softDeletedExpense.deleted_at).not.toBeNull();
    } finally {
      boot.db.close();
    }
  });

  it("rejects invalid recurrence input and avoids currency floating-point drift", () => {
    const dataDir = createTempDir();
    const boot = bootstrapEncryptedDatabase(dataDir);
    try {
      runMigrations(boot.db);
      const repo = new BudgetCrudRepository(boot.db);

      expect(() =>
        repo.createRecurrenceRule({
          expenseLineId: "exp-1",
          frequency: "monthly",
          interval: 1,
          dayOfMonth: 42
        })
      ).toThrow();

      expect(toUsdMinorUnits(0.1 + 0.2)).toBe(30);
      expect(toUsdMinorUnits("123.45")).toBe(12345);
      expect(toUsdMinorUnits("-1.23")).toBe(-123);
      expect(toUsdMinorUnits(-1.23)).toBe(-123);
      expect(toUsdMinorUnits("-0.09")).toBe(-9);
    } finally {
      boot.db.close();
    }
  });

  it("reuses, retires, and remaps shared owner directory records", () => {
    const dataDir = createTempDir();
    const boot = bootstrapEncryptedDatabase(dataDir);
    try {
      runMigrations(boot.db);
      const repo = new BudgetCrudRepository(boot.db);

      const platformOps = repo.createOwner("Platform Ops");
      const reusedPlatformOps = repo.createOwner(" platform ops ");
      expect(reusedPlatformOps.id).toBe(platformOps.id);

      const vendorId = repo.createVendor({
        name: "Vendor A",
        ownerId: platformOps.id
      });
      const serviceId = repo.createService({
        vendorId,
        name: "Service A",
        status: "active",
        ownerId: platformOps.id
      });
      repo.createContract({
        serviceId,
        contractNumber: "CTR-1",
        ownerId: platformOps.id
      });

      const usage = repo.getOwnerUsage(platformOps.id);
      expect(usage.owner.vendorCount).toBe(1);
      expect(usage.owner.serviceCount).toBe(1);
      expect(usage.owner.contractCount).toBe(1);

      expect(() => repo.retireOwner(platformOps.id)).toThrow(/Owner remap required/);

      const financeOps = repo.createOwner("Finance Ops");
      repo.retireOwner(platformOps.id, financeOps.id);

      const archivedOwner = repo.listOwners(true).find((entry) => entry.id === platformOps.id);
      expect(archivedOwner?.archivedAt).toBeTruthy();

      const remappedVendor = repo.listVendors().find((entry) => entry.id === vendorId);
      const remappedService = repo.listServices().find((entry) => entry.id === serviceId);
      const remappedContract = repo.listContracts().find((entry) => entry.contractNumber === "CTR-1");

      expect(remappedVendor?.ownerId).toBe(financeOps.id);
      expect(remappedVendor?.owner).toBe("Finance Ops");
      expect(remappedService?.ownerId).toBe(financeOps.id);
      expect(remappedService?.ownerTeam).toBe("Finance Ops");
      expect(remappedContract?.ownerId).toBe(financeOps.id);
      expect(remappedContract?.owner).toBe("Finance Ops");

      const unusedOwner = repo.createOwner("Unused Team");
      const retiredUnused = repo.retireOwner(unusedOwner.id);
      expect(retiredUnused.owner.archivedAt).toBeTruthy();
    } finally {
      boot.db.close();
    }
  });

  it("resets database state including vendors and owners", () => {
    const dataDir = createTempDir();
    const boot = bootstrapEncryptedDatabase(dataDir);
    try {
      runMigrations(boot.db);
      const repo = new BudgetCrudRepository(boot.db);

      const vendorOwner = repo.createOwner("Vendor Ops");
      const serviceOwner = repo.createOwner("Service Ops");
      const vendorId = repo.createVendor({
        name: "Vendor A",
        ownerId: vendorOwner.id
      });
      const serviceId = repo.createService({
        vendorId,
        name: "Service A",
        status: "active",
        ownerId: serviceOwner.id
      });
      const contractId = repo.createContract({
        serviceId,
        contractNumber: "CTR-1",
        ownerId: serviceOwner.id
      });
      const expenseId = repo.createExpenseLineWithOptionalRecurrence(
        {
          scenarioId: "baseline",
          serviceId,
          contractId,
          name: "Licenses",
          expenseType: "recurring",
          status: "approved",
          amountMinor: 10000,
          currency: "USD"
        },
        {
          expenseLineId: "ignored",
          frequency: "monthly",
          interval: 1,
          dayOfMonth: 1,
          anchorDate: "2026-01-01"
        }
      );
      const dimensionId = repo.createDimension({
        name: "Cost Center",
        mode: "single_select",
        required: true
      });
      const tagId = repo.createTag({
        dimensionId,
        name: "Engineering"
      });
      repo.assignTagToEntity({
        entityType: "expense_line",
        entityId: expenseId,
        dimensionId,
        tagId
      });
      const childScenarioId = repo.createScenario({
        name: "Reset Me",
        parentScenarioId: "baseline"
      });
      repo.upsertScenarioSettings({
        scenarioId: childScenarioId,
        fiscalYearStartMonth: 7,
        horizonMonths: 18,
        defaultCurrency: "EUR"
      });
      repo.upsertCostCenter({
        code: "CC100",
        name: "Engineering",
        active: true
      });
      repo.upsertGlAccount({
        code: "GL100",
        name: "Software",
        active: true
      });

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
            ) VALUES ('rule-1', 'baseline', 'renewal_due', '{}', 1, 'in_app', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `
        )
        .run();
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
            ) VALUES ('event-1', 'baseline', 'rule-1', 'service', ?, '2026-03-01', NULL, 'pending', 'dedupe-1', 'Test', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `
        )
        .run(serviceId);
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
            ) VALUES ('plan-1', 'baseline', ?, 'replace', 'proposed', 'cost', NULL, 0, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `
        )
        .run(serviceId);
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
            ) VALUES ('candidate-1', 'plan-1', NULL, 'Replacement', 82, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `
        )
        .run();
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
            ) VALUES ('approval-1', 'baseline', 'plan-1', 'service_plan', 'plan-1', 'approve', 'tester', NULL, CURRENT_TIMESTAMP)
          `
        )
        .run();
      boot.db
        .prepare(
          `
            INSERT INTO notification_endpoint (
              id,
              endpoint_type,
              endpoint_url,
              enabled,
              last_test_result,
              last_test_at,
              last_failure_reason,
              created_at,
              updated_at
            ) VALUES ('endpoint-1', 'teams', 'https://example.test/webhook', 1, 'ok', CURRENT_TIMESTAMP, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `
        )
        .run();
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
            ) VALUES ('review-1', 'txn-1', 'baseline', 'ignored', NULL, NULL, NULL, 'tester', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `
        )
        .run();
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
            ) VALUES ('statement-1', 'baseline', '2026-01-01', '2026-01-31', 'cost_center', CURRENT_TIMESTAMP, 'tester', 10000, 'USD', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `
        )
        .run();
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
            ) VALUES ('line-1', 'statement-1', 'CC100', 'Service Ops', ?, ?, 10000, 'USD', '{}', CURRENT_TIMESTAMP)
          `
        )
        .run(serviceId, expenseId);
      boot.db
        .prepare(
          `
            INSERT INTO attachment (
              id,
              entity_type,
              entity_id,
              file_name,
              file_path,
              content_sha256,
              created_at,
              updated_at
            ) VALUES ('attachment-1', 'service', ?, 'note.txt', 'C:\\\\temp\\\\note.txt', 'abc123', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `
        )
        .run(serviceId);
      boot.db
        .prepare(
          `
            INSERT INTO audit_log (
              id,
              actor,
              action,
              entity_type,
              entity_id,
              before_json,
              after_json,
              created_at
            ) VALUES ('audit-1', 'tester', 'seed', 'service', ?, NULL, NULL, CURRENT_TIMESTAMP)
          `
        )
        .run(serviceId);

      const result = repo.resetDatabase();

      expect(result.preservedVendorCount).toBe(0);
      expect(result.preservedOwnerCount).toBe(0);
      expect(repo.listVendors()).toHaveLength(0);
      expect(repo.listOwners()).toHaveLength(0);
      expect(repo.listServices()).toHaveLength(0);
      expect(repo.listContracts()).toHaveLength(0);
      expect(repo.listExpenseLines("baseline")).toHaveLength(0);
      expect(repo.listDimensions()).toHaveLength(0);
      expect(repo.listTags()).toHaveLength(0);
      expect(repo.listCostCenters()).toHaveLength(0);
      expect(repo.listGlAccounts()).toHaveLength(0);
      expect(repo.listScenarios()).toEqual([
        expect.objectContaining({
          id: "baseline",
          name: "Baseline",
          parentScenarioId: null,
          approvalStatus: "approved",
          isLocked: false
        })
      ]);
      expect(repo.getScenarioSettings("baseline")).toEqual(
        expect.objectContaining({
          scenarioId: "baseline",
          fiscalYearStartMonth: 1,
          horizonMonths: 24,
          defaultCurrency: "USD"
        })
      );

      const tableCounts = {
        alert_rule: 0,
        alert_event: 0,
        service_plan: 0,
        replacement_candidate: 0,
        approval_record: 0,
        notification_endpoint: 0,
        unmatched_actual_review: 0,
        showback_statement: 0,
        showback_line: 0,
        attachment: 0,
        audit_log: 0,
        vendor: 0,
        owner_directory: 0,
        scenario: 1,
        scenario_settings: 1
      };

      for (const [tableName, expectedCount] of Object.entries(tableCounts)) {
        const row = boot.db
          .prepare(`SELECT COUNT(*) AS count FROM ${tableName}`)
          .get() as { count: number };
        expect(row.count).toBe(expectedCount);
      }

      const meta = boot.db
        .prepare(
          "SELECT last_mutation_at, forecast_stale, forecast_generated_at FROM meta WHERE id = 1"
        )
        .get() as {
        last_mutation_at: string;
        forecast_stale: number;
        forecast_generated_at: string | null;
      };
      expect(meta.last_mutation_at).toBe(result.resetAt);
      expect(meta.forecast_stale).toBe(1);
      expect(meta.forecast_generated_at).toBeNull();
    } finally {
      boot.db.close();
    }
  });
});

