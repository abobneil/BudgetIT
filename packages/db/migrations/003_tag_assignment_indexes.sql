CREATE UNIQUE INDEX IF NOT EXISTS idx_tag_assignment_entity_tag
  ON tag_assignment (entity_type, entity_id, tag_id);

CREATE INDEX IF NOT EXISTS idx_tag_assignment_entity_dimension
  ON tag_assignment (entity_type, entity_id, dimension_id);

UPDATE meta
SET schema_version = 3,
    updated_at = CURRENT_TIMESTAMP;

