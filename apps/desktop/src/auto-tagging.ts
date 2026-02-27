import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { BudgetCrudRepository } from "@budgetit/db";
import type Database from "better-sqlite3-multiple-ciphers";

export type AutoTagRuleCondition = {
  vendorId?: string;
  descriptionContains?: string;
  costCenter?: string;
  amountMinMinor?: number;
  amountMaxMinor?: number;
};

export type AutoTagRule = {
  id: string;
  name: string;
  dimensionId: string;
  tagId: string;
  priority: number;
  enabled: boolean;
  conditions: AutoTagRuleCondition;
};

export type AutoTagCandidate = {
  entityType: "expense_line";
  entityId: string;
  vendorId?: string;
  description?: string;
  costCenter?: string;
  amountMinor: number;
};

export type AutoTagMatch = {
  ruleId: string;
  ruleName: string;
  dimensionId: string;
  tagId: string;
  explanation: string;
  score: number;
};

export type AutoTagSuggestion = {
  dimensionId: string;
  tagId: string;
  evidenceCount: number;
  conditions: AutoTagRuleCondition;
};

export type ManualTagCorrection = {
  entityType: "expense_line";
  entityId: string;
  dimensionId: string;
  fromTagId: string | null;
  toTagId: string;
  vendorId?: string;
  description?: string;
  costCenter?: string;
  amountMinor: number;
};

type AutoTagRuleStore = {
  rules: AutoTagRule[];
};

type StoredManualCorrection = {
  dimensionId: string;
  toTagId: string;
  vendorId?: string;
  description?: string;
  costCenter?: string;
  amountMinor: number;
};

function normalizeText(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function buildRuleExplanation(rule: AutoTagRule, reasons: string[]): string {
  return `Rule ${rule.name} (${rule.id}) matched: ${reasons.join("; ")}`;
}

function evaluateRule(rule: AutoTagRule, candidate: AutoTagCandidate): AutoTagMatch | null {
  if (!rule.enabled) {
    return null;
  }

  const reasons: string[] = [];
  let conditionCount = 0;
  const conditions = rule.conditions;

  if (conditions.vendorId) {
    conditionCount += 1;
    if (normalizeText(candidate.vendorId) !== normalizeText(conditions.vendorId)) {
      return null;
    }
    reasons.push(`vendorId=${conditions.vendorId}`);
  }

  if (conditions.descriptionContains) {
    conditionCount += 1;
    const needle = normalizeText(conditions.descriptionContains);
    if (!normalizeText(candidate.description).includes(needle)) {
      return null;
    }
    reasons.push(`description contains "${conditions.descriptionContains}"`);
  }

  if (conditions.costCenter) {
    conditionCount += 1;
    if (normalizeText(candidate.costCenter) !== normalizeText(conditions.costCenter)) {
      return null;
    }
    reasons.push(`costCenter=${conditions.costCenter}`);
  }

  if (typeof conditions.amountMinMinor === "number") {
    conditionCount += 1;
    if (candidate.amountMinor < conditions.amountMinMinor) {
      return null;
    }
    reasons.push(`amount >= ${conditions.amountMinMinor}`);
  }

  if (typeof conditions.amountMaxMinor === "number") {
    conditionCount += 1;
    if (candidate.amountMinor > conditions.amountMaxMinor) {
      return null;
    }
    reasons.push(`amount <= ${conditions.amountMaxMinor}`);
  }

  if (conditionCount === 0) {
    return null;
  }

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    dimensionId: rule.dimensionId,
    tagId: rule.tagId,
    score: rule.priority * 100 + conditionCount,
    explanation: buildRuleExplanation(rule, reasons)
  };
}

function sortMatchesDescending(left: AutoTagMatch, right: AutoTagMatch): number {
  if (left.score !== right.score) {
    return right.score - left.score;
  }
  if (left.ruleName !== right.ruleName) {
    return left.ruleName.localeCompare(right.ruleName);
  }
  return left.ruleId.localeCompare(right.ruleId);
}

export function evaluateAutoTagRules(
  rules: AutoTagRule[],
  candidate: AutoTagCandidate
): AutoTagMatch[] {
  const matches = rules
    .map((rule) => evaluateRule(rule, candidate))
    .filter((match): match is AutoTagMatch => match !== null)
    .sort(sortMatchesDescending);

  const chosenByDimension = new Set<string>();
  const chosen: AutoTagMatch[] = [];
  for (const match of matches) {
    if (chosenByDimension.has(match.dimensionId)) {
      continue;
    }
    chosenByDimension.add(match.dimensionId);
    chosen.push(match);
  }

  return chosen;
}

