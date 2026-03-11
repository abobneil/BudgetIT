import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { bootstrapEncryptedDatabase, BudgetCrudRepository, runMigrations } from "@budgetit/db";
import { afterEach, describe, expect, it } from "vitest";

import { commitBaselineImport, previewBaselineImport } from "./baseline-import";

const tempRoots: string[] = [];

function createTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempRoots.push(dir);
  return dir;
}

function createCsv(filePath: string, lines: string[]): void {
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}

describe("baseline inventory import", () => {
  afterEach(() => {
    for (const dir of tempRoots.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("accepts historical baseline rows and stages create actions across linked entities", () => {
    const dataDir = createTempDir("budgetit-baseline-db-");
    const fixtureDir = createTempDir("budgetit-baseline-fixture-");
    const boot = bootstrapEncryptedDatabase(dataDir);

    try {
      runMigrations(boot.db);
      const csvPath = path.join(fixtureDir, "baseline-historical.csv");
      createCsv(csvPath, [
        "vendor_name,service_name,contract_number,contract_start_date,contract_end_date,contract_renewal_date,expense_name,expense_type,expense_status,expense_amount,expense_currency,expense_start_date",
        "Microsoft,M365 E5,EA-2019-001,2019-01-01,2024-12-31,2024-12-31,M365 Seats,one_time,approved,1200.00,USD,2019-01-01"
      ]);

      const preview = previewBaselineImport(boot.db, {
        filePath: csvPath
      });

      expect(preview.acceptedCount).toBe(1);
      expect(preview.rejectedCount).toBe(0);
      expect(preview.duplicateCount).toBe(0);
      expect(preview.rowSummaries[0]?.actions).toEqual({
        vendor: "create",
        service: "create",
        contract: "create",
        expense: "create"
      });
    } finally {
      boot.db.close();
    }
  });

  it("upserts linked vendor, service, contract, and expense records without breaking relationships", () => {
    const dataDir = createTempDir("budgetit-baseline-db-");
    const fixtureDir = createTempDir("budgetit-baseline-fixture-");
    const boot = bootstrapEncryptedDatabase(dataDir);

    try {
      runMigrations(boot.db);
      const repo = new BudgetCrudRepository(boot.db);
      const vendorId = repo.createVendor({
        name: "Okta",
        website: "https://old.example",
        annualSpendMinor: 100_000,
        status: "active",
        risk: "medium"
      });
      const serviceId = repo.createService({
        vendorId,
        name: "Workforce Identity",
        annualSpendMinor: 100_000,
        status: "active",
        risk: "medium",
        replacementStatus: "not-started"
      });
      const contractId = repo.createContract({
        serviceId,
        contractNumber: "OKTA-001",
        startDate: "2022-01-01",
        endDate: "2024-12-31",
        renewalType: "manual",
        renewalDate: "2024-12-31",
        noticePeriodDays: 30,
        lifecycleStatus: "active",
        renewalAction: "manual-review"
      });
      repo.createExpenseLineWithOptionalRecurrence({
        scenarioId: "baseline",
        serviceId,
        contractId,
        name: "Identity Seats",
        expenseType: "one_time",
        status: "approved",
        amountMinor: 100_000,
        currency: "USD",
        startDate: "2024-01-01",
        endDate: "2024-12-31"
      });

      const csvPath = path.join(fixtureDir, "baseline-upsert.csv");
      createCsv(csvPath, [
        "vendor_name,vendor_website,vendor_risk,service_name,service_risk,service_replacement_status,contract_number,contract_notice_period_days,contract_lifecycle_status,expense_name,expense_type,expense_status,expense_amount,expense_currency,expense_start_date,expense_end_date",
        "Okta,https://okta.com,high,Workforce Identity,high,candidate-review,OKTA-001,60,notice-window,Identity Seats,one_time,committed,1250.00,USD,2024-01-01,2024-12-31"
      ]);

      const committed = commitBaselineImport(boot.db, {
        filePath: csvPath
      });

      expect(committed.insertedCount).toBe(1);
      expect(committed.entityCounts?.vendors.updated).toBe(1);
      expect(committed.entityCounts?.services.updated).toBe(1);
      expect(committed.entityCounts?.contracts.updated).toBe(1);
      expect(committed.entityCounts?.expenses.updated).toBe(1);

      const vendor = repo.listVendors()[0];
      const service = repo.listServices()[0];
      const contract = repo.listContracts()[0];
      const expense = repo.listExpenseLines("baseline")[0];

      expect(vendor.website).toBe("https://okta.com");
      expect(vendor.risk).toBe("high");
      expect(service.vendorId).toBe(vendor.id);
      expect(service.risk).toBe("high");
      expect(service.replacementStatus).toBe("candidate-review");
      expect(contract.serviceId).toBe(service.id);
      expect(contract.noticePeriodDays).toBe(60);
      expect(contract.lifecycleStatus).toBe("notice-window");
      expect(expense.contractId).toBe(contract.id);
      expect(expense.serviceId).toBe(service.id);
      expect(expense.amountMinor).toBe(125_000);
      expect(expense.status).toBe("committed");
    } finally {
      boot.db.close();
    }
  });

  it("suppresses exact duplicate baseline rows before commit", () => {
    const dataDir = createTempDir("budgetit-baseline-db-");
    const fixtureDir = createTempDir("budgetit-baseline-fixture-");
    const boot = bootstrapEncryptedDatabase(dataDir);

    try {
      runMigrations(boot.db);
      const csvPath = path.join(fixtureDir, "baseline-duplicates.csv");
      createCsv(csvPath, [
        "vendor_name,service_name,contract_number,expense_name,expense_type,expense_status,expense_amount,expense_currency",
        "Cisco,Phones,CISCO-LEGACY,Legacy Support,one_time,approved,500.00,USD",
        "Cisco,Phones,CISCO-LEGACY,Legacy Support,one_time,approved,500.00,USD"
      ]);

      const preview = previewBaselineImport(boot.db, {
        filePath: csvPath
      });
      const committed = commitBaselineImport(boot.db, {
        filePath: csvPath
      });

      expect(preview.acceptedCount).toBe(1);
      expect(preview.duplicateCount).toBe(1);
      expect(committed.insertedCount).toBe(1);
      expect(committed.duplicateCount).toBe(1);
      expect(new BudgetCrudRepository(boot.db).listVendors()).toHaveLength(1);
      expect(new BudgetCrudRepository(boot.db).listServices()).toHaveLength(1);
      expect(new BudgetCrudRepository(boot.db).listContracts()).toHaveLength(1);
      expect(new BudgetCrudRepository(boot.db).listExpenseLines("baseline")).toHaveLength(1);
    } finally {
      boot.db.close();
    }
  });
});
