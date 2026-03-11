import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { bootstrapEncryptedDatabase } from "./encrypted-db";
import { runMigrations } from "./migrations";
import { upsertRenewalDecision } from "./renewal-planning";
import { BudgetCrudRepository } from "./repositories";
import { diffScenarioSavings, summarizeScenarioSavings } from "./savings-attribution";

const tempRoots: string[] = [];

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "budgetit-savings-"));
  tempRoots.push(dir);
  return dir;
}

function seedScenario(
  repo: BudgetCrudRepository,
  scenarioId: string,
  serviceId: string,
  contractId: string,
  amountMinor: number
): void {
  repo.createExpenseLineWithOptionalRecurrence(
    {
      scenarioId,
      serviceId,
      contractId,
      name: `${scenarioId} Subscription`,
      expenseType: "recurring",
      status: "approved",
      amountMinor,
      currency: "USD",
      startDate: "2026-01-01"
    },
    {
      expenseLineId: "seed",
      frequency: "monthly",
      interval: 1,
      dayOfMonth: 1,
      anchorDate: "2026-01-01"
    }
  );
}

describe("savings attribution", () => {
  afterEach(() => {
    for (const dir of tempRoots.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("summarizes renewal decision savings by category and calculates deltas", () => {
    const dataDir = createTempDir();
    const boot = bootstrapEncryptedDatabase(dataDir);
    try {
      runMigrations(boot.db);
      const repo = new BudgetCrudRepository(boot.db);
      const vendorId = repo.createVendor({ name: "Vendor" });
      const serviceId = repo.createService({
        vendorId,
        name: "Identity",
        status: "active"
      });
      const contractId = repo.createContract({
        serviceId,
        contractNumber: "ID-1",
        renewalDate: "2026-09-01",
        renewalType: "manual",
        noticePeriodDays: 30
      });
      const comparisonScenarioId = repo.createScenario({
        name: "Comparison",
        parentScenarioId: "baseline"
      });

      seedScenario(repo, "baseline", serviceId, contractId, 12_000);
      seedScenario(repo, comparisonScenarioId, serviceId, contractId, 12_000);

      upsertRenewalDecision(boot.db, {
        scenarioId: "baseline",
        serviceId,
        contractId,
        action: "do_not_renew",
        effectiveDate: "2026-09-01",
        expectedAmountMinor: 0,
        currency: "USD",
        oneTimeCostMinor: 500,
        savingsCategory: "non_renewal",
        savingsRationale: "Service retired after consolidation."
      });
      upsertRenewalDecision(boot.db, {
        scenarioId: comparisonScenarioId,
        serviceId,
        contractId,
        action: "replace",
        effectiveDate: "2026-09-01",
        expectedAmountMinor: 8_000,
        currency: "USD",
        oneTimeCostMinor: 1_500,
        savingsCategory: "consolidation",
        savingsRationale: "Bundle three tools into one platform."
      });

      const baseline = summarizeScenarioSavings(boot.db, "baseline");
      const comparison = summarizeScenarioSavings(boot.db, comparisonScenarioId);
      const delta = diffScenarioSavings(baseline, comparison);

      expect(baseline.avoidedFutureCostMinor).toBe(12_000);
      expect(baseline.oneTimeCostMinor).toBe(500);
      expect(baseline.netSavingsMinor).toBe(11_500);
      expect(baseline.byCategory).toEqual([
        expect.objectContaining({
          category: "non_renewal",
          count: 1,
          avoidedFutureCostMinor: 12_000,
          oneTimeCostMinor: 500,
          netSavingsMinor: 11_500
        })
      ]);

      expect(comparison.recurringSavingsMinor).toBe(4_000);
      expect(comparison.oneTimeCostMinor).toBe(1_500);
      expect(comparison.netSavingsMinor).toBe(2_500);
      expect(comparison.byCategory).toEqual([
        expect.objectContaining({
          category: "consolidation",
          count: 1,
          recurringSavingsMinor: 4_000,
          oneTimeCostMinor: 1_500,
          netSavingsMinor: 2_500
        })
      ]);

      expect(delta).toEqual({
        recurringSavingsMinor: 4_000,
        avoidedFutureCostMinor: -12_000,
        oneTimeCostMinor: 1_000,
        netSavingsMinor: -9_000
      });
    } finally {
      boot.db.close();
    }
  });
});
