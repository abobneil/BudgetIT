import type Database from "better-sqlite3-multiple-ciphers";

export type AlertEventStatus = "pending" | "snoozed" | "acked";

export type AlertEventRecord = {
  id: string;
  scenarioId: string;
  alertRuleId: string;
  entityType: string;
  entityId: string;
  fireAt: string;
  firedAt: string | null;
  status: AlertEventStatus;
  snoozedUntil: string | null;
  dedupeKey: string;
  message: string;
  createdAt: string;
  updatedAt: string;
};

type AlertEventRow = {
  id: string;
  scenario_id: string;
  alert_rule_id: string;
  entity_type: string;
  entity_id: string;
  fire_at: string;
  fired_at: string | null;
  status: AlertEventStatus;
  snoozed_until: string | null;
  dedupe_key: string;
  message: string;
  created_at: string;
  updated_at: string;
};

function mapAlertEvent(row: AlertEventRow): AlertEventRecord {
  return {
    id: row.id,
    scenarioId: row.scenario_id,
    alertRuleId: row.alert_rule_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    fireAt: row.fire_at,
    firedAt: row.fired_at,
    status: row.status,
    snoozedUntil: row.snoozed_until,
    dedupeKey: row.dedupe_key,
    message: row.message,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function readAlertEvent(db: Database.Database, alertEventId: string): AlertEventRecord {
  const row = db
    .prepare(
      `
        SELECT
          id,
          scenario_id,
          alert_rule_id,
          entity_type,
          entity_id,
          fire_at,
          fired_at,
          status,
          snoozed_until,
          dedupe_key,
          message,
          created_at,
          updated_at
        FROM alert_event
        WHERE id = ?
      `
    )
    .get(alertEventId) as AlertEventRow | undefined;

  if (!row) {
    throw new Error(`Alert event not found: ${alertEventId}`);
  }

  return mapAlertEvent(row);
}

export function listAlertEvents(db: Database.Database): AlertEventRecord[] {
  const rows = db
    .prepare(
      `
        SELECT
          id,
          scenario_id,
          alert_rule_id,
          entity_type,
          entity_id,
          fire_at,
          fired_at,
          status,
          snoozed_until,
          dedupe_key,
          message,
          created_at,
          updated_at
        FROM alert_event
        ORDER BY fire_at ASC, created_at ASC
      `
    )
    .all() as AlertEventRow[];

  return rows.map(mapAlertEvent);
}

export function listActionableAlertEventsForNotification(
  db: Database.Database,
  asOfIsoDate: string
): AlertEventRecord[] {
  const rows = db
    .prepare(
      `
        SELECT
          id,
          scenario_id,
          alert_rule_id,
          entity_type,
          entity_id,
          fire_at,
          fired_at,
          status,
          snoozed_until,
          dedupe_key,
          message,
          created_at,
          updated_at
        FROM alert_event
        WHERE fired_at IS NULL
          AND fire_at <= ?
          AND (
            status = 'pending'
            OR (
              status = 'snoozed'
              AND snoozed_until IS NOT NULL
              AND snoozed_until <= ?
            )
          )
        ORDER BY fire_at ASC, created_at ASC
      `
    )
    .all(asOfIsoDate, asOfIsoDate) as AlertEventRow[];

  return rows.map(mapAlertEvent);
}

export function acknowledgeAlertEvent(
  db: Database.Database,
  alertEventId: string,
  acknowledgedAtIsoDate: string
): AlertEventRecord {
  const result = db
    .prepare(
      `
        UPDATE alert_event
        SET status = 'acked',
            fired_at = COALESCE(fired_at, ?),
            snoozed_until = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `
    )
    .run(acknowledgedAtIsoDate, alertEventId);

  if (result.changes === 0) {
    throw new Error(`Alert event not found: ${alertEventId}`);
  }

  return readAlertEvent(db, alertEventId);
}

export function snoozeAlertEvent(
  db: Database.Database,
  alertEventId: string,
  snoozedUntilIsoDate: string
): AlertEventRecord {
  if (snoozedUntilIsoDate.trim().length === 0) {
    throw new Error("Snoozed until date is required.");
  }

  const result = db
    .prepare(
      `
        UPDATE alert_event
        SET status = 'snoozed',
            snoozed_until = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `
    )
    .run(snoozedUntilIsoDate, alertEventId);

  if (result.changes === 0) {
    throw new Error(`Alert event not found: ${alertEventId}`);
  }

  return readAlertEvent(db, alertEventId);
}

export function unsnoozeAlertEvent(db: Database.Database, alertEventId: string): AlertEventRecord {
  const result = db
    .prepare(
      `
        UPDATE alert_event
        SET status = 'pending',
            snoozed_until = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `
    )
    .run(alertEventId);

  if (result.changes === 0) {
    throw new Error(`Alert event not found: ${alertEventId}`);
  }

  return readAlertEvent(db, alertEventId);
}

export function markAlertEventNotified(
  db: Database.Database,
  alertEventId: string,
  firedAtIsoDate: string
): void {
  const result = db
    .prepare(
      `
        UPDATE alert_event
        SET fired_at = COALESCE(fired_at, ?),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `
    )
    .run(firedAtIsoDate, alertEventId);

  if (result.changes === 0) {
    throw new Error(`Alert event not found: ${alertEventId}`);
  }
}
