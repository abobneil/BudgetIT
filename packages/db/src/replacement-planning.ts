import crypto from "node:crypto";

import type Database from "better-sqlite3-multiple-ciphers";

export type ServicePlanDecisionStatus = "draft" | "reviewed" | "approved" | "rejected";
export type ServicePlanAction = "keep" | "replace" | "retire";
export type ServicePlanReasonCode =
  | "cost"
  | "security"
  | "eol"
  | "consolidation"
  | "performance"
  | "other";

export type ReplacementScorecardWeights = {
  cost: number;
  featureFit: number;
  migrationRisk: number;
  supportQuality: number;
};

export type ReplacementScorecardInput = {
  cost: number;
  featureFit: number;
  migrationRisk: number;
  supportQuality: number;
  weights?: Partial<ReplacementScorecardWeights>;
};

export type ReplacementCandidateDetail = {
  id: string;
  servicePlanId: string;
  candidateServiceId: string | null;
  candidateName: string | null;
  weightedScore: number;
  scorecard: ReplacementScorecardInput;
};

export type ReplacementPlanDetail = {
  servicePlan: {
    id: string;
    scenarioId: string;
    serviceId: string;
    plannedAction: ServicePlanAction;
    decisionStatus: ServicePlanDecisionStatus;
    reasonCode: string | null;
    replacementRequired: boolean;
    replacementSelectedServiceId: string | null;
  };
  candidates: ReplacementCandidateDetail[];
  aggregation: {
    candidateCount: number;
    averageWeightedScore: number;
    bestCandidateId: string | null;
    bestWeightedScore: number | null;
  };
};

const DEFAULT_WEIGHTS: ReplacementScorecardWeights = {
  cost: 0.35,
  featureFit: 0.3,
  migrationRisk: 0.2,
  supportQuality: 0.15
};

const TRANSITIONS: Record<ServicePlanDecisionStatus, ServicePlanDecisionStatus[]> = {
  draft: ["reviewed"],
  reviewed: ["approved", "rejected", "draft"],
  approved: [],
  rejected: ["draft"]
};

function assertScore(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`${field} must be a number between 0 and 100.`);
  }
}

function resolveWeights(
  input: Partial<ReplacementScorecardWeights> | undefined
): ReplacementScorecardWeights {
  const merged: ReplacementScorecardWeights = {
    ...DEFAULT_WEIGHTS,
    ...(input ?? {})
  };
  const total = merged.cost + merged.featureFit + merged.migrationRisk + merged.supportQuality;
  if (Math.abs(total - 1) > 0.001) {
    throw new Error("Scorecard weights must sum to 1.");
  }
  return merged;
}

export function computeWeightedScore(input: ReplacementScorecardInput): number {
  assertScore(input.cost, "cost");
  assertScore(input.featureFit, "featureFit");
  assertScore(input.migrationRisk, "migrationRisk");
  assertScore(input.supportQuality, "supportQuality");

  const weights = resolveWeights(input.weights);
  const weighted =
    input.cost * weights.cost +
    input.featureFit * weights.featureFit +
    input.migrationRisk * weights.migrationRisk +
    input.supportQuality * weights.supportQuality;
  return Math.round(weighted * 100) / 100;
}

export function createServicePlan(
  db: Database.Database,
  input: {
    scenarioId: string;
    serviceId: string;
    plannedAction: ServicePlanAction;
    replacementRequired: boolean;
    mustReplaceBy?: string;
  }
): string {
  const id = crypto.randomUUID();
  db.prepare(
    `
      INSERT INTO service_plan (
        id,
        scenario_id,
        service_id,
        planned_action,
        decision_status,
        reason_code,
        must_replace_by,
        replacement_required,
        replacement_selected_service_id,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, 'draft', NULL, ?, ?, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `
  ).run(
    id,
    input.scenarioId,
    input.serviceId,
    input.plannedAction,
    input.mustReplaceBy ?? null,
    input.replacementRequired ? 1 : 0
  );
  return id;
}

export function setReplacementSelection(
  db: Database.Database,
  input: {
    servicePlanId: string;
    replacementSelectedServiceId: string | null;
  }
): void {
  db.prepare(
    `
      UPDATE service_plan
      SET replacement_selected_service_id = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `
  ).run(input.replacementSelectedServiceId, input.servicePlanId);
}

export function transitionServicePlan(
  db: Database.Database,
  input: {
    servicePlanId: string;
    nextStatus: ServicePlanDecisionStatus;
    reasonCode?: ServicePlanReasonCode;
  }
): void {
  const current = db
    .prepare(
      `
        SELECT
          decision_status,
          planned_action,
          replacement_required,
          replacement_selected_service_id
        FROM service_plan
        WHERE id = ?
      `
    )
    .get(input.servicePlanId) as
    | {
        decision_status: ServicePlanDecisionStatus;
        planned_action: ServicePlanAction;
        replacement_required: number;
        replacement_selected_service_id: string | null;
      }
    | undefined;

  if (!current) {
    throw new Error(`Service plan not found: ${input.servicePlanId}`);
  }
  if (!TRANSITIONS[current.decision_status].includes(input.nextStatus)) {
    throw new Error(
      `Invalid transition: ${current.decision_status} -> ${input.nextStatus}`
    );
  }

  if ((input.nextStatus === "approved" || input.nextStatus === "rejected") && !input.reasonCode) {
    throw new Error("reasonCode is required when approving or rejecting a service plan.");
  }

  if (
    input.nextStatus === "approved" &&
    current.planned_action === "replace" &&
    current.replacement_required === 1 &&
    !current.replacement_selected_service_id
  ) {
    throw new Error(
      "replacementSelectedServiceId is required before approving a replacement-required plan."
    );
  }

  db.prepare(
    `
      UPDATE service_plan
      SET decision_status = ?,
          reason_code = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `
  ).run(input.nextStatus, input.reasonCode ?? null, input.servicePlanId);
}

