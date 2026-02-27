ALTER TABLE replacement_candidate
ADD COLUMN scorecard_json TEXT;

UPDATE meta
SET schema_version = 8,
    updated_at = CURRENT_TIMESTAMP;
