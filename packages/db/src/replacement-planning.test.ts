import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { bootstrapEncryptedDatabase } from "./encrypted-db";
import { runMigrations } from "./migrations";
import {
  createAttachmentReference,
  createServicePlan,
  getReplacementPlanDetail,
  listAttachmentReferences,
  setReplacementSelection,
  transitionServicePlan,
  upsertReplacementCandidate
} from "./replacement-planning";
import { BudgetCrudRepository } from "./repositories";

const tempRoots: string[] = [];

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "budgetit-replacement-"));
  tempRoots.push(dir);
  return dir;
}

describe("replacement planning workflows", () => {
  afterEach(() => {
    for (const dir of tempRoots.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("enforces required fields during workflow transitions", () => {
    const dataDir = createTempDir();
    const boot = bootstrapEncryptedDatabase(dataDir);
    try {
      runMigrations(boot.db);
      const repo = new BudgetCrudRepository(boot.db);
      const vendorId = repo.createVendor({ name: "Vendor" });
      const currentServiceId = repo.createService({
        vendorId,
        name: "Current Service",
        status: "active"
      });
      const replacementServiceId = repo.createService({
        vendorId,
        name: "Replacement Service",
        status: "active"
      });

      const servicePlanId = createServicePlan(boot.db, {
        scenarioId: "baseline",
        serviceId: currentServiceId,
        plannedAction: "replace",
        replacementRequired: true
      });

      transitionServicePlan(boot.db, {
        servicePlanId,
        nextStatus: "reviewed"
      });

      expect(() =>
        transitionServicePlan(boot.db, {
          servicePlanId,
          nextStatus: "approved"
        })
      ).toThrow(/reasonCode is required/);

      expect(() =>
        transitionServicePlan(boot.db, {
          servicePlanId,
          nextStatus: "approved",
          reasonCode: "eol"
        })
      ).toThrow(/replacementSelectedServiceId is required/);

      setReplacementSelection(boot.db, {
        servicePlanId,
        replacementSelectedServiceId: replacementServiceId
      });

      transitionServicePlan(boot.db, {
        servicePlanId,
        nextStatus: "approved",
        reasonCode: "eol"
      });

      const row = boot.db
        .prepare("SELECT decision_status, reason_code FROM service_plan WHERE id = ?")
        .get(servicePlanId) as { decision_status: string; reason_code: string | null };
      expect(row.decision_status).toBe("approved");
      expect(row.reason_code).toBe("eol");
    } finally {
      boot.db.close();
    }
  });

  it("returns replacement candidate score aggregation in plan detail", () => {
    const dataDir = createTempDir();
    const boot = bootstrapEncryptedDatabase(dataDir);
    try {
      runMigrations(boot.db);
      const repo = new BudgetCrudRepository(boot.db);
      const vendorId = repo.createVendor({ name: "Vendor" });
      const currentServiceId = repo.createService({
        vendorId,
        name: "Current Service",
        status: "active"
      });

      const servicePlanId = createServicePlan(boot.db, {
        scenarioId: "baseline",
        serviceId: currentServiceId,
        plannedAction: "replace",
        replacementRequired: true
      });

      const candidateA = upsertReplacementCandidate(boot.db, {
        servicePlanId,
        candidateName: "Option A",
        scorecard: {
          cost: 70,
          featureFit: 80,
          migrationRisk: 60,
          supportQuality: 75
        }
      });
      const candidateB = upsertReplacementCandidate(boot.db, {
        servicePlanId,
        candidateName: "Option B",
        scorecard: {
          cost: 85,
          featureFit: 90,
          migrationRisk: 80,
          supportQuality: 88
        }
      });

      const detail = getReplacementPlanDetail(boot.db, servicePlanId);
      expect(detail.aggregation.candidateCount).toBe(2);
      expect(detail.aggregation.bestCandidateId).toBe(candidateB);
      expect(detail.aggregation.bestWeightedScore).toBeGreaterThan(
        detail.candidates.find((entry) => entry.id === candidateA)?.weightedScore ?? 0
      );
      expect(detail.aggregation.averageWeightedScore).toBeGreaterThan(0);
      expect(detail.candidates[0].id).toBe(candidateB);

      const attachmentId = createAttachmentReference(boot.db, {
        entityType: "service_plan",
        entityId: servicePlanId,
        fileName: "comparison.pdf.enc",
        filePath: "C:/secure/comparison.pdf.enc",
        contentSha256: "abc123"
      });
      const attachments = listAttachmentReferences(boot.db, "service_plan", servicePlanId);
      expect(attachments).toHaveLength(1);
      expect(attachments[0].id).toBe(attachmentId);
      expect(attachments[0].fileName).toBe("comparison.pdf.enc");
    } finally {
      boot.db.close();
    }
  });
});
