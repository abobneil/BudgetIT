import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { bootstrapEncryptedDatabase, BudgetCrudRepository, runMigrations } from "@budgetit/db";
import { afterEach, describe, expect, it } from "vitest";

import {
  applyAutoTagRules,
  buildRuleFromSuggestion,
  evaluateAutoTagRules,
  recordManualTagCorrection,
  suggestRulesFromManualCorrections,
  type AutoTagRule
} from "./auto-tagging";

const tempRoots: string[] = [];

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "budgetit-auto-tag-"));
  tempRoots.push(dir);
  return dir;
}

function seedEntities(repo: BudgetCrudRepository): {
  vendorId: string;
  serviceId: string;
  dimensionId: string;
  financeTagId: string;
  engineeringTagId: string;
} {
  const vendorId = repo.createVendor({ name: "Contoso" });
  const serviceId = repo.createService({
    vendorId,
    name: "Contoso SaaS",
    status: "active"
  });
  const dimensionId = repo.createDimension({
    name: "Cost Center",
    mode: "single_select",
    required: false
  });
  const financeTagId = repo.createTag({
    dimensionId,
    name: "Finance"
  });
  const engineeringTagId = repo.createTag({
    dimensionId,
    name: "Engineering"
  });

  return { vendorId, serviceId, dimensionId, financeTagId, engineeringTagId };
}

function createExpense(repo: BudgetCrudRepository, serviceId: string, name: string, amountMinor: number): string {
  return repo.createExpenseLineWithOptionalRecurrence({
    scenarioId: "baseline",
    serviceId,
    contractId: null,
    name,
    expenseType: "one_time",
    status: "planned",
    amountMinor,
    currency: "USD"
  });
}

describe("auto tagging", () => {
  afterEach(() => {
    for (const dir of tempRoots.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("applies precedence when multiple rules match the same dimension", () => {
    const dataDir = createTempDir();
    const boot = bootstrapEncryptedDatabase(dataDir);
    try {
      runMigrations(boot.db);
      const repo = new BudgetCrudRepository(boot.db);
      const { vendorId, serviceId, dimensionId, financeTagId, engineeringTagId } = seedEntities(repo);
      const expenseId = createExpense(repo, serviceId, "suite license", 12000);

      const rules: AutoTagRule[] = [
        {
          id: "rule-generic",
          name: "Generic Suite",
          dimensionId,
          tagId: financeTagId,
          priority: 1,
          enabled: true,
          conditions: {
            descriptionContains: "suite"
          }
        },
        {
          id: "rule-specific",
          name: "Vendor-Specific Suite",
          dimensionId,
          tagId: engineeringTagId,
          priority: 2,
          enabled: true,
          conditions: {
            vendorId,
            descriptionContains: "suite"
          }
        }
      ];

      const matches = evaluateAutoTagRules(rules, {
        entityType: "expense_line",
        entityId: expenseId,
        vendorId,
        description: "suite license",
        amountMinor: 12000
      });
      expect(matches[0]?.ruleId).toBe("rule-specific");

      applyAutoTagRules(boot.db, rules, {
        entityType: "expense_line",
        entityId: expenseId,
        vendorId,
        description: "suite license",
        amountMinor: 12000
      });

      const assignment = boot.db
        .prepare("SELECT tag_id FROM tag_assignment WHERE entity_type = 'expense_line' AND entity_id = ?")
        .get(expenseId) as { tag_id: string } | undefined;
      expect(assignment?.tag_id).toBe(engineeringTagId);
    } finally {
      boot.db.close();
    }
  });

  it("stores explainability text that maps to the applied rule", () => {
    const dataDir = createTempDir();
    const boot = bootstrapEncryptedDatabase(dataDir);
    try {
      runMigrations(boot.db);
      const repo = new BudgetCrudRepository(boot.db);
      const { vendorId, serviceId, dimensionId, financeTagId } = seedEntities(repo);
      const expenseId = createExpense(repo, serviceId, "ops tooling", 3300);

      const rules: AutoTagRule[] = [
        {
          id: "rule-explain",
          name: "Ops Vendor Rule",
          dimensionId,
          tagId: financeTagId,
          priority: 5,
          enabled: true,
          conditions: {
            vendorId,
            descriptionContains: "tooling",
            amountMinMinor: 1000
          }
        }
      ];

      const applied = applyAutoTagRules(boot.db, rules, {
        entityType: "expense_line",
        entityId: expenseId,
        vendorId,
        description: "ops tooling",
        amountMinor: 3300
      });

      expect(applied).toHaveLength(1);
      expect(applied[0].explanation).toContain("Ops Vendor Rule");
      expect(applied[0].explanation).toContain("vendorId=");
      expect(applied[0].explanation).toContain("description contains");

      const auditRow = boot.db
        .prepare("SELECT after_json FROM audit_log WHERE action = 'tag_assignment.auto_rule_applied' LIMIT 1")
        .get() as { after_json: string | null } | undefined;
      expect(auditRow?.after_json).toContain("Ops Vendor Rule");
    } finally {
      boot.db.close();
    }
  });

  it("turns repeated manual corrections into a rule suggestion that reproduces tagging", () => {
    const dataDir = createTempDir();
    const boot = bootstrapEncryptedDatabase(dataDir);
    try {
      runMigrations(boot.db);
      const repo = new BudgetCrudRepository(boot.db);
      const { vendorId, serviceId, dimensionId, engineeringTagId } = seedEntities(repo);

      for (let index = 0; index < 3; index += 1) {
        recordManualTagCorrection(boot.db, {
          entityType: "expense_line",
          entityId: `manual-${index}`,
          dimensionId,
          fromTagId: null,
          toTagId: engineeringTagId,
          vendorId,
          description: "suite license",
          costCenter: "ENG",
          amountMinor: 15000 + index
        });
      }

      const suggestions = suggestRulesFromManualCorrections(boot.db, 3);
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].tagId).toBe(engineeringTagId);
      expect(suggestions[0].conditions.vendorId).toBe(vendorId);
      expect(suggestions[0].conditions.descriptionContains).toBe("suite license");

      const acceptedRule = buildRuleFromSuggestion(suggestions[0], {
        id: "rule-from-suggestion",
        name: "Suggested Suite Rule",
        priority: 3
      });
      const expenseId = createExpense(repo, serviceId, "suite license", 15001);
      const applied = applyAutoTagRules(boot.db, [acceptedRule], {
        entityType: "expense_line",
        entityId: expenseId,
        vendorId,
        description: "suite license",
        costCenter: "ENG",
        amountMinor: 15001
      });

      expect(applied).toHaveLength(1);
      expect(applied[0].tagId).toBe(engineeringTagId);
      expect(applied[0].ruleId).toBe("rule-from-suggestion");

      const assignment = boot.db
        .prepare("SELECT tag_id FROM tag_assignment WHERE entity_type = 'expense_line' AND entity_id = ?")
        .get(expenseId) as { tag_id: string } | undefined;
      expect(assignment?.tag_id).toBe(engineeringTagId);
    } finally {
      boot.db.close();
    }
  });
});
