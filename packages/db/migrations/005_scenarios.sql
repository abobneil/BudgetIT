CREATE TABLE IF NOT EXISTS scenario (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_scenario_id TEXT,
  approval_status TEXT NOT NULL DEFAULT 'draft',
  is_locked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO scenario (id, name, parent_scenario_id, approval_status, is_locked)
VALUES ('baseline', 'Baseline', NULL, 'approved', 0);

UPDATE meta
SET schema_version = 5,
    updated_at = CURRENT_TIMESTAMP;

