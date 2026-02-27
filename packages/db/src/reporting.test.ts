import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { bootstrapEncryptedDatabase } from "./encrypted-db";
import { materializeScenarioOccurrences, markForecastStale } from "./forecast-engine";
import { runMigrations } from "./migrations";
import { buildDashboardDataset } from "./reporting";
import {
  createServicePlan,
  setReplacementSelection,
  transitionServicePlan
} from "./replacement-planning";
import { BudgetCrudRepository } from "./repositories";
import { ingestActualTransactions } from "./variance";

const tempRoots: string[] = [];

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "budgetit-reporting-"));
  tempRoots.push(dir);
  return dir;
}

describe("dashboard reporting datasets", () => {
  afterEach(() => {
    for (const dir of tempRoots.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds expected dataset aggregates for spend, variance, renewals, tags, and replacement status", () => {
    const dataDir = createTempDir();
    const boot = bootstrapEncryptedDatabase(dataDir);
    try {
      runMigrations(boot.db);
      const repo = new BudgetCrudRepository(boot.db);
      const vendorId = repo.createVendor({ name: "Vendor A" });
      const serviceId = repo.createService({
        vendorId,
        name: "Service A",
        status: "active"
      });
      const replacementServiceId = repo.createService({
        vendorId,
        name: "Service B",
        status: "active"
      });
      const contractId = repo.createContract({
        serviceId,
        contractNumber: "C-100",
        renewalDate: "2026-05-01",
        renewalType: "manual",
        noticePeriodDays: 60
      });

      const expenseA = repo.createExpenseLineWithOptionalRecurrence(
        {
          scenarioId: "baseline",
          serviceId,
          contractId,
          name: "Primary subscription",
          expenseType: "recurring",
          status: "planned",
          amountMinor: 10000,
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
      const expenseB = repo.createExpenseLineWithOptionalRecurrence(
        {
          scenarioId: "baseline",
          serviceId,
          contractId,
          name: "Secondary subscription",
          expenseType: "recurring",
          status: "planned",
          amountMinor: 5000,
          currency: "USD",
          startDate: "2026-02-01"
        },
        {
          expenseLineId: "ignored",
          frequency: "monthly",
          interval: 1,
          dayOfMonth: 1,
          anchorDate: "2026-02-01"
        }
      );

      const dimensionId = repo.createDimension({
        name: "Owner",
        mode: "single_select",
        required: false
      });
      const tagId = repo.createTag({ dimensionId, name: "IT" });
      repo.assignTagToEntity({
        entityType: "expense_line",
        entityId: expenseA,
        dimensionId,
        tagId
      });

      materializeScenarioOccurrences(boot.db, "baseline", 2);
      ingestActualTransactions(boot.db, [
        {
          scenarioId: "baseline",
          serviceId,
          transactionDate: "2026-01-01",
          amountMinor: 10000,
          currency: "USD",
          description: "Jan invoice"
        },
        {
          scenarioId: "baseline",
          serviceId,
          transactionDate: "2026-02-01",
          amountMinor: 16000,
          currency: "USD",
          description: "Feb overage"
        },
        {
          scenarioId: "baseline",
          serviceId,
          transactionDate: "2026-03-01",
          amountMinor: 15000,
          currency: "USD",
          description: "Mar invoice"
        }
      ]);

      const planA = createServicePlan(boot.db, {
        scenarioId: "baseline",
        serviceId,
        plannedAction: "replace",
        replacementRequired: true
      });
      const planB = createServicePlan(boot.db, {
        scenarioId: "baseline",
        serviceId,
        plannedAction: "keep",
        replacementRequired: false
      });
      transitionServicePlan(boot.db, {
        servicePlanId: planA,
        nextStatus: "reviewed"
      });
      setReplacementSelection(boot.db, {
        servicePlanId: planA,
        replacementSelectedServiceId: replacementServiceId
      });
      transitionServicePlan(boot.db, {
        servicePlanId: planA,
        nextStatus: "approved",
        reasonCode: "cost"
      });
      transitionServicePlan(boot.db, {
        servicePlanId: planB,
        nextStatus: "reviewed"
      });

      const dashboard = buildDashboardDataset(boot.db, "baseline");

      expect(dashboard.spendTrend.length).toBeGreaterThan(0);
      expect(dashboard.variance.length).toBe(dashboard.spendTrend.length);
      expect(dashboard.renewals).toEqual([{ month: "2026-05", count: 1 }]);
      expect(dashboard.taggingCompleteness.totalExpenseLines).toBe(2);
      expect(dashboard.taggingCompleteness.taggedExpenseLines).toBe(1);
      expect(dashboard.taggingCompleteness.completenessRatio).toBe(0.5);
      expect(dashboard.replacementStatus.totalPlans).toBe(2);
      expect(dashboard.replacementStatus.byStatus.some((row) => row.status === "approved")).toBe(
        true
      );
      expect(dashboard.narrativeBlocks.length).toBe(4);

      const forecastTotal = dashboard.spendTrend.reduce((sum, row) => sum + row.forecastMinor, 0);
      const varianceForecastTotal = dashboard.variance.reduce(
        (sum, row) => sum + row.forecastMinor,
        0
      );
      expect(forecastTotal).toBe(varianceForecastTotal);

      expect(expenseB).toBeTruthy();
    } finally {
      boot.db.close();
    }
  });

  it("flags stale forecast state when forecast is outdated", () => {
    const dataDir = createTempDir();
    const boot = bootstrapEncryptedDatabase(dataDir);
    try {
      runMigrations(boot.db);
      markForecastStale(boot.db);

      const dashboard = buildDashboardDataset(boot.db, "baseline");
      expect(dashboard.staleForecast).toBe(true);
    } finally {
      boot.db.close();
    }
  });
});
