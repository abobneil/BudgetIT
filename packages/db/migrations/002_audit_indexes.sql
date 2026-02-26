CREATE INDEX IF NOT EXISTS idx_occurrence_date ON occurrence (scenario_id, occurrence_date);
CREATE INDEX IF NOT EXISTS idx_alert_event_status ON alert_event (status, fire_at);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log (entity_type, entity_id, created_at);

UPDATE meta
SET schema_version = 2,
    updated_at = CURRENT_TIMESTAMP;

