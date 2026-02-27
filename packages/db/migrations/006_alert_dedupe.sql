CREATE UNIQUE INDEX IF NOT EXISTS idx_alert_event_dedupe_key ON alert_event (dedupe_key);

UPDATE meta
SET schema_version = 6,
    updated_at = CURRENT_TIMESTAMP;

