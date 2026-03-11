CREATE TABLE IF NOT EXISTS capability (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS capability_assignment (
  id TEXT PRIMARY KEY,
  capability_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (capability_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_capability_assignment_entity
ON capability_assignment (entity_type, entity_id);

CREATE TABLE IF NOT EXISTS service_plan_source_item (
  id TEXT PRIMARY KEY,
  service_plan_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (service_plan_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_service_plan_source_item_plan
ON service_plan_source_item (service_plan_id);

ALTER TABLE replacement_candidate
ADD COLUMN annual_cost_minor INTEGER NOT NULL DEFAULT 0;

ALTER TABLE replacement_candidate
ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD';

UPDATE meta
SET schema_version = 13,
    updated_at = CURRENT_TIMESTAMP;
