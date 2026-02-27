ALTER TABLE meta ADD COLUMN forecast_stale INTEGER NOT NULL DEFAULT 1;
ALTER TABLE meta ADD COLUMN forecast_generated_at TEXT;

UPDATE meta
SET schema_version = 4,
    updated_at = CURRENT_TIMESTAMP;