export function upsertReplacementCandidate(
  db: Database.Database,
  input: {
    id?: string;
    servicePlanId: string;
    candidateServiceId?: string;
    candidateName?: string;
    scorecard: ReplacementScorecardInput;
  }
): string {
  const id = input.id ?? crypto.randomUUID();
  const weightedScore = computeWeightedScore(input.scorecard);
  const scorecardJson = JSON.stringify(input.scorecard);
  const existing = db
    .prepare("SELECT id FROM replacement_candidate WHERE id = ?")
    .get(id) as { id: string } | undefined;

  if (existing) {
    db.prepare(
      `
        UPDATE replacement_candidate
        SET service_plan_id = ?,
            candidate_service_id = ?,
            candidate_name = ?,
            score = ?,
            scorecard_json = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `
    ).run(
      input.servicePlanId,
      input.candidateServiceId ?? null,
      input.candidateName ?? null,
      weightedScore,
      scorecardJson,
      id
    );
    return id;
  }

  db.prepare(
    `
      INSERT INTO replacement_candidate (
        id,
        service_plan_id,
        candidate_service_id,
        candidate_name,
        score,
        scorecard_json,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `
  ).run(
    id,
    input.servicePlanId,
    input.candidateServiceId ?? null,
    input.candidateName ?? null,
    weightedScore,
    scorecardJson
  );
  return id;
}

function parseScorecardJson(value: string | null): ReplacementScorecardInput {
  if (!value) {
    return {
      cost: 0,
      featureFit: 0,
      migrationRisk: 0,
      supportQuality: 0
    };
  }

  try {
    return JSON.parse(value) as ReplacementScorecardInput;
  } catch {
    return {
      cost: 0,
      featureFit: 0,
      migrationRisk: 0,
      supportQuality: 0
    };
  }
}

export function getReplacementPlanDetail(
  db: Database.Database,
  servicePlanId: string
): ReplacementPlanDetail {
  const servicePlan = db
    .prepare(
      `
        SELECT
          id,
          scenario_id,
          service_id,
          planned_action,
          decision_status,
          reason_code,
          replacement_required,
          replacement_selected_service_id
        FROM service_plan
        WHERE id = ?
      `
    )
    .get(servicePlanId) as
    | {
        id: string;
        scenario_id: string;
        service_id: string;
        planned_action: ServicePlanAction;
        decision_status: ServicePlanDecisionStatus;
        reason_code: string | null;
        replacement_required: number;
        replacement_selected_service_id: string | null;
      }
    | undefined;

  if (!servicePlan) {
    throw new Error(`Service plan not found: ${servicePlanId}`);
  }

  const rows = db
    .prepare(
      `
        SELECT
          id,
          service_plan_id,
          candidate_service_id,
          candidate_name,
          score,
          scorecard_json
        FROM replacement_candidate
        WHERE service_plan_id = ?
        ORDER BY score DESC, candidate_name ASC
      `
    )
    .all(servicePlanId) as Array<{
    id: string;
    service_plan_id: string;
    candidate_service_id: string | null;
    candidate_name: string | null;
    score: number | null;
    scorecard_json: string | null;
  }>;

  const candidates: ReplacementCandidateDetail[] = rows.map((row) => ({
    id: row.id,
    servicePlanId: row.service_plan_id,
    candidateServiceId: row.candidate_service_id,
    candidateName: row.candidate_name,
    weightedScore: row.score ?? 0,
    scorecard: parseScorecardJson(row.scorecard_json)
  }));

  const candidateCount = candidates.length;
  const sum = candidates.reduce((acc, row) => acc + row.weightedScore, 0);
  const best = candidates[0];

  return {
    servicePlan: {
      id: servicePlan.id,
      scenarioId: servicePlan.scenario_id,
      serviceId: servicePlan.service_id,
      plannedAction: servicePlan.planned_action,
      decisionStatus: servicePlan.decision_status,
      reasonCode: servicePlan.reason_code,
      replacementRequired: servicePlan.replacement_required === 1,
      replacementSelectedServiceId: servicePlan.replacement_selected_service_id
    },
    candidates,
    aggregation: {
      candidateCount,
      averageWeightedScore: candidateCount > 0 ? Math.round((sum / candidateCount) * 100) / 100 : 0,
      bestCandidateId: best?.id ?? null,
      bestWeightedScore: best?.weightedScore ?? null
    }
  };
}

export function createAttachmentReference(
  db: Database.Database,
  input: {
    entityType: string;
    entityId: string;
    fileName: string;
    filePath: string;
    contentSha256: string;
  }
): string {
  const id = crypto.randomUUID();
  db.prepare(
    `
      INSERT INTO attachment (
        id,
        entity_type,
        entity_id,
        file_name,
        file_path,
        content_sha256,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `
  ).run(
    id,
    input.entityType,
    input.entityId,
    input.fileName,
    input.filePath,
    input.contentSha256
  );
  return id;
}

export function listAttachmentReferences(
  db: Database.Database,
  entityType: string,
  entityId: string
): Array<{
  id: string;
  fileName: string;
  filePath: string;
  contentSha256: string | null;
}> {
  return db
    .prepare(
      `
        SELECT id, file_name AS fileName, file_path AS filePath, content_sha256 AS contentSha256
        FROM attachment
        WHERE entity_type = ?
          AND entity_id = ?
        ORDER BY created_at DESC
      `
    )
    .all(entityType, entityId) as Array<{
    id: string;
    fileName: string;
    filePath: string;
    contentSha256: string | null;
  }>;
}
