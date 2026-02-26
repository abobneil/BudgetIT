CREATE TABLE IF NOT EXISTS meta (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  database_uuid TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  last_mutation_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO meta (id, database_uuid, schema_version, last_mutation_at)
VALUES (1, 'bootstrap', 1, CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS vendor (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  website TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS service (
  id TEXT PRIMARY KEY,
  vendor_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  owner_team TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS contract (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL,
  contract_number TEXT,
  start_date TEXT,
  end_date TEXT,
  renewal_type TEXT,
  renewal_date TEXT,
  notice_period_days INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS expense_line (
  id TEXT PRIMARY KEY,
  scenario_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  contract_id TEXT,
  name TEXT NOT NULL,
  expense_type TEXT NOT NULL,
  status TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS recurrence_rule (
  id TEXT PRIMARY KEY,
  expense_line_id TEXT NOT NULL,
  frequency TEXT NOT NULL,
  interval INTEGER NOT NULL,
  day_of_month INTEGER,
  month_of_year INTEGER,
  anchor_date TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS occurrence (
  id TEXT PRIMARY KEY,
  scenario_id TEXT NOT NULL,
  expense_line_id TEXT NOT NULL,
  occurrence_date TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  state TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS spend_transaction (
  id TEXT PRIMARY KEY,
  scenario_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  contract_id TEXT,
  transaction_date TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  description TEXT,
  matched_occurrence_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dimension (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  mode TEXT NOT NULL,
  required INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tag (
  id TEXT PRIMARY KEY,
  dimension_id TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_tag_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  archived_at TEXT
);

CREATE TABLE IF NOT EXISTS tag_assignment (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  dimension_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS service_plan (
  id TEXT PRIMARY KEY,
  scenario_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  planned_action TEXT NOT NULL,
  decision_status TEXT NOT NULL,
  reason_code TEXT,
  must_replace_by TEXT,
  replacement_required INTEGER NOT NULL,
  replacement_selected_service_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS replacement_candidate (
  id TEXT PRIMARY KEY,
  service_plan_id TEXT NOT NULL,
  candidate_service_id TEXT,
  candidate_name TEXT,
  score INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alert_rule (
  id TEXT PRIMARY KEY,
  scenario_id TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  params_json TEXT NOT NULL,
  enabled INTEGER NOT NULL,
  channels TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alert_event (
  id TEXT PRIMARY KEY,
  scenario_id TEXT NOT NULL,
  alert_rule_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  fire_at TEXT NOT NULL,
  fired_at TEXT,
  status TEXT NOT NULL,
  dedupe_key TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attachment (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  content_sha256 TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
