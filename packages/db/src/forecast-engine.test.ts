import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { bootstrapEncryptedDatabase } from "./encrypted-db";
import { materializeScenarioOccurrences, markForecastStale } from "./forecast-engine";
import { runMigrations } from "./migrations";
import { BudgetCrudRepository } from "./repositories";

const tempRoots: string[] = [];

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "budgetit-forecast-"));
  tempRoots.push(dir);
  return dir;
}

describe("forecast materialization", () => {
  afterEach(() => {
    for (const dir of tempRoots.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("handles day-31 monthly recurrence by snapping to month end", () => {
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
          name: "Month-end bill",
          expenseType: "recurring",
          status: "planned",
          amountMinor: 10000,
          currency: "USD",
          startDate: "2026-01-31"
        },
        {
          expenseLineId: "ignored",
          frequency: "monthly",
          interval: 1,
          dayOfMonth: 31,
          anchorDate: "2026-01-31"
        }
      );

      materializeScenarioOccurrences(boot.db, "baseline", 2);
      const dates = boot.db
        .prepare("SELECT occurrence_date FROM occurrence ORDER BY occurrence_date LIMIT 3")
        .all() as Array<{ occurrence_date: string }>;

      expect(dates.map((entry) => entry.occurrence_date)).toEqual([
        "2026-01-31",
        "2026-02-28",
        "2026-03-31"
      ]);
    } finally {
      boot.db.close();
    }
  });

  it("is idempotent when rematerializing unchanged source data", () => {
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
          name: "Monthly bill",
          expenseType: "recurring",
          status: "planned",
          amountMinor: 5000,
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

      const firstCount = materializeScenarioOccurrences(boot.db, "baseline", 6);
      const secondCount = materializeScenarioOccurrences(boot.db, "baseline", 6);
      expect(secondCount).toBe(firstCount);

      const persistedCount = boot.db
        .prepare("SELECT COUNT(*) AS count FROM occurrence WHERE scenario_id = ?")
        .get("baseline") as { count: number };
      expect(persistedCount.count).toBe(firstCount);
    } finally {
      boot.db.close();
    }
  });

  it("flips forecast stale state after dependent mutations", () => {
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
          name: "Quarterly bill",
          expenseType: "recurring",
          status: "planned",
          amountMinor: 2500,
          currency: "USD",
          startDate: "2026-01-01"
        },
        {
          expenseLineId: "ignored",
          frequency: "quarterly",
          interval: 1,
          dayOfMonth: 1,
          anchorDate: "2026-01-01"
        }
      );

      materializeScenarioOccurrences(boot.db, "baseline", 6);
      const freshMeta = boot.db
        .prepare("SELECT forecast_stale FROM meta WHERE id = 1")
        .get() as { forecast_stale: number };
      expect(freshMeta.forecast_stale).toBe(0);

      markForecastStale(boot.db);
      const staleMeta = boot.db
        .prepare("SELECT forecast_stale FROM meta WHERE id = 1")
        .get() as { forecast_stale: number };
      expect(staleMeta.forecast_stale).toBe(1);
    } finally {
      boot.db.close();
    }
  });
});

