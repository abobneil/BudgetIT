import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { bootstrapEncryptedDatabase } from "./encrypted-db";
import { runMigrations } from "./migrations";
import { BudgetCrudRepository } from "./repositories";

const tempRoots: string[] = [];

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "budgetit-tagging-"));
  tempRoots.push(dir);
  return dir;
}

function insertExpense(
  repo: BudgetCrudRepository,
  serviceId: string,
  name: string
): string {
  return repo.createExpenseLineWithOptionalRecurrence({
    scenarioId: "baseline",
    serviceId,
    contractId: null,
    name,
    expenseType: "one_time",
    status: "planned",
    amountMinor: 5000,
    currency: "USD",
    startDate: "2026-01-01"
  });
}

describe("dimensioned tagging", () => {
  afterEach(() => {
    for (const dir of tempRoots.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("prevents multiple assignments for single-select dimensions", () => {
    const dataDir = createTempDir();
    const boot = bootstrapEncryptedDatabase(dataDir);
    try {
      runMigrations(boot.db);
      const repo = new BudgetCrudRepository(boot.db);
      const vendorId = repo.createVendor({ name: "Vendor" });
      const serviceId = repo.createService({ vendorId, name: "Service", status: "active" });
      const expenseId = insertExpense(repo, serviceId, "Expense A");

      const dimensionId = repo.createDimension({
        name: "Cost Center",
        mode: "single_select",
        required: false
      });
      const tagA = repo.createTag({ dimensionId, name: "CC-1" });
      const tagB = repo.createTag({ dimensionId, name: "CC-2" });

      repo.assignTagToEntity({
        entityType: "expense_line",
        entityId: expenseId,
        dimensionId,
        tagId: tagA
      });

      expect(() =>
        repo.assignTagToEntity({
          entityType: "expense_line",
          entityId: expenseId,
          dimensionId,
          tagId: tagB
        })
      ).toThrow("Single-select dimension already has an assigned tag.");
    } finally {
      boot.db.close();
    }
  });

  it("blocks save when required dimensions are missing", () => {
    const dataDir = createTempDir();
    const boot = bootstrapEncryptedDatabase(dataDir);
    try {
      runMigrations(boot.db);
      const repo = new BudgetCrudRepository(boot.db);
      const vendorId = repo.createVendor({ name: "Vendor" });
      const serviceId = repo.createService({ vendorId, name: "Service", status: "active" });
      const expenseId = insertExpense(repo, serviceId, "Expense Required");

      repo.createDimension({
        name: "Department",
        mode: "single_select",
        required: true
      });

      expect(() => repo.assertRequiredDimensionsSatisfied("expense_line", expenseId)).toThrow(
        "Required dimensions missing: Department"
      );
    } finally {
      boot.db.close();
    }
  });

  it("returns filtered entities for tag selections", () => {
    const dataDir = createTempDir();
    const boot = bootstrapEncryptedDatabase(dataDir);
    try {
      runMigrations(boot.db);
      const repo = new BudgetCrudRepository(boot.db);
      const vendorId = repo.createVendor({ name: "Vendor" });
      const serviceId = repo.createService({ vendorId, name: "Service", status: "active" });
      const expenseA = insertExpense(repo, serviceId, "Expense One");
      const expenseB = insertExpense(repo, serviceId, "Expense Two");

      const dimensionId = repo.createDimension({
        name: "Environment",
        mode: "multi_select",
        required: false
      });
      const prodTagId = repo.createTag({ dimensionId, name: "prod" });
      const devTagId = repo.createTag({ dimensionId, name: "dev" });

      repo.assignTagToEntity({
        entityType: "expense_line",
        entityId: expenseA,
        dimensionId,
        tagId: prodTagId
      });
      repo.assignTagToEntity({
        entityType: "expense_line",
        entityId: expenseB,
        dimensionId,
        tagId: devTagId
      });

      const prodEntities = repo.listEntityIdsByTagFilter("expense_line", prodTagId);
      expect(prodEntities).toEqual([expenseA]);
    } finally {
      boot.db.close();
    }
  });
});

