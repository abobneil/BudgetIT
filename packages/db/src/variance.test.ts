import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { bootstrapEncryptedDatabase } from "./encrypted-db";
import { materializeScenarioOccurrences } from "./forecast-engine";
import { runMigrations } from "./migrations";
import { BudgetCrudRepository } from "./repositories";
import {
  buildMonthlyVarianceDataset,
  ingestActualTransactions,
  listUnmatchedActualTransactions
} from "./variance";

const tempRoots: string[] = [];

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "budgetit-variance-"));
  tempRoots.push(dir);
  return dir;
}

describe("actuals import and variance dataset", () => {
  afterEach(() => {
    for (const dir of tempRoots.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("matches actual transactions to forecast occurrences with expected match rate", () => {
    const dataDir = createTempDir();
    const boot = bootstrapEncryptedDatabase(dataDir);
    try {
      runMigrations(boot.db);
      const repo = new BudgetCrudRepository(boot.db);
      const vendorId = repo.createVendor({ name: "Vendor" });
      const serviceId = repo.createService({ vendorId, name: "Service", status: "active" });

      repo.createExpenseLineWithOptionalRecurrence(
        {
          scenarioId: "baseline",
          serviceId,
          name: "Subscription",
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
      materializeScenarioOccurrences(boot.db, "baseline", 2);

      const result = ingestActualTransactions(boot.db, [
        {
          scenarioId: "baseline",
          serviceId,
          transactionDate: "2026-01-01",
          amountMinor: 10000,
          currency: "USD",
          description: "January invoice"
        },
        {
          scenarioId: "baseline",
          serviceId,
          transactionDate: "2026-02-01",
          amountMinor: 12000,
          currency: "USD",
          description: "February overage"
        },
        {
          scenarioId: "baseline",
          serviceId,
          transactionDate: "2026-03-01",
          amountMinor: 10000,
          currency: "USD",
          description: "March invoice"
        }
      ]);

      expect(result.inserted).toBe(3);
      expect(result.matched).toBe(2);
      expect(result.unmatched).toBe(1);
      expect(result.matchRate).toBeCloseTo(2 / 3, 4);
    } finally {
      boot.db.close();
    }
  });

  it("surfaces unmatched actuals for review", () => {
    const dataDir = createTempDir();
    const boot = bootstrapEncryptedDatabase(dataDir);
    try {
      runMigrations(boot.db);
      const repo = new BudgetCrudRepository(boot.db);
      const vendorId = repo.createVendor({ name: "Vendor" });
      const serviceId = repo.createService({ vendorId, name: "Service", status: "active" });

      repo.createExpenseLineWithOptionalRecurrence(
        {
          scenarioId: "baseline",
          serviceId,
          name: "Subscription",
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
      materializeScenarioOccurrences(boot.db, "baseline", 1);

      ingestActualTransactions(boot.db, [
        {
          scenarioId: "baseline",
          serviceId,
          transactionDate: "2026-01-01",
          amountMinor: 10000,
          currency: "USD",
          description: "Matched"
        },
        {
          scenarioId: "baseline",
          serviceId,
          transactionDate: "2026-02-01",
          amountMinor: 13000,
          currency: "USD",
          description: "Unmatched"
        }
      ]);

      const unmatched = listUnmatchedActualTransactions(boot.db, "baseline");
      expect(unmatched).toHaveLength(1);
      expect(unmatched[0].description).toBe("Unmatched");
      expect(unmatched[0].amountMinor).toBe(13000);
    } finally {
      boot.db.close();
    }
  });

  it("computes monthly variance totals that match hand-calculated expectations", () => {
    const dataDir = createTempDir();
    const boot = bootstrapEncryptedDatabase(dataDir);
    try {
      runMigrations(boot.db);
      const repo = new BudgetCrudRepository(boot.db);
      const vendorId = repo.createVendor({ name: "Vendor" });
      const serviceId = repo.createService({ vendorId, name: "Service", status: "active" });

      repo.createExpenseLineWithOptionalRecurrence(
        {
          scenarioId: "baseline",
          serviceId,
          name: "Subscription",
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
      materializeScenarioOccurrences(boot.db, "baseline", 2);

      ingestActualTransactions(boot.db, [
        {
          scenarioId: "baseline",
          serviceId,
          transactionDate: "2026-01-01",
          amountMinor: 10000,
          currency: "USD",
          description: "January invoice"
        },
        {
          scenarioId: "baseline",
          serviceId,
          transactionDate: "2026-02-01",
          amountMinor: 12000,
          currency: "USD",
          description: "February overage"
        },
        {
          scenarioId: "baseline",
          serviceId,
          transactionDate: "2026-03-01",
          amountMinor: 10000,
          currency: "USD",
          description: "March invoice"
        }
      ]);

      const variance = buildMonthlyVarianceDataset(boot.db, "baseline");
      expect(variance).toEqual([
        {
          month: "2026-01",
          forecastMinor: 10000,
          actualMinor: 10000,
          varianceMinor: 0,
          unmatchedActualMinor: 0,
          unmatchedCount: 0
        },
        {
          month: "2026-02",
          forecastMinor: 10000,
          actualMinor: 12000,
          varianceMinor: 2000,
          unmatchedActualMinor: 12000,
          unmatchedCount: 1
        },
        {
          month: "2026-03",
          forecastMinor: 10000,
          actualMinor: 10000,
          varianceMinor: 0,
          unmatchedActualMinor: 0,
          unmatchedCount: 0
        }
      ]);

      const totals = variance.reduce(
        (acc, row) => {
          acc.forecast += row.forecastMinor;
          acc.actual += row.actualMinor;
          acc.variance += row.varianceMinor;
          return acc;
        },
        { forecast: 0, actual: 0, variance: 0 }
      );
      expect(totals).toEqual({
        forecast: 30000,
        actual: 32000,
        variance: 2000
      });
    } finally {
      boot.db.close();
    }
  });
});
