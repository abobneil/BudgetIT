import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  buildReplacementCoverageSummary,
  listCapabilities,
  listEntityCapabilities,
  replaceCapabilityAssignments,
  setServicePlanSourceItems,
  upsertCapability
} from "./capability-coverage";
import { bootstrapEncryptedDatabase } from "./encrypted-db";
import { runMigrations } from "./migrations";
import { createServicePlan, upsertReplacementCandidate } from "./replacement-planning";
import { BudgetCrudRepository } from "./repositories";

const tempRoots: string[] = [];

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "budgetit-capability-"));
  tempRoots.push(dir);
  return dir;
}

describe("capability coverage", () => {
  afterEach(() => {
    for (const dir of tempRoots.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("maps capabilities to current and proposed items and computes consolidation deltas", () => {
    const dataDir = createTempDir();
    const boot = bootstrapEncryptedDatabase(dataDir);
    try {
      runMigrations(boot.db);
      const repo = new BudgetCrudRepository(boot.db);
      const vendorId = repo.createVendor({ name: "Vendor A" });
      const currentServiceId = repo.createService({
        vendorId,
        name: "Current Suite",
        status: "active",
        annualSpendMinor: 20_000
      });
      const bundleExpenseId = repo.createExpenseLineWithOptionalRecurrence({
        scenarioId: "baseline",
        serviceId: currentServiceId,
        name: "Hardware maintenance",
        expenseType: "one_time",
        status: "planned",
        amountMinor: 6_000,
        currency: "USD",
        startDate: "2026-01-01"
      });

      const servicePlanId = createServicePlan(boot.db, {
        scenarioId: "baseline",
        serviceId: currentServiceId,
        plannedAction: "replace",
        replacementRequired: true
      });

      const capabilityX = upsertCapability(boot.db, { name: "Identity" });
      const capabilityY = upsertCapability(boot.db, { name: "Endpoint" });
      const capabilityZ = upsertCapability(boot.db, { name: "Hardware support" });

      replaceCapabilityAssignments(boot.db, {
        entityType: "service",
        entityId: currentServiceId,
        capabilityIds: [capabilityX.id, capabilityY.id]
      });
      replaceCapabilityAssignments(boot.db, {
        entityType: "expense_line",
        entityId: bundleExpenseId,
        capabilityIds: [capabilityZ.id]
      });

      setServicePlanSourceItems(boot.db, {
        servicePlanId,
        items: [{ entityType: "expense_line", entityId: bundleExpenseId }]
      });

      const partialBundleId = upsertReplacementCandidate(boot.db, {
        servicePlanId,
        candidateName: "Lower-cost partial bundle",
        annualCostMinor: 15_000,
        currency: "USD",
        scorecard: {
          cost: 90,
          featureFit: 70,
          migrationRisk: 60,
          supportQuality: 75
        }
      });
      const fullBundleId = upsertReplacementCandidate(boot.db, {
        servicePlanId,
        candidateName: "Unified platform",
        annualCostMinor: 18_000,
        currency: "USD",
        scorecard: {
          cost: 80,
          featureFit: 92,
          migrationRisk: 74,
          supportQuality: 88
        }
      });

      replaceCapabilityAssignments(boot.db, {
        entityType: "replacement_candidate",
        entityId: partialBundleId,
        capabilityIds: [capabilityX.id, capabilityY.id]
      });
      replaceCapabilityAssignments(boot.db, {
        entityType: "replacement_candidate",
        entityId: fullBundleId,
        capabilityIds: [capabilityX.id, capabilityY.id, capabilityZ.id]
      });

      expect(listCapabilities(boot.db)).toHaveLength(3);
      expect(
        listEntityCapabilities(boot.db, {
          entityType: "replacement_candidate",
          entityId: fullBundleId
        }).map((capability) => capability.name)
      ).toEqual(["Endpoint", "Hardware support", "Identity"]);

      const summary = buildReplacementCoverageSummary(boot.db, servicePlanId);
      expect(summary.currentAnnualCostMinor).toBe(26_000);
      expect(summary.currentItems).toHaveLength(2);
      expect(summary.currentItems[0]?.implicit).toBe(true);
      expect(summary.currentCapabilities.map((capability) => capability.name)).toEqual([
        "Endpoint",
        "Hardware support",
        "Identity"
      ]);

      const fullBundle = summary.candidateComparisons.find(
        (candidate) => candidate.candidateId === fullBundleId
      );
      expect(fullBundle).toBeDefined();
      expect(fullBundle?.proposedAnnualCostMinor).toBe(18_000);
      expect(fullBundle?.netDeltaMinor).toBe(-8_000);
      expect(fullBundle?.coveragePct).toBe(100);
      expect(fullBundle?.gapCount).toBe(0);

      const partialBundle = summary.candidateComparisons.find(
        (candidate) => candidate.candidateId === partialBundleId
      );
      expect(partialBundle).toBeDefined();
      expect(partialBundle?.netDeltaMinor).toBe(-11_000);
      expect(partialBundle?.coveragePct).toBeCloseTo(66.7, 1);
      expect(partialBundle?.gapCapabilities.map((capability) => capability.name)).toEqual([
        "Hardware support"
      ]);
    } finally {
      boot.db.close();
    }
  });
});
