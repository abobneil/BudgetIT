import crypto from "node:crypto";

import type Database from "better-sqlite3-multiple-ciphers";

export type CapabilityEntityType =
  | "vendor"
  | "service"
  | "contract"
  | "expense_line"
  | "replacement_candidate";

export type CapabilityRecord = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
};

export type CoverageItemRecord = {
  entityType: Exclude<CapabilityEntityType, "replacement_candidate">;
  entityId: string;
  label: string;
  annualCostMinor: number;
  currency: string;
  capabilities: CapabilityRecord[];
  implicit: boolean;
};

export type ReplacementCandidateCoverageComparison = {
  candidateId: string;
  candidateName: string | null;
  currency: string;
  currentAnnualCostMinor: number;
  proposedAnnualCostMinor: number;
  netDeltaMinor: number;
  coveragePct: number;
  overlapCount: number;
  gapCount: number;
  addedCount: number;
  overlapCapabilities: CapabilityRecord[];
  gapCapabilities: CapabilityRecord[];
  addedCapabilities: CapabilityRecord[];
};

export type ReplacementCoverageSummary = {
  currency: string;
  currentAnnualCostMinor: number;
  currentCapabilities: CapabilityRecord[];
  currentItems: CoverageItemRecord[];
  candidateComparisons: ReplacementCandidateCoverageComparison[];
};

const CAPABILITY_ENTITY_TYPES = new Set<CapabilityEntityType>([
  "vendor",
  "service",
  "contract",
  "expense_line",
  "replacement_candidate"
]);

const PLAN_SOURCE_ENTITY_TYPES = new Set<CoverageItemRecord["entityType"]>([
  "vendor",
  "service",
  "contract",
  "expense_line"
]);

type ReplacementCandidateRow = {
  id: string;
  candidate_service_id: string | null;
  candidate_name: string | null;
  annual_cost_minor: number;
  currency: string;
};

type ServicePlanRow = {
  id: string;
  scenario_id: string;
  service_id: string;
};

function assertCapabilityEntityType(value: string): CapabilityEntityType {
  if (!CAPABILITY_ENTITY_TYPES.has(value as CapabilityEntityType)) {
    throw new Error(`Unsupported capability entity type: ${value}`);
  }
  return value as CapabilityEntityType;
}

function assertPlanSourceEntityType(value: string): CoverageItemRecord["entityType"] {
  if (!PLAN_SOURCE_ENTITY_TYPES.has(value as CoverageItemRecord["entityType"])) {
    throw new Error(`Unsupported replacement scope entity type: ${value}`);
  }
  return value as CoverageItemRecord["entityType"];
}

function getScenarioCurrency(db: Database.Database, scenarioId: string): string {
  const row = db
    .prepare(
      `
        SELECT default_currency AS defaultCurrency
        FROM scenario_settings
        WHERE scenario_id = ?
      `
    )
    .get(scenarioId) as { defaultCurrency: string | null } | undefined;
  const candidate = row?.defaultCurrency?.trim().toUpperCase();
  return candidate && /^[A-Z]{3}$/.test(candidate) ? candidate : "USD";
}

function listCapabilitiesByEntity(
  db: Database.Database,
  entityType: CapabilityEntityType,
  entityId: string
): CapabilityRecord[] {
  return db
    .prepare(
      `
        SELECT
          c.id,
          c.name,
          c.category,
          c.description
        FROM capability_assignment a
        INNER JOIN capability c
          ON c.id = a.capability_id
        WHERE a.entity_type = ?
          AND a.entity_id = ?
        ORDER BY c.name COLLATE NOCASE ASC, c.id ASC
      `
    )
    .all(entityType, entityId) as CapabilityRecord[];
}

function mergeCapabilities(...groups: CapabilityRecord[][]): CapabilityRecord[] {
  const seen = new Map<string, CapabilityRecord>();
  for (const group of groups) {
    for (const capability of group) {
      if (!seen.has(capability.id)) {
        seen.set(capability.id, capability);
      }
    }
  }
  return Array.from(seen.values()).sort(
    (left, right) =>
      left.name.localeCompare(right.name, undefined, { sensitivity: "base" }) ||
      left.id.localeCompare(right.id)
  );
}

