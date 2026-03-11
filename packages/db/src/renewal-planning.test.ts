import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { bootstrapEncryptedDatabase } from "./encrypted-db";
import { materializeScenarioOccurrences } from "./forecast-engine";
import { runMigrations } from "./migrations";
import { BudgetCrudRepository } from "./repositories";
import { listRenewalWorkbenchItems, upsertRenewalDecision } from "./renewal-planning";

const tempRoots: string[] = [];

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "budgetit-renewal-"));
  tempRoots.push(dir);
  return dir;
}

function seedRecurringContract() {
  const dataDir = createTempDir();
  const boot = bootstrapEncryptedDatabase(dataDir);
  runMigrations(boot.db);
  const repo = new BudgetCrudRepository(boot.db);
  const vendorId = repo.createVendor({ name: "Okta" });
  const serviceId = repo.createService({
    vendorId,
    name: "Workforce Identity",
    status: "active"
  });
  const contractId = repo.createContract({
    serviceId,
    contractNumber: "OKTA-001",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    renewalType: "manual",
    renewalDate: "2026-07-01",
    noticePeriodDays: 30,
    lifecycleStatus: "renewal-window",
    renewalAction: "manual-review"
  });
  repo.createExpenseLineWithOptionalRecurrence(
    {
      scenarioId: "baseline",
      serviceId,
      contractId,
      name: "Identity Seats",
      expenseType: "recurring",
      status: "approved",
      amountMinor: 10_000,
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

  return { boot, repo, serviceId, contractId };
}

describe("renewal planning", () => {
  afterEach(() => {
    for (const dir of tempRoots.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("persists renewal decisions and surfaces them in the workbench", () => {
    const { boot, serviceId, contractId } = seedRecurringContract();
    try {
      const saved = upsertRenewalDecision(boot.db, {
        scenarioId: "baseline",
        serviceId,
        contractId,
        action: "renegotiate",
        effectiveDate: "2026-07-01",
        expectedAmountMinor: 7_500,
        currency: "USD",
        notes: "Vendor agreed to lower rate",
        assumptions: "Headcount steady through FY26"
      });

      const items = listRenewalWorkbenchItems(boot.db, "baseline");
      expect(saved.action).toBe("renegotiate");
      expect(items).toHaveLength(1);
      expect(items[0]?.noticeDeadline).toBe("2026-06-01");
      expect(items[0]?.decision?.expectedAmountMinor).toBe(7_500);
      expect(items[0]?.decision?.notes).toContain("lower rate");
    } finally {
      boot.db.close();
    }
  });

  it("materializes renewal decisions into forecast changes for future occurrences", () => {
    const { boot, contractId, serviceId } = seedRecurringContract();
    try {
      upsertRenewalDecision(boot.db, {
        scenarioId: "baseline",
        serviceId,
        contractId,
        action: "renew",
        effectiveDate: "2026-07-01",
        expectedAmountMinor: 7_000,
        currency: "USD"
      });

      materializeScenarioOccurrences(boot.db, "baseline", 12);
      const julyRows = boot.db
        .prepare(
          `
            SELECT o.occurrence_date AS occurrenceDate, o.amount_minor AS amountMinor
            FROM occurrence o
            JOIN expense_line e ON e.id = o.expense_line_id
            WHERE o.scenario_id = 'baseline'
              AND o.occurrence_date IN ('2026-06-01', '2026-07-01', '2026-08-01')
            ORDER BY o.occurrence_date, o.amount_minor DESC
          `
        )
        .all() as Array<{ occurrenceDate: string; amountMinor: number }>;

      expect(julyRows).toContainEqual({
        occurrenceDate: "2026-06-01",
        amountMinor: 10_000
      });
      expect(julyRows).toContainEqual({
        occurrenceDate: "2026-07-01",
        amountMinor: 7_000
      });
      expect(julyRows).toContainEqual({
        occurrenceDate: "2026-08-01",
        amountMinor: 7_000
      });
      expect(julyRows).not.toContainEqual({
        occurrenceDate: "2026-07-01",
        amountMinor: 10_000
      });
    } finally {
      boot.db.close();
    }
  });
});
