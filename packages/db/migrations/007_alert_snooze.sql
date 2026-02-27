ALTER TABLE alert_event ADD COLUMN snoozed_until TEXT;

CREATE INDEX IF NOT EXISTS idx_alert_event_notify
ON alert_event (status, fired_at, fire_at, snoozed_until);

UPDATE meta
SET schema_version = 7,
    updated_at = CURRENT_TIMESTAMP;