function resolveCoverageItem(
  db: Database.Database,
  scenarioId: string,
  entityType: CoverageItemRecord["entityType"],
  entityId: string,
  implicit: boolean
): CoverageItemRecord {
  const fallbackCurrency = getScenarioCurrency(db, scenarioId);

  if (entityType === "service") {
    const row = db
      .prepare(
        `
          SELECT name, annual_spend_minor AS annualSpendMinor
          FROM service
          WHERE id = ?
            AND deleted_at IS NULL
        `
      )
      .get(entityId) as { name: string; annualSpendMinor: number } | undefined;
    if (!row) {
      throw new Error(`Service not found for capability coverage: ${entityId}`);
    }
    return {
      entityType,
      entityId,
      label: row.name,
      annualCostMinor: row.annualSpendMinor ?? 0,
      currency: fallbackCurrency,
      capabilities: listCapabilitiesByEntity(db, entityType, entityId),
      implicit
    };
  }

  if (entityType === "vendor") {
    const row = db
      .prepare(
        `
          SELECT name, annual_spend_minor AS annualSpendMinor
          FROM vendor
          WHERE id = ?
            AND deleted_at IS NULL
        `
      )
      .get(entityId) as { name: string; annualSpendMinor: number } | undefined;
    if (!row) {
      throw new Error(`Vendor not found for capability coverage: ${entityId}`);
    }
    return {
      entityType,
      entityId,
      label: row.name,
      annualCostMinor: row.annualSpendMinor ?? 0,
      currency: fallbackCurrency,
      capabilities: listCapabilitiesByEntity(db, entityType, entityId),
      implicit
    };
  }

  if (entityType === "contract") {
    const row = db
      .prepare(
        `
          SELECT
            COALESCE(contract_number, id) AS label,
            COALESCE((
              SELECT SUM(amount_minor)
              FROM expense_line
              WHERE scenario_id = ?
                AND contract_id = contract.id
                AND deleted_at IS NULL
            ), 0) AS annualCostMinor,
            COALESCE((
              SELECT MAX(currency)
              FROM expense_line
              WHERE scenario_id = ?
                AND contract_id = contract.id
                AND deleted_at IS NULL
            ), ?) AS currency
          FROM contract
          WHERE id = ?
            AND deleted_at IS NULL
        `
      )
      .get(scenarioId, scenarioId, fallbackCurrency, entityId) as
      | { label: string; annualCostMinor: number; currency: string }
      | undefined;
    if (!row) {
      throw new Error(`Contract not found for capability coverage: ${entityId}`);
    }
    return {
      entityType,
      entityId,
      label: row.label,
      annualCostMinor: row.annualCostMinor ?? 0,
      currency: row.currency ?? fallbackCurrency,
      capabilities: listCapabilitiesByEntity(db, entityType, entityId),
      implicit
    };
  }

  const row = db
    .prepare(
      `
        SELECT
          name AS label,
          amount_minor AS annualCostMinor,
          currency
        FROM expense_line
        WHERE id = ?
          AND scenario_id = ?
          AND deleted_at IS NULL
      `
    )
    .get(entityId, scenarioId) as
    | {
        label: string;
        annualCostMinor: number;
        currency: string;
      }
    | undefined;
  if (!row) {
    throw new Error(`Expense line not found for capability coverage: ${entityId}`);
  }
  return {
    entityType,
    entityId,
    label: row.label,
    annualCostMinor: row.annualCostMinor ?? 0,
    currency: row.currency ?? fallbackCurrency,
    capabilities: listCapabilitiesByEntity(db, entityType, entityId),
    implicit
  };
}

function getServicePlanScopeRow(db: Database.Database, servicePlanId: string): ServicePlanRow {
  const row = db
    .prepare(
      `
        SELECT id, scenario_id, service_id
        FROM service_plan
        WHERE id = ?
      `
    )
    .get(servicePlanId) as ServicePlanRow | undefined;
  if (!row) {
    throw new Error(`Service plan not found: ${servicePlanId}`);
  }
  return row;
}

function listExplicitScopeItems(
  db: Database.Database,
  servicePlanId: string
): Array<{ entityType: CoverageItemRecord["entityType"]; entityId: string }> {
  return db
    .prepare(
      `
        SELECT entity_type AS entityType, entity_id AS entityId
        FROM service_plan_source_item
        WHERE service_plan_id = ?
        ORDER BY entity_type ASC, entity_id ASC
      `
    )
    .all(servicePlanId) as Array<{
    entityType: CoverageItemRecord["entityType"];
    entityId: string;
  }>;
}

