import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { bootstrapEncryptedDatabase, runMigrations, BudgetCrudRepository } from "@budgetit/db";
import { afterEach, describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import { commitExpenseImport, previewExpenseImport } from "./import-wizard";

const tempRoots: string[] = [];

function createTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempRoots.push(dir);
  return dir;
}

function createCsv(filePath: string, lines: string[]): void {
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}

function createXlsx(filePath: string, rows: string[][]): void {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, "Import");
  XLSX.writeFile(workbook, filePath);
}

function seedService(repo: BudgetCrudRepository): string {
  const vendorId = repo.createVendor({ name: "Import Vendor" });
  return repo.createService({
    vendorId,
    name: "Import Service",
    status: "active"
  });
}

describe("import wizard", () => {
  afterEach(() => {
    for (const dir of tempRoots.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns expected accepted and rejected counts for mixed-validity rows", () => {
    const dataDir = createTempDir("budgetit-import-db-");
    const fixtureDir = createTempDir("budgetit-import-fixture-");
    const boot = bootstrapEncryptedDatabase(dataDir);

    try {
      runMigrations(boot.db);
      const repo = new BudgetCrudRepository(boot.db);
      const serviceId = seedService(repo);

      const csvPath = path.join(fixtureDir, "mixed.csv");
      createCsv(csvPath, [
        "scenario_id,service_id,name,expense_type,status,amount,currency,frequency,day_of_month,interval",
        `baseline,${serviceId},Email Licenses,recurring,planned,100.00,USD,monthly,1,1`,
        `baseline,${serviceId},Invalid Amount,one_time,planned,abc,USD,,,`,
        `baseline,${serviceId},Missing Type,,planned,20.00,USD,,,`,
        `baseline,${serviceId},Email Licenses,recurring,planned,100.00,USD,monthly,1,1`
      ]);

      const preview = previewExpenseImport(boot.db, {
        filePath: csvPath,
        templateStorePath: path.join(fixtureDir, "templates.json")
      });

      expect(preview.totalRows).toBe(4);
      expect(preview.acceptedCount).toBe(1);
      expect(preview.rejectedCount).toBe(3);
      expect(preview.duplicateCount).toBe(1);
    } finally {
      boot.db.close();
    }
  });

  it("reuses a saved mapping template across sessions", () => {
    const dataDir = createTempDir("budgetit-import-db-");
    const fixtureDir = createTempDir("budgetit-import-fixture-");
    const boot = bootstrapEncryptedDatabase(dataDir);

    try {
      runMigrations(boot.db);
      const repo = new BudgetCrudRepository(boot.db);
      const serviceId = seedService(repo);
      const workbookPath = path.join(fixtureDir, "custom-columns.xlsx");
      const templateStorePath = path.join(fixtureDir, "templates.json");

      createXlsx(workbookPath, [
        ["Scenario", "Service", "Expense", "Type", "State", "AmountUSD"],
        ["baseline", serviceId, "Office Suite", "one_time", "planned", "49.95"]
      ]);

      const first = previewExpenseImport(boot.db, {
        filePath: workbookPath,
        templateStorePath,
        saveTemplate: true,
        templateName: "accounting-format",
        mapping: {
          scenarioId: "Scenario",
          serviceId: "Service",
          name: "Expense",
          expenseType: "Type",
          status: "State",
          amount: "AmountUSD"
        }
      });

      expect(first.acceptedCount).toBe(1);
      expect(first.templateSaved).toBe("accounting-format");

      const second = previewExpenseImport(boot.db, {
        filePath: workbookPath,
        templateStorePath,
        useSavedTemplate: true,
        templateName: "accounting-format"
      });

      expect(second.acceptedCount).toBe(1);
      expect(second.templateApplied).toBe("accounting-format");
      expect(second.mapping.status).toBe("State");
    } finally {
      boot.db.close();
    }
  });

  it("applies deterministic duplicate policy on repeated commit", () => {
    const dataDir = createTempDir("budgetit-import-db-");
    const fixtureDir = createTempDir("budgetit-import-fixture-");
    const boot = bootstrapEncryptedDatabase(dataDir);

    try {
      runMigrations(boot.db);
      const repo = new BudgetCrudRepository(boot.db);
      const serviceId = seedService(repo);

      const csvPath = path.join(fixtureDir, "dedupe.csv");
      createCsv(csvPath, [
        "scenario_id,service_id,name,expense_type,status,amount,currency",
        `baseline,${serviceId},Monitoring,one_time,approved,150.00,USD`
      ]);

      const first = commitExpenseImport(boot.db, {
        filePath: csvPath,
        templateStorePath: path.join(fixtureDir, "templates.json")
      });
      const second = commitExpenseImport(boot.db, {
        filePath: csvPath,
        templateStorePath: path.join(fixtureDir, "templates.json")
      });

      const countRow = boot.db
        .prepare("SELECT COUNT(*) AS count FROM expense_line WHERE deleted_at IS NULL")
        .get() as { count: number };

      expect(first.insertedCount).toBe(1);
      expect(second.insertedCount).toBe(0);
      expect(second.duplicateCount).toBe(1);
      expect(second.skippedDuplicateCount).toBe(1);
      expect(countRow.count).toBe(1);
    } finally {
      boot.db.close();
    }
  });
});