export function applyAutoTagRules(
  db: Database.Database,
  rules: AutoTagRule[],
  candidate: AutoTagCandidate
): AutoTagMatch[] {
  const selectedMatches = evaluateAutoTagRules(rules, candidate);
  if (selectedMatches.length === 0) {
    return [];
  }

  const repo = new BudgetCrudRepository(db);
  const write = db.transaction(() => {
    for (const match of selectedMatches) {
      repo.assignTagToEntity({
        entityType: candidate.entityType,
        entityId: candidate.entityId,
        dimensionId: match.dimensionId,
        tagId: match.tagId
      });

      db.prepare(
        `
          INSERT INTO audit_log (
            id,
            actor,
            action,
            entity_type,
            entity_id,
            before_json,
            after_json,
            created_at
          ) VALUES (?, 'system', 'tag_assignment.auto_rule_applied', ?, ?, NULL, ?, CURRENT_TIMESTAMP)
        `
      ).run(
        crypto.randomUUID(),
        candidate.entityType,
        candidate.entityId,
        JSON.stringify({
          ruleId: match.ruleId,
          ruleName: match.ruleName,
          dimensionId: match.dimensionId,
          tagId: match.tagId,
          explanation: match.explanation
        })
      );
    }
  });
  write();

  return selectedMatches;
}

export function recordManualTagCorrection(
  db: Database.Database,
  correction: ManualTagCorrection
): void {
  const payload: StoredManualCorrection = {
    dimensionId: correction.dimensionId,
    toTagId: correction.toTagId,
    vendorId: correction.vendorId,
    description: correction.description,
    costCenter: correction.costCenter,
    amountMinor: correction.amountMinor
  };

  db.prepare(
    `
      INSERT INTO audit_log (
        id,
        actor,
        action,
        entity_type,
        entity_id,
        before_json,
        after_json,
        created_at
      ) VALUES (?, 'user', 'tag_assignment.manual_correction', ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `
  ).run(
    crypto.randomUUID(),
    correction.entityType,
    correction.entityId,
    JSON.stringify({ fromTagId: correction.fromTagId }),
    JSON.stringify(payload)
  );
}

export function suggestRulesFromManualCorrections(
  db: Database.Database,
  threshold = 3
): AutoTagSuggestion[] {
  const rows = db
    .prepare(
      `
        SELECT after_json
        FROM audit_log
        WHERE action = 'tag_assignment.manual_correction'
          AND entity_type = 'expense_line'
      `
    )
    .all() as Array<{ after_json: string | null }>;

  const parsed = rows
    .map((row) => {
      if (!row.after_json) {
        return null;
      }
      try {
        return JSON.parse(row.after_json) as StoredManualCorrection;
      } catch {
        return null;
      }
    })
    .filter((entry): entry is StoredManualCorrection => {
      return (
        entry !== null &&
        typeof entry.dimensionId === "string" &&
        typeof entry.toTagId === "string" &&
        typeof entry.amountMinor === "number"
      );
    });

  const grouped = new Map<string, StoredManualCorrection[]>();
  for (const entry of parsed) {
    const key = [
      entry.dimensionId,
      entry.toTagId,
      normalizeText(entry.vendorId),
      normalizeText(entry.description),
      normalizeText(entry.costCenter)
    ].join("|");
    const bucket = grouped.get(key) ?? [];
    bucket.push(entry);
    grouped.set(key, bucket);
  }

  const suggestions: AutoTagSuggestion[] = [];
  for (const corrections of grouped.values()) {
    if (corrections.length < threshold) {
      continue;
    }

    const first = corrections[0];
    const amounts = corrections.map((entry) => entry.amountMinor);
    suggestions.push({
      dimensionId: first.dimensionId,
      tagId: first.toTagId,
      evidenceCount: corrections.length,
      conditions: {
        vendorId: first.vendorId,
        descriptionContains: first.description,
        costCenter: first.costCenter,
        amountMinMinor: Math.min(...amounts),
        amountMaxMinor: Math.max(...amounts)
      }
    });
  }

  return suggestions.sort((left, right) => right.evidenceCount - left.evidenceCount);
}

export function buildRuleFromSuggestion(
  suggestion: AutoTagSuggestion,
  input: { id: string; name: string; priority?: number; enabled?: boolean }
): AutoTagRule {
  return {
    id: input.id,
    name: input.name,
    dimensionId: suggestion.dimensionId,
    tagId: suggestion.tagId,
    priority: input.priority ?? 1,
    enabled: input.enabled ?? true,
    conditions: suggestion.conditions
  };
}

export function loadAutoTagRules(filePath: string): AutoTagRule[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Partial<AutoTagRuleStore>;
  if (!Array.isArray(parsed.rules)) {
    return [];
  }

  return parsed.rules.filter((rule): rule is AutoTagRule => {
    return (
      typeof rule?.id === "string" &&
      typeof rule?.name === "string" &&
      typeof rule?.dimensionId === "string" &&
      typeof rule?.tagId === "string" &&
      typeof rule?.priority === "number" &&
      typeof rule?.enabled === "boolean" &&
      typeof rule?.conditions === "object" &&
      rule.conditions !== null
    );
  });
}

export function saveAutoTagRules(filePath: string, rules: AutoTagRule[]): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    `${JSON.stringify({ rules } satisfies AutoTagRuleStore, null, 2)}\n`,
    "utf8"
  );
}