export function listCapabilities(db: Database.Database): CapabilityRecord[] {
  return db
    .prepare(
      `
        SELECT id, name, category, description
        FROM capability
        ORDER BY name COLLATE NOCASE ASC, id ASC
      `
    )
    .all() as CapabilityRecord[];
}

export function upsertCapability(
  db: Database.Database,
  input: {
    id?: string;
    name: string;
    category?: string | null;
    description?: string | null;
  }
): CapabilityRecord {
  const name = input.name.trim();
  if (name.length === 0) {
    throw new Error("Capability name is required.");
  }

  const id = input.id ?? crypto.randomUUID();
  const category = input.category?.trim() || null;
  const description = input.description?.trim() || null;
  const exists = db.prepare("SELECT id FROM capability WHERE id = ?").get(id) as
    | { id: string }
    | undefined;

  if (exists) {
    db.prepare(
      `
        UPDATE capability
        SET name = ?,
            category = ?,
            description = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `
    ).run(name, category, description, id);
  } else {
    db.prepare(
      `
        INSERT INTO capability (
          id,
          name,
          category,
          description,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `
    ).run(id, name, category, description);
  }

  return db
    .prepare(
      `
        SELECT id, name, category, description
        FROM capability
        WHERE id = ?
      `
    )
    .get(id) as CapabilityRecord;
}

export function replaceCapabilityAssignments(
  db: Database.Database,
  input: {
    entityType: CapabilityEntityType;
    entityId: string;
    capabilityIds: string[];
  }
): CapabilityRecord[] {
  const entityType = assertCapabilityEntityType(input.entityType);
  const capabilityIds = Array.from(
    new Set(
      input.capabilityIds
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    )
  );

  if (capabilityIds.length > 0) {
    const rows = db
      .prepare(
        `
          SELECT id
          FROM capability
          WHERE id IN (${capabilityIds.map(() => "?").join(", ")})
        `
      )
      .all(...capabilityIds) as Array<{ id: string }>;
    if (rows.length !== capabilityIds.length) {
      throw new Error("All capabilityIds must reference existing capabilities.");
    }
  }

  const apply = db.transaction(() => {
    db.prepare(
      `
        DELETE FROM capability_assignment
        WHERE entity_type = ?
          AND entity_id = ?
      `
    ).run(entityType, input.entityId);

    const insert = db.prepare(
      `
        INSERT INTO capability_assignment (
          id,
          capability_id,
          entity_type,
          entity_id,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `
    );
    for (const capabilityId of capabilityIds) {
      insert.run(crypto.randomUUID(), capabilityId, entityType, input.entityId);
    }
  });

  apply();
  return listCapabilitiesByEntity(db, entityType, input.entityId);
}

export function listEntityCapabilities(
  db: Database.Database,
  input: {
    entityType: CapabilityEntityType;
    entityId: string;
  }
): CapabilityRecord[] {
  return listCapabilitiesByEntity(db, assertCapabilityEntityType(input.entityType), input.entityId);
}

export function setServicePlanSourceItems(
  db: Database.Database,
  input: {
    servicePlanId: string;
    items: Array<{
      entityType: CoverageItemRecord["entityType"];
      entityId: string;
    }>;
  }
): CoverageItemRecord[] {
  const scope = getServicePlanScopeRow(db, input.servicePlanId);
  const items = Array.from(
    new Map(
      input.items
        .map((item) => ({
          entityType: assertPlanSourceEntityType(item.entityType),
          entityId: item.entityId.trim()
        }))
        .filter((item) => item.entityId.length > 0)
        .filter((item) => !(item.entityType === "service" && item.entityId === scope.service_id))
        .map((item) => [`${item.entityType}:${item.entityId}`, item])
    ).values()
  );

  const apply = db.transaction(() => {
    db.prepare("DELETE FROM service_plan_source_item WHERE service_plan_id = ?").run(input.servicePlanId);
    const insert = db.prepare(
      `
        INSERT INTO service_plan_source_item (
          id,
          service_plan_id,
          entity_type,
          entity_id,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `
    );
    for (const item of items) {
      insert.run(crypto.randomUUID(), input.servicePlanId, item.entityType, item.entityId);
    }
  });

  apply();
  return listServicePlanSourceItems(db, input.servicePlanId);
}

