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
});

