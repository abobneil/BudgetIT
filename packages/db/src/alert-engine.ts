import crypto from "node:crypto";

import type Database from "better-sqlite3-multiple-ciphers";

type AlertRuleType =
  | "upcoming_payment"
  | "renewal_window"
  | "notice_window"
  | "replacement_missing"
  | "eol_date";

type AlertRuleRow = {
  id: string;
  scenario_id: string;
  rule_type: AlertRuleType;
  params_json: string;
  enabled: number;
};

type AlertCandidate = {
  scenarioId: string;
  ruleId: string;
  ruleType: AlertRuleType;
  entityType: string;
  entityId: string;
  fireAt: string;
  message: string;
};

type AlertParams = {
  window_days?: number;
};

function parseIsoDate(dateText: string): Date {
  return new Date(`${dateText}T00:00:00.000Z`);
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function subtractDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() - days);
  return next;
}

function parseParams(paramsJson: string): AlertParams {
  try {
    return JSON.parse(paramsJson) as AlertParams;
  } catch {
    return {};
  }
}

function buildDedupeKey(candidate: AlertCandidate): string {
  return [
    candidate.ruleId,
    candidate.ruleType,
    candidate.entityType,
    candidate.entityId,
    candidate.fireAt
  ].join("|");
}

function createNoticeWindowCandidates(
  db: Database.Database,
  rule: AlertRuleRow,
  cutoffIso: string,
  nowIso: string
): AlertCandidate[] {
  const contracts = db
    .prepare(
      `
        SELECT id, renewal_date, notice_period_days
        FROM contract
        WHERE renewal_date IS NOT NULL
          AND notice_period_days IS NOT NULL
      `
    )
    .all() as Array<{ id: string; renewal_date: string; notice_period_days: number }>;

  const cutoffDate = parseIsoDate(cutoffIso);
  const nowDate = parseIsoDate(nowIso);
  const candidates: AlertCandidate[] = [];

  for (const contract of contracts) {
    const renewalDate = parseIsoDate(contract.renewal_date);
    const deadline = subtractDays(renewalDate, contract.notice_period_days);
    if (deadline >= nowDate && deadline <= cutoffDate) {
      candidates.push({
        scenarioId: rule.scenario_id,
        ruleId: rule.id,
        ruleType: rule.rule_type,
        entityType: "contract",
        entityId: contract.id,
        fireAt: toIsoDate(deadline),
        message: `Cancellation notice deadline approaching for contract ${contract.id}`
      });
    }
  }

  return candidates;
}

function collectCandidatesForRule(
  db: Database.Database,
  rule: AlertRuleRow,
  nowIso: string
): AlertCandidate[] {
  const params = parseParams(rule.params_json);
  const windowDays = params.window_days ?? 30;
  const cutoffIso = toIsoDate(addDays(parseIsoDate(nowIso), windowDays));

  if (rule.rule_type === "upcoming_payment") {
    const rows = db
      .prepare(
        `
          SELECT id, occurrence_date
          FROM occurrence
          WHERE scenario_id = ?
            AND occurrence_date BETWEEN ? AND ?
        `
      )
      .all(rule.scenario_id, nowIso, cutoffIso) as Array<{ id: string; occurrence_date: string }>;

    return rows.map((row) => ({
      scenarioId: rule.scenario_id,
      ruleId: rule.id,
      ruleType: rule.rule_type,
      entityType: "occurrence",
      entityId: row.id,
      fireAt: row.occurrence_date,
      message: `Upcoming payment on ${row.occurrence_date}`
    }));
  }

  if (rule.rule_type === "renewal_window") {
    const rows = db
      .prepare(
        `
          SELECT id, renewal_date
          FROM contract
          WHERE renewal_date BETWEEN ? AND ?
        `
      )
      .all(nowIso, cutoffIso) as Array<{ id: string; renewal_date: string }>;

    return rows.map((row) => ({
      scenarioId: rule.scenario_id,
      ruleId: rule.id,
      ruleType: rule.rule_type,
      entityType: "contract",
      entityId: row.id,
      fireAt: row.renewal_date,
      message: `Contract renewal approaching on ${row.renewal_date}`
    }));
  }

  if (rule.rule_type === "notice_window") {
    return createNoticeWindowCandidates(db, rule, cutoffIso, nowIso);
  }

  if (rule.rule_type === "replacement_missing") {
    const rows = db
      .prepare(
        `
          SELECT id, must_replace_by
          FROM service_plan
          WHERE scenario_id = ?
            AND replacement_required = 1
            AND replacement_selected_service_id IS NULL
            AND must_replace_by IS NOT NULL
            AND must_replace_by BETWEEN ? AND ?
        `
      )
      .all(rule.scenario_id, nowIso, cutoffIso) as Array<{ id: string; must_replace_by: string }>;

    return rows.map((row) => ({
      scenarioId: rule.scenario_id,
      ruleId: rule.id,
      ruleType: rule.rule_type,
      entityType: "service_plan",
      entityId: row.id,
      fireAt: row.must_replace_by,
      message: `Replacement missing for service plan ${row.id}`
    }));
  }

  const rows = db
    .prepare(
      `
        SELECT id, must_replace_by
        FROM service_plan
        WHERE scenario_id = ?
          AND reason_code = 'EOL'
          AND must_replace_by IS NOT NULL
          AND must_replace_by BETWEEN ? AND ?
      `
    )
    .all(rule.scenario_id, nowIso, cutoffIso) as Array<{ id: string; must_replace_by: string }>;

  return rows.map((row) => ({
    scenarioId: rule.scenario_id,
    ruleId: rule.id,
    ruleType: rule.rule_type,
    entityType: "service_plan",
    entityId: row.id,
    fireAt: row.must_replace_by,
    message: `EOL milestone approaching for service plan ${row.id}`
  }));
}

function persistCandidates(db: Database.Database, candidates: AlertCandidate[]): number {
  const insert = db.prepare(
    `
      INSERT INTO alert_event (
        id,
        scenario_id,
        alert_rule_id,
        entity_type,
        entity_id,
        fire_at,
        fired_at,
        status,
        dedupe_key,
        message,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, 'pending', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `
  );

  let created = 0;
  for (const candidate of candidates) {
    const dedupeKey = buildDedupeKey(candidate);
    const existing = db
      .prepare("SELECT id FROM alert_event WHERE dedupe_key = ?")
      .get(dedupeKey) as { id: string } | undefined;

    if (existing) {
      continue;
    }

    insert.run(
      crypto.randomUUID(),
      candidate.scenarioId,
      candidate.ruleId,
      candidate.entityType,
      candidate.entityId,
      candidate.fireAt,
      dedupeKey,
      candidate.message
    );
    created += 1;
  }

  return created;
}

export function runAlertSchedulerTick(
  db: Database.Database,
  nowIsoDate: string = toIsoDate(new Date())
): { created: number; evaluatedRules: number } {
  const rules = db
    .prepare(
      `
        SELECT id, scenario_id, rule_type, params_json, enabled
        FROM alert_rule
        WHERE enabled = 1
      `
    )
    .all() as AlertRuleRow[];

  const run = db.transaction(() => {
    let created = 0;
    for (const rule of rules) {
      const candidates = collectCandidatesForRule(db, rule, nowIsoDate);
      created += persistCandidates(db, candidates);
    }
    return created;
  });

  return {
    created: run(),
    evaluatedRules: rules.length
  };
}