export function listServicePlanSourceItems(
  db: Database.Database,
  servicePlanId: string
): CoverageItemRecord[] {
  const scope = getServicePlanScopeRow(db, servicePlanId);
  const resolved = [
    resolveCoverageItem(db, scope.scenario_id, "service", scope.service_id, true),
    ...listExplicitScopeItems(db, servicePlanId).map((item) =>
      resolveCoverageItem(db, scope.scenario_id, item.entityType, item.entityId, false)
    )
  ];

  return Array.from(
    new Map(resolved.map((item) => [`${item.entityType}:${item.entityId}`, item])).values()
  );
}

export function buildReplacementCoverageSummary(
  db: Database.Database,
  servicePlanId: string
): ReplacementCoverageSummary {
  const scope = getServicePlanScopeRow(db, servicePlanId);
  const currency = getScenarioCurrency(db, scope.scenario_id);
  const currentItems = listServicePlanSourceItems(db, servicePlanId);
  const currentCapabilities = mergeCapabilities(...currentItems.map((item) => item.capabilities));
  const currentCapabilityIds = new Set(currentCapabilities.map((capability) => capability.id));
  const currentAnnualCostMinor = currentItems.reduce((sum, item) => sum + item.annualCostMinor, 0);

  const candidates = db
    .prepare(
      `
        SELECT
          id,
          candidate_service_id,
          candidate_name,
          annual_cost_minor,
          currency
        FROM replacement_candidate
        WHERE service_plan_id = ?
        ORDER BY score DESC, candidate_name ASC, id ASC
      `
    )
    .all(servicePlanId) as ReplacementCandidateRow[];

  const candidateComparisons = candidates.map((candidate) => {
    const directCapabilities = listCapabilitiesByEntity(db, "replacement_candidate", candidate.id);
    const serviceCapabilities = candidate.candidate_service_id
      ? listCapabilitiesByEntity(db, "service", candidate.candidate_service_id)
      : [];
    const proposedCapabilities = mergeCapabilities(directCapabilities, serviceCapabilities);
    const proposedCapabilityIds = new Set(proposedCapabilities.map((capability) => capability.id));
    const overlapCapabilities = currentCapabilities.filter((capability) =>
      proposedCapabilityIds.has(capability.id)
    );
    const gapCapabilities = currentCapabilities.filter(
      (capability) => !proposedCapabilityIds.has(capability.id)
    );
    const addedCapabilities = proposedCapabilities.filter(
      (capability) => !currentCapabilityIds.has(capability.id)
    );

    let proposedAnnualCostMinor = candidate.annual_cost_minor ?? 0;
    let candidateCurrency = candidate.currency ?? currency;
    if (proposedAnnualCostMinor === 0 && candidate.candidate_service_id) {
      const candidateService = db
        .prepare(
          `
            SELECT annual_spend_minor AS annualSpendMinor
            FROM service
            WHERE id = ?
              AND deleted_at IS NULL
          `
        )
        .get(candidate.candidate_service_id) as { annualSpendMinor: number } | undefined;
      proposedAnnualCostMinor = candidateService?.annualSpendMinor ?? 0;
      candidateCurrency = currency;
    }

    return {
      candidateId: candidate.id,
      candidateName: candidate.candidate_name,
      currency: candidateCurrency,
      currentAnnualCostMinor,
      proposedAnnualCostMinor,
      netDeltaMinor: proposedAnnualCostMinor - currentAnnualCostMinor,
      coveragePct:
        currentCapabilities.length === 0
          ? 100
          : Math.round((overlapCapabilities.length / currentCapabilities.length) * 1000) / 10,
      overlapCount: overlapCapabilities.length,
      gapCount: gapCapabilities.length,
      addedCount: addedCapabilities.length,
      overlapCapabilities,
      gapCapabilities,
      addedCapabilities
    };
  });

  return {
    currency,
    currentAnnualCostMinor,
    currentCapabilities,
    currentItems,
    candidateComparisons
  };
}
